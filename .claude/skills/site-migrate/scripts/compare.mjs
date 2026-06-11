#!/usr/bin/env node
// site-migrate :: compare — parity verdict.
// Usage: compare.mjs <id> <candidate-url> [--calibrate]
//   --calibrate: compare fixtures/<id> vs fixtures/<id>.recheck (no live
//   capture; any out-of-threshold diff = masking bug in capture/normalize).
// Writes PROJECT_ROOT/reports/<id>/parity-report.json + diff-images/.
// Exit: 0 pass / 1 fail / 2 needs_human / 3 harness error.
import { join } from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  ROOT, requireFromProject, importFromProject, readJson, writeJsonAtomic,
  readConfig, die, summary, MANIFEST_PATH,
} from './lib/project.mjs';
import { extractText } from './lib/normalize.mjs';
import { capturePage, loadTunables } from './capture.mjs';

const ALL_DIMENSIONS = ['layout', 'fonts', 'texts', 'seo_meta', 'links', 'media', 'animations'];

function enabledDimensions(config) {
  const f = config.fidelity;
  let dims = ALL_DIMENSIONS;
  if (Array.isArray(f)) dims = ALL_DIMENSIONS.filter((d) => f.includes(d));
  else if (f && typeof f === 'object') dims = ALL_DIMENSIONS.filter((d) => f[d] !== false);
  // seo_meta is mandated by seo-rules.md at every seo_bar — never opt-in via
  // the fidelity vocabulary (whose names don't include it)
  if (!dims.includes('seo_meta')) dims = [...dims, 'seo_meta'];
  return dims;
}

function readText(path) {
  if (!existsSync(path)) die(3, `compare: missing artifact ${path} — re-run capture`);
  return readFileSync(path, 'utf8');
}

// --------------------------------------------------------------------------
// layout: pixelmatch on masked screenshots, per viewport
// --------------------------------------------------------------------------

