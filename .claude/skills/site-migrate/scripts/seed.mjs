#!/usr/bin/env node
// site-migrate :: seed — enumerate the source site into manifest rows.
// Contract: references/implementation-plan.md § CLI contracts.
// wordpress adapter: sitemap index → sub-sitemaps; type from sub-sitemap name;
// locale from URL path prefix (config.locale_mechanism = url-path).
// Re-seed is idempotent: existing rows kept by id, new appended, vanished noted.
import {
  readJson, writeJsonAtomic, readConfig, MANIFEST_PATH, die, summary,
} from './lib/project.mjs';
import { politeFetch, fetchSitemap } from './lib/sitemap.mjs';

const config = readConfig();
const adapter = config.source?.adapter;
const sourceUrl = (config.source?.url || '').replace(/\/+$/, '');
if (!sourceUrl) die(3, 'config.source.url missing — run intake first');
if (adapter !== 'wordpress') die(3, `seed: adapter "${adapter}" not supported (only "wordpress")`);

const locales = Array.isArray(config.locales) ? config.locales : [];
const defaultLocale = config.default_locale || locales[0] || 'en';
const localeMechanism = config.locale_mechanism || 'url-path';
const exclusions = Array.isArray(config.exclusions) ? config.exclusions : [];

// --- helpers ---------------------------------------------------------------

