#!/usr/bin/env node
// site-migrate :: extract — adapter-routed content extraction.
// Usage: extract.mjs <id>
// Reads fixtures/<id>/ (rest.json preferred, dom.raw.html fallback), writes
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
  detectShortcodes, decodeEntities,
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

let title = row.title || '';
let date = '';
let slugFromRest = '';
let excerpt = '';
let contentRoot = null;
let rawContentHtml = '';
let usedSource = '';

if (existsSync(restPath)) {
  const rest = readJson(restPath);
  rawContentHtml = rest?.content?.rendered || '';
  if (rawContentHtml.trim()) {
    usedSource = 'rest.json';
    contentRoot = parseHTML(rawContentHtml);
    title = decodeEntities(rest.title?.rendered || '').trim() || title;
    date = rest.date || '';
    slugFromRest = rest.slug || '';
    excerpt = decodeEntities((rest.excerpt?.rendered || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
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
const locale = row.locale || 'en';
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

// ---- media download + optimize --------------------------------------------------
const mediaUrls = collectMediaUrls(contentRoot)
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
  return urlMap.get(abs) ?? u;
}
const body = toMarkdown(contentRoot, { rewriteUrl, addGap: (g) => gaps.add(g) });
for (const sc of detectShortcodes(rawContentHtml)) gaps.add(`shortcode:[${sc}]`);

// ---- frontmatter ----------------------------------------------------------------
const description = meta.description || meta.og.description || excerpt || '';
const fm = [];
const fmKV = (k, v, indent = '') => { if (v) fm.push(`${indent}${k}: ${JSON.stringify(String(v))}`); };
fm.push('---');
fmKV('title', title);
fmKV('slug', slug);
fmKV('locale', locale);
fmKV('type', row.type);
fmKV('source_url', row.source_url);
fmKV('date', date);
fmKV('description', description);
fmKV('canonical', meta.canonical);
if (Object.keys(meta.og).length) {
  fm.push('og:');
  for (const [k, v] of Object.entries(meta.og)) fmKV(k.replace(/[^\w-]/g, '_'), v, '  ');
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