async function compareLayout({ fixtureDir, candDir, diffDir, thresholds, pageType, fixtureMeta }) {
  const sharp = requireFromProject('sharp');
  const { default: pixelmatch } = await importFromProject('pixelmatch');
  const limits = thresholds.pixel_diff_pct || {};
  const limit = limits[pageType] ?? limits.default ?? 1.0;
  const viewports = (thresholds.viewports || []).map((v) => v.name);
  const perViewport = [];

  for (const vp of viewports) {
    const aPath = join(fixtureDir, `screenshot-${vp}.png`);
    const bPath = join(candDir, `screenshot-${vp}.png`);
    if (!existsSync(aPath) || !existsSync(bPath)) die(3, `compare: missing screenshot for viewport "${vp}"`);
    const aMeta = await sharp(aPath).metadata();
    const bMeta = await sharp(bPath).metadata();
    // dimension-pad the smaller image (black, matching the mask color)
    const w = Math.max(aMeta.width, bMeta.width);
    const h = Math.max(aMeta.height, bMeta.height);
    const pad = (path, m) =>
      sharp(path)
        .extend({ top: 0, left: 0, right: w - m.width, bottom: h - m.height, background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .ensureAlpha().raw().toBuffer();
    const [a, b] = await Promise.all([pad(aPath, aMeta), pad(bPath, bMeta)]);
    const diff = Buffer.alloc(w * h * 4);
    const mismatched = pixelmatch(a, b, diff, w, h, {
      threshold: thresholds.antialiasing_tolerance ?? 0.1,
      includeAA: false,
    });
    const pct = (mismatched / (w * h)) * 100;

    // bounding box of mismatched pixels (pixelmatch paints them 255,0,0)
    let minX = w, minY = h, maxX = -1, maxY = -1;
    if (mismatched > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          if (diff[o] === 255 && diff[o + 1] === 0 && diff[o + 2] === 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
    const bbox = maxX >= 0 ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;

    await sharp(diff, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(join(diffDir, `${vp}.png`));

    // name the worst-overlapping sampled selector for this viewport
    let selector = null;
    if (bbox && fixtureMeta?.sample_rects?.[vp]) {
      let best = 0;
      for (const [sel, r] of Object.entries(fixtureMeta.sample_rects[vp])) {
        const ox = Math.max(0, Math.min(bbox.x + bbox.width, r.x + r.width) - Math.max(bbox.x, r.x));
        const oy = Math.max(0, Math.min(bbox.y + bbox.height, r.y + r.height) - Math.max(bbox.y, r.y));
        const area = ox * oy;
        const rArea = Math.max(1, r.width * r.height);
        // prefer the smallest sampled element that still covers the diff
        const score = area / rArea;
        if (area > 0 && score > best) { best = score; selector = sel; }
      }
    }
    perViewport.push({ viewport: vp, pixel_diff_pct: +pct.toFixed(4), mismatched, bbox, selector, size_a: `${aMeta.width}x${aMeta.height}`, size_b: `${bMeta.width}x${bMeta.height}` });
  }

  const worst = perViewport.reduce((acc, v) => (v.pixel_diff_pct > acc.pixel_diff_pct ? v : acc), perViewport[0]);
  const pass = perViewport.every((v) => v.pixel_diff_pct <= limit);
  const dim = { pass, threshold: limit, pixel_diff_pct: worst?.pixel_diff_pct ?? 0, per_viewport: perViewport.map((v) => `${v.viewport}:${v.pixel_diff_pct}%`) };
  if (!pass && worst) {
    dim.viewport = worst.viewport;
    dim.worst_region = worst.bbox ? `${worst.bbox.x},${worst.bbox.y} ${worst.bbox.width}x${worst.bbox.height}px` : 'unknown';
    dim.selector = worst.selector || '(no sampled element overlaps diff)';
  }
  return dim;
}

// --------------------------------------------------------------------------
// texts: similarity on extractText of normalized DOM
// --------------------------------------------------------------------------

function tokenLevenshtein(a, b) {
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Uint32Array(m + 1);
  let curr = new Uint32Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

function compareTexts({ fixtureDir, candDir, thresholds }) {
  const aText = extractText(readText(join(fixtureDir, 'dom.html')));
  const bText = extractText(readText(join(candDir, 'dom.html')));
  const a = aText ? aText.split(' ') : [];
  const b = bText ? bText.split(' ') : [];
  const maxLen = Math.max(a.length, b.length, 1);
  const dist = tokenLevenshtein(a, b);
  const similarity = +(1 - dist / maxLen).toFixed(4);
  const min = thresholds.text_similarity_min ?? 1.0;
  const dim = { pass: similarity >= min, similarity, threshold: min };
  if (!dim.pass) {
    // localize: trim common prefix/suffix, show divergence
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const missing = a.slice(p, a.length - s).join(' ');
    const extra = b.slice(p, b.length - s).join(' ');
    const clip = (t) => (t.length > 120 ? t.slice(0, 117) + '...' : t);
    dim.missing_text = clip(missing) || null;
    dim.extra_text = clip(extra) || null;
    dim.context = clip(a.slice(Math.max(0, p - 6), p).join(' '));
  }
  return dim;
}

// --------------------------------------------------------------------------
// links: href set on normalized DOM, mapped through url-map.json
// --------------------------------------------------------------------------

function extractHrefs(html) {
  // normalized DOM serialization is regular: sorted attrs, double quotes
  const out = [];
  const re = /<a [^>]*href="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function normalizePath(p) {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

function classifyHref(href, sourceOrigin, pagePath = '/') {
  if (!href || href === '#' || /^(javascript|mailto|tel|sms):/i.test(href)) return null;
  // fragment-only links resolve to the page itself (seo-rules: resolve
  // relative URLs against the page URL) — otherwise a source TOC like
  // https://site/page/#x vs candidate #x reads as a missing self-link
  if (href.startsWith('#')) return { internal: true, path: normalizePath(pagePath) };
  try {
    if (href.startsWith('/')) return { internal: true, path: normalizePath(href.split('#')[0].split('?')[0]) };
    const u = new URL(href);
    if (sourceOrigin && u.origin === sourceOrigin) return { internal: true, path: normalizePath(u.pathname) };
    return { internal: false, href: href.split('#')[0] };
  } catch {
    return { internal: true, path: normalizePath(href.split('#')[0].split('?')[0]) };
  }
}

function compareLinks({ fixtureDir, candDir, sourceUrl, candidateUrl, urlMap }) {
  const sourceOrigin = (() => { try { return new URL(sourceUrl).origin; } catch { return null; } })();
  const candOrigin = (() => { try { return new URL(candidateUrl || sourceUrl).origin; } catch { return null; } })();
  const mapPath = (p) => normalizePath(urlMap?.[p] ?? urlMap?.[p + '/'] ?? p);

  const sourcePagePath = (() => { try { return new URL(sourceUrl).pathname; } catch { return '/'; } })();
  const candPagePath = (() => { try { return new URL(candidateUrl || sourceUrl).pathname; } catch { return '/'; } })();
  const fixture = extractHrefs(readText(join(fixtureDir, 'dom.html'))).map((h) => classifyHref(h, sourceOrigin, sourcePagePath)).filter(Boolean);
  const cand = extractHrefs(readText(join(candDir, 'dom.html'))).map((h) => classifyHref(h, candOrigin, candPagePath)).filter(Boolean);

  const expectedInternal = new Set(fixture.filter((l) => l.internal).map((l) => mapPath(l.path)));
  const candInternal = new Set(cand.filter((l) => l.internal).map((l) => normalizePath(l.path)));
  const expectedExternal = new Set(fixture.filter((l) => !l.internal).map((l) => l.href));
  const candExternal = new Set(cand.filter((l) => !l.internal).map((l) => l.href));

  const missingInternal = [...expectedInternal].filter((p) => !candInternal.has(p));
  const missingExternal = [...expectedExternal].filter((h) => !candExternal.has(h));
  const extraInternal = [...candInternal].filter((p) => !expectedInternal.has(p));
  const extraExternal = [...candExternal].filter((h) => !expectedExternal.has(h));

  const missing = [...missingInternal, ...missingExternal];
  const extra = [...extraInternal, ...extraExternal];
  // seo-rules.md: the FULL link inventory must match — a link the source never
  // had is an alteration, same as a lost one
  const dim = {
    pass: missing.length === 0 && extra.length === 0,
    expected: expectedInternal.size + expectedExternal.size,
    found: candInternal.size + candExternal.size,
  };
  if (missing.length) {
    dim.missing = missing.slice(0, 5);
    dim.worst_offender = missing[0];
  }
  if (extra.length) {
    dim.extra = extra.slice(0, 5);
    dim.worst_offender = dim.worst_offender ?? `extra link: ${extra[0]}`;
  }
  return dim;
}

// --------------------------------------------------------------------------
// seo_meta: head.json exact compare with url-map translation for URL fields
// --------------------------------------------------------------------------

function compareSeoMeta({ fixtureDir, candDir, urlMap }) {
  const fh = readJson(join(fixtureDir, 'head.json'), {});
  const ch = readJson(join(candDir, 'head.json'), {});
  const mapUrlValue = (v) => {
    if (!v) return v;
    try {
      const u = new URL(v);
      const p = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : u.pathname;
      return urlMap?.[p] ?? urlMap?.[p + '/'] ?? p;
    } catch { return v; }
  };
  const failures = [];
  const check = (field, a, b, isUrl = false) => {
    const av = isUrl ? mapUrlValue(a) : a ?? null;
    const bv = isUrl ? mapUrlValue(b) : b ?? null;
    if ((av ?? null) !== (bv ?? null)) failures.push({ field, fixture: a ?? null, candidate: b ?? null });
  };
  check('title', fh.title, ch.title);
  check('meta:description', fh.meta?.description, ch.meta?.description);
  check('canonical', fh.canonical, ch.canonical, true);
  const ogKeys = new Set([
    ...Object.keys(fh.meta || {}),
    ...Object.keys(ch.meta || {}),
  ].filter((k) => k.startsWith('og:')));
  for (const k of [...ogKeys].sort()) {
    const isUrl = /^og:(url|image|image:secure_url|video)$/.test(k);
    check(`meta:${k}`, fh.meta?.[k], ch.meta?.[k], isUrl);
  }
  const dim = { pass: failures.length === 0, checked: 3 + ogKeys.size };
  if (!dim.pass) {
    dim.failures = failures.slice(0, 5).map((f) => f.field);
    const w = failures[0];
    dim.worst_offender = `${w.field}: "${String(w.fixture).slice(0, 60)}" → "${String(w.candidate).slice(0, 60)}"`;
  }
  return dim;
}

// --------------------------------------------------------------------------
// media: img/video presence + alt text on normalized DOM
// --------------------------------------------------------------------------

function extractMedia(html) {
  const imgs = [];
  const re = /<img [^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const alt = / alt="([^"]*)"/.exec(m[0]);
    const src = / src="([^"]*)"/.exec(m[0]);
    imgs.push({ src: src ? src[1] : '', alt: alt ? alt[1] : null });
  }
  const videos = (html.match(/<video[ >]/g) || []).length;
  return { imgs, videos };
}

function compareMedia({ fixtureDir, candDir }) {
  const a = extractMedia(readText(join(fixtureDir, 'dom.html')));
  const b = extractMedia(readText(join(candDir, 'dom.html')));
  const issues = [];
  if (a.imgs.length !== b.imgs.length) issues.push(`img count ${a.imgs.length} → ${b.imgs.length}`);
  if (a.videos !== b.videos) issues.push(`video count ${a.videos} → ${b.videos}`);
  const altMultiset = (imgs) => imgs.map((i) => i.alt ?? '<no-alt>').sort();
  const aAlts = altMultiset(a.imgs);
  const bAlts = altMultiset(b.imgs);
  const bPool = [...bAlts];
  const missingAlts = aAlts.filter((alt) => {
    const i = bPool.indexOf(alt);
    if (i === -1) return true;
    bPool.splice(i, 1);
    return false;
  });
  if (missingAlts.length) issues.push(`missing alt text: "${missingAlts[0].slice(0, 60)}" (+${missingAlts.length - 1} more)`);
  const dim = { pass: issues.length === 0, img_count: [a.imgs.length, b.imgs.length], video_count: [a.videos, b.videos] };
  if (!dim.pass) {
    dim.issues = issues.slice(0, 3);
    dim.worst_offender = issues[0];
  }
  return dim;
}

// --------------------------------------------------------------------------
// fonts: computed-style sample compare (font props only)
// --------------------------------------------------------------------------

const FONT_PROPS = ['font-family', 'font-size', 'font-weight', 'line-height'];

function compareFonts({ fixtureDir, candDir }) {
  const fs_ = readJson(join(fixtureDir, 'styles.json'), {});
  const cs = readJson(join(candDir, 'styles.json'), {});
  const shared = Object.keys(fs_).filter((k) => k in cs);
  const mismatches = [];
  for (const sel of shared) {
    for (const p of FONT_PROPS) {
      if ((fs_[sel]?.[p] ?? null) !== (cs[sel]?.[p] ?? null)) {
        mismatches.push({ selector: sel, prop: p, fixture: fs_[sel]?.[p], candidate: cs[sel]?.[p] });
      }
    }
  }
  const dim = { pass: mismatches.length === 0, compared_selectors: shared.length };
  if (!dim.pass) {
    const w = mismatches[0];
    dim.selector = w.selector;
    dim.worst_offender = `${w.selector} ${w.prop}: "${w.fixture}" → "${w.candidate}"`;
    dim.mismatches = mismatches.slice(0, 5).map((m) => `${m.selector}:${m.prop}`);
  }
  return dim;
}

// --------------------------------------------------------------------------
// orchestration
// --------------------------------------------------------------------------

async function runDimensions(ctx, dims) {
  const out = {};
  for (const d of dims) {
    if (d === 'layout') out.layout = await compareLayout(ctx);
    else if (d === 'texts') out.texts = compareTexts(ctx);
    else if (d === 'links') out.links = compareLinks(ctx);
    else if (d === 'seo_meta') out.seo_meta = compareSeoMeta(ctx);
    else if (d === 'media') out.media = compareMedia(ctx);
    else if (d === 'fonts') out.fonts = compareFonts(ctx);
    else if (d === 'animations') out.animations = compareAnimations(ctx);
  }
  return out;
}

// Motion can't be pixel-diffed (screenshots freeze it), so we compare the
// authored DEFINITIONS: every @keyframes the source defines must exist in the
// candidate with an identical step definition, and every animation/transition
// signature (selector-independent set) must be reproduced. JS-driven motion
// (GSAP/sliders) leaves no CSS here → handled by the needs_human policy, not this.
function compareAnimations({ fixtureDir, candDir }) {
  const sa = readJson(join(fixtureDir, 'authored-css.json'), null);
  const ca = readJson(join(candDir, 'authored-css.json'), null);
  if (!sa || !ca) return { pass: true, skipped: 'no authored-css.json on one side' };
  const skf = sa.keyframes || {}; const ckf = ca.keyframes || {};
  const missingKf = Object.keys(skf).filter((n) => norm(ckf[n]) !== norm(skf[n]));
  const sMotion = new Set(sa.motion || []); const cMotion = new Set(ca.motion || []);
  const missingMotion = [...sMotion].filter((m) => !cMotion.has(m));
  const pass = missingKf.length === 0 && missingMotion.length === 0;
  const dim = {
    pass,
    keyframes_checked: Object.keys(skf).length,
    motions_checked: sMotion.size,
  };
  if (!pass) {
    dim.missing_keyframes = missingKf.slice(0, 5);
    dim.missing_motion = missingMotion.slice(0, 5);
    dim.worst_offender = missingKf.length
      ? `@keyframes ${missingKf[0]} missing/altered`
      : `motion not reproduced: ${missingMotion[0]}`;
  }
  return dim;
}
function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function describeFailure(name, dim) {
  const where = [dim.selector, dim.worst_region, dim.viewport && `@${dim.viewport}`].filter(Boolean).join(' ');
  if (name === 'layout') return `layout: ${dim.pixel_diff_pct}% > ${dim.threshold}% ${where}`;
  if (name === 'texts') return `texts: similarity ${dim.similarity} < ${dim.threshold} near "${dim.context || ''}" missing="${dim.missing_text || ''}" extra="${dim.extra_text || ''}"`;
  return `${name}: ${dim.worst_offender || 'mismatch'}`;
}

async function main() {
  const args = process.argv.slice(2);
  let id = null;
  let candidateUrl = null;
  let calibrate = false;
  for (const a of args) {
    if (a === '--calibrate') calibrate = true;
    else if (!id) id = a;
    else if (!candidateUrl) candidateUrl = a;
    else die(3, `compare: unexpected argument "${a}"`);
  }
  if (!id || (!calibrate && !candidateUrl)) {
    die(3, 'usage: compare.mjs <id> <candidate-url> [--calibrate]');
  }

  const config = readConfig();
  const { maskRules, thresholds } = loadTunables();
  const fixtureDir = join(ROOT, 'fixtures', id);
  if (!existsSync(fixtureDir)) die(3, `compare: missing fixtures ${fixtureDir} — run capture.mjs ${id} first`);
  const fixtureMeta = readJson(join(fixtureDir, 'capture-meta.json'), {});
  const manifest = readJson(MANIFEST_PATH, []);
  const rows = Array.isArray(manifest) ? manifest : manifest.pages || manifest.rows || [];
  const row = rows.find((r) => r.id === id) || {};
  const urlMap = readJson(join(ROOT, 'migration', 'url-map.json'), null);

  const reportDir = join(ROOT, 'reports', id);
  const diffDir = join(reportDir, 'diff-images');
  mkdirSync(diffDir, { recursive: true });

  const dims = enabledDimensions(config);
  const recheckDir = `${fixtureDir}.recheck`;

  let candDir;
  let nondeterministic = false;
  let probeNote = null;

  if (calibrate) {
    if (!existsSync(recheckDir)) die(3, `compare: --calibrate needs ${recheckDir} — run capture.mjs ${id} --calibrate`);
    candDir = recheckDir;
  } else {
    // nondeterminism probe: if a recheck capture exists, the source must agree
    // with itself before the candidate is judged against it
    if (thresholds.nondeterminism_probe?.double_capture_on_first_attempt && existsSync(recheckDir)) {
      const probe = await runDimensions({
        fixtureDir, candDir: recheckDir, diffDir, thresholds, fixtureMeta,
        pageType: row.type || 'default', sourceUrl: row.source_url || fixtureMeta.source_url,
        candidateUrl: row.source_url || fixtureMeta.source_url, urlMap: null,
      }, dims);
      const disagree = Object.entries(probe).filter(([, d]) => !d.pass);
      if (disagree.length) {
        nondeterministic = true;
        probeNote = `source disagrees with its own recheck on: ${disagree.map(([n]) => n).join(', ')} — ${describeFailure(...disagree[0])}`;
      }
    }
    candDir = join(reportDir, 'candidate');
    if (!nondeterministic) {
      const { chromium } = requireFromProject('playwright');
      const browser = await chromium.launch({ headless: true });
      try {
        await capturePage(browser, {
          url: candidateUrl, outDir: candDir, config, maskRules, thresholds, label: 'candidate',
        });
      } finally {
        await browser.close().catch(() => {});
      }
    }
  }

  let dimensions = {};
  let verdict;
  if (nondeterministic) {
    verdict = 'needs_human';
  } else {
    dimensions = await runDimensions({
      fixtureDir, candDir, diffDir, thresholds, fixtureMeta,
      pageType: row.type || 'default',
      sourceUrl: row.source_url || fixtureMeta.source_url,
      candidateUrl: calibrate ? (row.source_url || fixtureMeta.source_url) : candidateUrl,
      urlMap: calibrate ? null : urlMap,
    }, dims);
    verdict = Object.values(dimensions).every((d) => d.pass) ? 'pass' : 'fail';
  }

  const failing = Object.entries(dimensions).filter(([, d]) => !d.pass);
  const oneLine =
    verdict === 'pass'
      ? `PASS${calibrate ? ' (calibrate)' : ''}: all ${Object.keys(dimensions).length} dimensions within thresholds`
      : verdict === 'needs_human'
        ? `NEEDS_HUMAN: nondeterministic source — ${probeNote}`
        : `FAIL${calibrate ? ' (calibrate: masking bug)' : ''}: ${describeFailure(...failing[0])}`;

  const nextHint =
    verdict === 'pass' ? 'none — eligible for parity_passed'
      : verdict === 'needs_human' ? 'inspect source nondeterminism (timers/AB-tests); extend mask rules with a reason'
        : calibrate ? `fix capture/normalize masking for: ${failing.map(([n]) => n).join(', ')}`
          : `inspect ${failing[0][1].selector || failing[0][1].worst_offender || failing[0][0]} on both sides`;

  const report = {
    page_id: id,
    locale: row.locale || config.default_locale || 'en',
    captured_at: fixtureMeta.captured_at || null,
    compared_at: new Date().toISOString(),
    attempt: (row.attempts ?? 0) + 1,
    mode: calibrate ? 'calibrate' : 'candidate',
    candidate_url: calibrate ? null : candidateUrl,
    verdict,
    summary: {
      one_line: oneLine,
      dimensions,
      next_action_hint: nextHint,
    },
    artifacts: {
      diff_images: `reports/${id}/diff-images/*.png`,
      candidate_capture: calibrate ? `fixtures/${id}.recheck/` : `reports/${id}/candidate/`,
      fixture: `fixtures/${id}/`,
    },
  };
  writeJsonAtomic(join(reportDir, 'parity-report.json'), report);

  const lines = [oneLine];
  for (const [name, dim] of Object.entries(dimensions)) {
    if (dim.pass) {
      const detail = name === 'layout' ? ` (worst ${dim.pixel_diff_pct}% ≤ ${dim.threshold}%)`
        : name === 'texts' ? ` (similarity ${dim.similarity})` : '';
      lines.push(`  ${name}: pass${detail}`);
    } else {
      lines.push(`  ${name}: FAIL — ${describeFailure(name, dim)}`);
    }
  }
  lines.push(`report: reports/${id}/parity-report.json`);
  lines.push(`hint: ${nextHint}`);
  summary(lines);

  process.exit(verdict === 'pass' ? 0 : verdict === 'needs_human' ? 2 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => die(3, `compare: harness error — ${e.stack || e.message}`));
}