// glob-ish: "*" wildcards, otherwise substring match against path or full URL
function isExcluded(url, path) {
  for (const pat of exclusions) {
    if (!pat) continue;
    if (pat.includes('*')) {
      const re = new RegExp(pat.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'));
      if (re.test(path) || re.test(url)) return true;
    } else if (path.includes(pat) || url.includes(pat)) {
      return true;
    }
  }
  return false;
}

function detectLocale(path) {
  if (localeMechanism === 'url-path') {
    const first = path.split('/').filter(Boolean)[0];
    if (first && locales.includes(first) && first !== defaultLocale) return first;
  }
  return defaultLocale;
}

function rowId(locale, path) {
  let segs = path.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  if (segs[0] === locale && locale !== defaultLocale) segs = segs.slice(1);
  const slug = segs.join('-').toLowerCase();
  return `${locale}-${slug || 'home'}`;
}

function typeFromSitemapName(subUrl) {
  const name = subUrl.split('/').pop() || '';
  const post = name.match(/post[-_]type[-_]([a-z0-9_-]+?)\.xml/i);
  if (post) return post[1];
  if (/taxonomy|author|archive|category|post_tag|tag/i.test(name)) return 'archive';
  return 'page';
}

// --- enumerate via sitemap ---------------------------------------------------

console.error(`[seed] fetching sitemap index: ${sourceUrl}/sitemap.xml`);
let top;
try {
  top = await fetchSitemap(`${sourceUrl}/sitemap.xml`);
} catch (e) {
  die(3, `[seed] cannot fetch sitemap index: ${e.message}`);
}

// (subUrl, type) pairs to walk; a bare urlset at /sitemap.xml is treated as pages
const subSitemaps = top.index
  ? top.index.map((u) => [u, typeFromSitemapName(u)])
  : [[`${sourceUrl}/sitemap.xml`, 'page']];

const enumerated = new Map(); // id → row candidate
let excludedCount = 0;
const sitemapTypeCounts = {}; // type → { perLocale: {locale: n} }

for (const [subUrl, type] of subSitemaps) {
  let urls;
  if (top.index) {
    console.error(`[seed] fetching sub-sitemap: ${subUrl}`);
    let sub;
    try {
      sub = await fetchSitemap(subUrl);
    } catch (e) {
      die(3, `[seed] cannot fetch sub-sitemap ${subUrl}: ${e.message}`);
    }
    if (sub.index) { console.error(`[seed] nested index at ${subUrl} — skipping (unexpected)`); continue; }
    urls = sub.urls;
  } else {
    urls = top.urls;
  }

  for (const url of urls) {
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    const path = parsed.pathname;
    if (isExcluded(url, path)) { excludedCount++; continue; }
    const locale = detectLocale(path);
    const id = rowId(locale, path);
    if (enumerated.has(id)) continue; // first sitemap wins
    enumerated.set(id, {
      id, locale, source_url: url, source_path: path, target_path: path,
      type, title: null, status: 'pending', attempts: 0,
      claimed_by: null, claimed_at: null, captured_at: null, built_at: null,
      compared_at: null, last_build_touch: null, shared_deps: [], notes: [], gaps: [],
    });
    const tc = (sitemapTypeCounts[type] ??= { perLocale: {} });
    tc.perLocale[locale] = (tc.perLocale[locale] || 0) + 1;
  }
}

if (enumerated.size === 0) die(3, '[seed] sitemap enumeration produced 0 URLs');

// --- merge with existing manifest (idempotent re-seed) -----------------------

const existing = readJson(MANIFEST_PATH, null);
const nowIso = new Date().toISOString();
const pages = [];
let kept = 0, added = 0, vanished = 0;

if (existing && Array.isArray(existing.pages)) {
  for (const old of existing.pages) {
    if (enumerated.has(old.id)) {
      pages.push(old); // preserve status/attempts/timestamps verbatim
      enumerated.delete(old.id);
      kept++;
    } else {
      old.notes = old.notes || [];
      if (!old.notes.some((n) => String(n).startsWith('vanished:'))) {
        old.notes.push(`vanished: not in sitemap as of ${nowIso}`);
      }
      pages.push(old); // never deleted
      vanished++;
    }
  }
}
for (const row of enumerated.values()) { pages.push(row); added++; }

// --- best-effort REST cross-check (counts only, default locale) --------------

const crossCheckGaps = [];
try {
  const typesRes = await politeFetch(`${sourceUrl}/wp-json/wp/v2/types`, { retries: 1, timeoutMs: 30000 });
  if (typesRes.status === 200) {
    const restTypes = JSON.parse(typesRes.text);
    for (const [type, tc] of Object.entries(sitemapTypeCounts)) {
      if (type === 'archive') continue;
      const def = Object.values(restTypes).find((t) => t.slug === type);
      if (!def?.rest_base) continue;
      const r = await politeFetch(`${sourceUrl}/wp-json/wp/v2/${def.rest_base}?per_page=1`, { retries: 1, timeoutMs: 30000 });
      const restTotal = parseInt(r.headers.get('x-wp-total') || '', 10);
      const sitemapDefault = tc.perLocale[defaultLocale] || 0;
      if (Number.isFinite(restTotal) && restTotal !== sitemapDefault) {
        crossCheckGaps.push(`cross-check ${type}: REST total ${restTotal} vs sitemap ${defaultLocale}-count ${sitemapDefault}`);
      }
    }
  } else {
    crossCheckGaps.push(`cross-check skipped: wp-json/wp/v2/types HTTP ${typesRes.status}`);
  }
} catch (e) {
  crossCheckGaps.push(`cross-check skipped: ${e.message}`);
}

// --- write + summary ----------------------------------------------------------

const manifest = {
  version: 1,
  generated_at: nowIso,
  source_url: config.source.url,
  pages,
};
if (crossCheckGaps.length) manifest.gaps = crossCheckGaps;
writeJsonAtomic(MANIFEST_PATH, manifest);

// type × locale matrix over the FULL manifest
const matrix = {};
for (const p of pages) {
  const byLocale = (matrix[p.type] ??= {});
  byLocale[p.locale] = (byLocale[p.locale] || 0) + 1;
}
const locOrder = [defaultLocale, ...locales.filter((l) => l !== defaultLocale)];
const lines = [
  `seed: ${pages.length} rows → ${MANIFEST_PATH}`,
  `kept ${kept} | new ${added} | vanished ${vanished} | excluded ${excludedCount}`,
  `type\\locale  ${locOrder.map((l) => l.padStart(5)).join(' ')}  total`,
];
for (const type of Object.keys(matrix).sort()) {
  const counts = locOrder.map((l) => String(matrix[type][l] || 0).padStart(5));
  const total = Object.values(matrix[type]).reduce((a, b) => a + b, 0);
  lines.push(`${type.padEnd(12)} ${counts.join(' ')}  ${total}`);
}
for (const g of crossCheckGaps) lines.push(`gap: ${g}`);
summary(lines);
