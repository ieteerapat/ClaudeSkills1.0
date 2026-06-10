#!/usr/bin/env node
// site-migrate :: extract — adapter-routed content extraction.
// Usage: extract.mjs <id>
// Reads fixtures/<id>/ DOM-first (rest.json only as default-locale enrichment;
// see locale-aware selection below — TranslatePress serves non-default locales
// dynamically and Bricks stores layout in postmeta, so REST is unreliable), writes
// content/<locale>/<slug>.mdx + <slug>.media.json, downloads source-domain
// media into public-assets/ (sharp-optimized), records gaps on the manifest row.
// Exit: 0 ok, 2 needs_human (missing/empty fixture, auth-gated media), 3 harness error.
import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, normalize, extname } from 'node:path';
import {
  ROOT, MANIFEST_PATH, requireFromProject, readJson, writeJsonAtomic,
  readConfig, die, summary,
} from './lib/project.mjs';
import {
  parseHTML, extractMainContent, toMarkdown, textOf, collectMediaUrls,
  detectShortcodes, decodeEntities, find, findAll, pickImgSrc,
} from './lib/extract-markdown.mjs';

const USER_AGENT = 'site-migrate-harness/1.0 (content migration; polite single-connection)';
const THROTTLE_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const id = process.argv[2];
if (!id || id.startsWith('-')) die(3, 'usage: extract.mjs <id>');

const config = readConfig();
const adapter = config.source?.adapter;
if (adapter !== 'wordpress') die(3, `extract: unsupported source adapter "${adapter}" (implemented: wordpress)`);

// ---- manifest row -----------------------------------------------------------
const manifestDoc = readJson(MANIFEST_PATH);
const rows = Array.isArray(manifestDoc) ? manifestDoc
  : Array.isArray(manifestDoc.pages) ? manifestDoc.pages
  : Array.isArray(manifestDoc.rows) ? manifestDoc.rows
  : die(3, `extract: unrecognized manifest shape in ${MANIFEST_PATH}`);
const row = rows.find((r) => r.id === id);
if (!row) die(3, `extract: no manifest row with id "${id}"`);

const gaps = new Set(row.gaps || []);
function saveGaps() {
  row.gaps = [...gaps];
  writeJsonAtomic(MANIFEST_PATH, manifestDoc);
}
function bailNeedsHuman(reason) {
  gaps.add(reason);
  saveGaps();
  summary([`extract ${id}: needs_human — ${reason}`]);
  process.exit(2);
}

// ---- fixture inputs ---------------------------------------------------------
const fixDir = join(ROOT, 'fixtures', id);
const restPath = join(fixDir, 'rest.json');
const domPath = join(fixDir, 'dom.raw.html');
const head = readJson(join(fixDir, 'head.json'), {});

const locale = row.locale || 'en';
const defaultLocale = config.default_locale || 'en';
const isDefaultLocale = locale === defaultLocale;

let title = row.title || '';
let date = '';
let slugFromRest = '';
let excerpt = '';
let contentRoot = null;
let rawContentHtml = '';
let usedSource = '';

// DOM-first, with REST as default-locale enrichment ONLY. REST content.rendered
// is authoritative only when (a) this is the default locale — TranslatePress
// returns the default language for every slug, so REST would yield English for
// an /ar/ page — AND (b) the body is substantial — Bricks-built page types store
// layout in postmeta, leaving content.rendered empty/partial. Otherwise the
// per-locale rendered-DOM fixture is the source of truth (correct for all 6
// locales and all builders).
if (isDefaultLocale && existsSync(restPath)) {
  const rest = readJson(restPath);
  const restBody = rest?.content?.rendered || '';
  const textChars = restBody.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  if (textChars > 200) {
    usedSource = 'rest.json';
    rawContentHtml = restBody;
    contentRoot = parseHTML(restBody);
    title = decodeEntities(rest.title?.rendered || '').trim() || title;
    date = rest.date || '';
    slugFromRest = rest.slug || '';
    excerpt = decodeEntities((rest.excerpt?.rendered || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  } else if (rest.date) {
    date = rest.date; // language-independent metadata still usable
    slugFromRest = rest.slug || '';
  }
}
if (!contentRoot && existsSync(domPath)) {
  const html = readFileSync(domPath, 'utf8');
  if (html.trim()) {
    usedSource = 'dom.raw.html';
    rawContentHtml = html;
    if (!title) {
      const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
      if (t) title = decodeEntities(t).replace(/\s+/g, ' ').trim();
    }
    contentRoot = extractMainContent(parseHTML(html));
  }
}
if (!contentRoot) bailNeedsHuman('fixture-missing: no rest.json content or dom.raw.html');
if (!textOf(contentRoot).replace(/\s+/g, '').length && !collectMediaUrls(contentRoot).length) {
  bailNeedsHuman(`fixture-empty: ${usedSource} has no extractable content`);
}

// ---- head.json meta (tolerant of shape) -------------------------------------
function headMeta(h) {
  const out = { description: '', canonical: '', og: {} };
  if (!h || typeof h !== 'object') return out;
  // capture.mjs writes meta as a plain { name/property: content } object
  if (h.meta && typeof h.meta === 'object' && !Array.isArray(h.meta)) {
    for (const [k, v] of Object.entries(h.meta)) {
      const key = k.toLowerCase();
      if (typeof v !== 'string' || !v) continue;
      if (key === 'description') out.description ||= v;
      else if (key.startsWith('og:')) out.og[key.slice(3)] ||= v;
    }
    if (typeof h.canonical === 'string') out.canonical = h.canonical;
    return out;
  }
  const metas = Array.isArray(h) ? h : Array.isArray(h.meta) ? h.meta : null;
  if (metas) {
    for (const mEntry of metas) {
      const key = (mEntry.property || mEntry.name || '').toLowerCase();
      const val = mEntry.content || '';
      if (!key || !val) continue;
      if (key === 'description') out.description ||= val;
      else if (key.startsWith('og:')) out.og[key.slice(3)] ||= val;
    }
    if (!Array.isArray(h) && typeof h.canonical === 'string') out.canonical = h.canonical;
    return out;
  }
  if (typeof h.description === 'string') out.description = h.description;
  if (typeof h.canonical === 'string') out.canonical = h.canonical;
  if (h.og && typeof h.og === 'object') Object.assign(out.og, h.og);
  for (const [k, v] of Object.entries(h)) {
    if (k.startsWith('og:') && typeof v === 'string') out.og[k.slice(3)] ||= v;
  }
  return out;
}
const meta = headMeta(head);

// ---- slug / output paths ----------------------------------------------------
function relPathFromSource(sourcePath) {
  let p = String(sourcePath || '/').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  p = p.replace(/^\//, '').replace(/\/$/, '').replace(/\.html?$/, '');
  if (p) {
    const segs = p.split('/');
    if (segs[0] === locale) { segs.shift(); p = segs.join('/'); }
  }
  return p || 'index';
}
const relPath = relPathFromSource(row.source_path);
const slug = slugFromRest || relPath.split('/').pop();
const mdxPath = join(ROOT, 'content', locale, `${relPath}.mdx`);
const mediaJsonPath = join(ROOT, 'content', locale, `${relPath}.media.json`);

// ---- source-host media detection ----------------------------------------------
const sourceUrl = row.source_url || config.source?.url || '';
const sourceHost = (() => { try { return new URL(sourceUrl).hostname; } catch { return ''; } })();
const bareHost = sourceHost.replace(/^www\./, '');
const cdnHosts = (config.source?.cdn_hosts || []).map((h) => h.toLowerCase());
function isSourceMedia(absUrl) {
  if (!/^https?:/.test(absUrl)) return false;
  let host;
  try { host = new URL(absUrl).hostname.toLowerCase(); } catch { return false; }
  if (host === sourceHost || host === bareHost || host.endsWith(`.${bareHost}`)) return true;
  if (cdnHosts.includes(host)) return true;
  if (/(^|\.)wp\.com$/.test(host) && /^i\d\./.test(host)) return true; // i0.wp.com CDN
  return false;
}
function resolveUrl(u) {
  try { return new URL(u, sourceUrl || undefined).href; } catch { return u; }
}

// ---- single-post furniture (Bricks/WP template regions, captured verbatim) ---
// Breadcrumbs, share links, post navigation and the hero figure are rendered
// by the source's single-post TEMPLATE, outside the REST content — capture
// them per page/locale from the page DOM so the target template can render
// them from frontmatter instead of inventing them.
const furniture = {};
if (row.type === 'post' && existsSync(domPath)) {
  const pageDom = parseHTML(readFileSync(domPath, 'utf8'));
  const cls = (n) => String(n.attrs?.class || '');
  const cleanText = (n) => textOf(n).replace(/\s+/g, ' ').trim();
  // same-origin absolute hrefs → path-only (the target site must not link the
  // old host); external hrefs (share endpoints) stay verbatim
  const internalPath = (href) => {
    if (!href) return href;
    try {
      const u = new URL(href, sourceUrl || undefined);
      if (u.hostname.replace(/^www\./, '') === bareHost) {
        return (u.pathname || '/') + u.search + u.hash;
      }
    } catch { /* keep as-is */ }
    return href;
  };

  const bc = find(pageDom, (n) => n.tag === 'nav' && /breadcrumb/i.test(n.attrs?.['aria-label'] || ''));
  if (bc) {
    const crumbs = findAll(bc, (n) => (n.tag === 'a' || n.tag === 'span') && /(^| )item( |$)/.test(cls(n)))
      .map((el) => {
        const item = { label: cleanText(el) };
        if (el.tag === 'a' && el.attrs?.href) item.href = internalPath(el.attrs.href);
        return item;
      })
      .filter((c) => c.label);
    if (crumbs.length) furniture.breadcrumb = crumbs;
  }

  const sharing = find(pageDom, (n) => n.tag === 'ul' && /post-sharing/.test(cls(n)));
  if (sharing) {
    const links = findAll(sharing, (n) => n.tag === 'a' && n.attrs?.href)
      .map((a) => ({ network: a.attrs['aria-label'] || '', href: a.attrs.href }));
    if (links.length) furniture.share_links = links;
    const sh = find(pageDom, (n) => /^h[1-6]$/.test(n.tag) && /share[-_]+heading/.test(cls(n)));
    if (sh) furniture.share_heading = cleanText(sh);
  }

  const pn = find(pageDom, (n) => n.tag === 'nav' && /post navigation/i.test(n.attrs?.['aria-label'] || ''));
  if (pn) {
    for (const dir of ['prev', 'next']) {
      const a = find(pn, (n) => n.tag === 'a'
        && (new RegExp(`(^| )${dir}-post( |$)`).test(cls(n)) || n.attrs?.rel === dir));
      if (a?.attrs?.href) {
        furniture[`${dir}_post`] = { href: internalPath(a.attrs.href), label: cleanText(a) };
      }
    }
  }

  const heroFig = find(pageDom, (n) => /hero__img/.test(cls(n)));
  const heroImg = heroFig ? find(heroFig, (n) => n.tag === 'img') : null;
  if (heroImg?.attrs) {
    furniture.hero_src = heroImg.attrs.src || pickImgSrc(heroImg.attrs);
    furniture.hero_alt = heroImg.attrs.alt || '';
  }
}

// ---- media download + optimize --------------------------------------------------
const mediaUrls = [...collectMediaUrls(contentRoot), ...(furniture.hero_src ? [furniture.hero_src] : [])]
  .map((u) => ({ original: u, abs: resolveUrl(u) }))
  .filter((m) => isSourceMedia(m.abs));

const inventory = [];
const urlMap = new Map(); // abs URL -> /public-assets/... path
let authGated = false;

const OPTIMIZABLE = new Set(['.jpg', '.jpeg', '.png']);

for (const m of mediaUrls) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(m.abs).pathname); } catch { continue; }
  const safeRel = normalize(pathname).replace(/^([/.]|\.\.)+/, '');
  const localAbs = join(ROOT, 'public-assets', safeRel);
  if (!localAbs.startsWith(join(ROOT, 'public-assets'))) continue;
  const publicPath = '/public-assets/' + safeRel;
  const ext = extname(safeRel).toLowerCase();
  const entry = { url: m.abs, local: `public-assets/${safeRel}`, public_path: publicPath };

  if (existsSync(localAbs)) {
    entry.status = 'exists';
    entry.bytes = statSync(localAbs).size;
    inventory.push(entry);
    urlMap.set(m.abs, publicPath);
    continue;
  }
  let res;
  try {
    res = await fetch(m.abs, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow' });
  } catch (e) {
    entry.status = `failed:${e.message}`;
    gaps.add(`media-unreachable:${m.abs}`);
    inventory.push(entry);
    await sleep(THROTTLE_MS);
    continue;
  }
  if (res.status === 401 || res.status === 403) {
    entry.status = `failed:${res.status}`;
    gaps.add(`media-auth-gated:${m.abs}`);
    authGated = true;
    inventory.push(entry);
    await sleep(THROTTLE_MS);
    continue;
  }
  if (!res.ok) {
    entry.status = `failed:${res.status}`;
    gaps.add(`media-missing:${m.abs}`);
    inventory.push(entry);
    await sleep(THROTTLE_MS);
    continue;
  }
  let buf = Buffer.from(await res.arrayBuffer());
  entry.optimized = false;
  if (OPTIMIZABLE.has(ext)) {
    try {
      const sharp = requireFromProject('sharp');
      const re = ext === '.png'
        ? await sharp(buf).png({ quality: 82, palette: true }).toBuffer()
        : await sharp(buf).jpeg({ quality: 82 }).toBuffer();
      if (re.length < buf.length) { buf = re; entry.optimized = true; }
    } catch (e) {
      entry.optimize_error = e.message;
    }
  }
  mkdirSync(dirname(localAbs), { recursive: true });
  writeFileSync(localAbs, buf);
  entry.status = 'downloaded';
  entry.bytes = buf.length;
  inventory.push(entry);
  urlMap.set(m.abs, publicPath);
  await sleep(THROTTLE_MS);
}

// ---- HTML → MDX -------------------------------------------------------------------
function rewriteUrl(u) {
  const abs = resolveUrl(u);
  if (urlMap.has(abs)) return urlMap.get(abs);
  // same-origin content links → path-only (the built site must never link the
  // old host); external links stay verbatim
  if (/^https?:/.test(abs)) {
    try {
      const p = new URL(abs);
      if (p.hostname.replace(/^www\./, '') === bareHost) {
        return (p.pathname || '/') + p.search + p.hash;
      }
    } catch { /* keep as-is */ }
  }
  return u;
}
const body = toMarkdown(contentRoot, { rewriteUrl, addGap: (g) => gaps.add(g) });
for (const sc of detectShortcodes(rawContentHtml)) gaps.add(`shortcode:[${sc}]`);

// ---- frontmatter ----------------------------------------------------------------
const description = meta.description || meta.og.description || excerpt || '';
// title = the literal <title> (seo_meta is an exact match); post_title = the
// display headline (REST title) the template renders in its hero
const headTitle = typeof head.title === 'string' ? head.title.replace(/\s+/g, ' ').trim() : '';
const fm = [];
const fmKV = (k, v, indent = '') => { if (v) fm.push(`${indent}${k}: ${JSON.stringify(String(v))}`); };
fm.push('---');
fmKV('title', headTitle || title);
if (usedSource === 'rest.json') fmKV('post_title', title);
fmKV('slug', slug);
fmKV('locale', locale);
fmKV('type', row.type);
fmKV('source_url', row.source_url);
fmKV('date', date);
fmKV('description', description);
fmKV('excerpt', excerpt);
fmKV('canonical', meta.canonical);
if (Object.keys(meta.og).length) {
  fm.push('og:');
  for (const [k, v] of Object.entries(meta.og)) fmKV(k.replace(/[^\w-]/g, '_'), v, '  ');
}
// furniture (YAML flow style — gray-matter parses JSON-compatible inline)
if (furniture.breadcrumb) fm.push('breadcrumb: ' + JSON.stringify(furniture.breadcrumb));
fmKV('share_heading', furniture.share_heading);
if (furniture.share_links) fm.push('share_links: ' + JSON.stringify(furniture.share_links));
if (furniture.prev_post) fm.push('prev_post: ' + JSON.stringify(furniture.prev_post));
if (furniture.next_post) fm.push('next_post: ' + JSON.stringify(furniture.next_post));
if (furniture.hero_src) {
  fmKV('hero_image', urlMap.get(resolveUrl(furniture.hero_src)) || furniture.hero_src);
  fmKV('hero_image_alt', furniture.hero_alt);
}
fm.push('---');

mkdirSync(dirname(mdxPath), { recursive: true });
writeFileSync(mdxPath, fm.join('\n') + '\n\n' + body + '\n');
writeJsonAtomic(mediaJsonPath, {
  id, locale, source_url: row.source_url, extracted_from: usedSource,
  extracted_at: new Date().toISOString(), media: inventory,
});
saveGaps();

const downloaded = inventory.filter((e) => e.status === 'downloaded').length;
const existing = inventory.filter((e) => e.status === 'exists').length;
const failed = inventory.filter((e) => String(e.status).startsWith('failed')).length;
summary([
  `extract ${id} (${usedSource})`,
  `  mdx: ${mdxPath.replace(ROOT + '/', '')}`,
  `  media: ${downloaded} downloaded, ${existing} cached, ${failed} failed → ${mediaJsonPath.replace(ROOT + '/', '')}`,
  `  gaps: ${gaps.size ? [...gaps].join('; ') : 'none'}`,
]);
if (authGated) die(2, `extract ${id}: auth-gated media — needs_human`);
