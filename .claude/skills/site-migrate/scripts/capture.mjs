#!/usr/bin/env node
// site-migrate :: capture — golden fixture capture.
// Usage: capture.mjs <id> [--calibrate] [--url <override>]
// Writes PROJECT_ROOT/fixtures/<id>/ (screenshots×viewports, dom.raw.html,
// dom.html, styles.json, a11y.json, head.json, har.json, rest.json (WP),
// capture-meta.json). --calibrate captures twice (fixtures/<id>.recheck/).
// Exit: 0 ok / 3 harness error.
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  ROOT, SKILL_DIR, requireFromProject, readJson, writeJsonAtomic, readConfig,
  die, summary, MANIFEST_PATH,
} from './lib/project.mjs';
import { normalizeHtml, stabilizePage, maskRegions } from './lib/normalize.mjs';

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// per-project tunables, falling back to the skill defaults
export function loadTunables() {
  const maskRules = readJson(
    join(ROOT, 'migration', 'mask-rules.json'),
    readJson(join(SKILL_DIR, 'config', 'mask-rules.default.json'))
  );
  const thresholds = readJson(
    join(ROOT, 'migration', 'thresholds.json'),
    readJson(join(SKILL_DIR, 'config', 'thresholds.default.json'))
  );
  return { maskRules, thresholds };
}

export function resolveRow(id, urlOverride, config) {
  if (urlOverride) {
    return { id, locale: config.default_locale || (config.locales || [])[0] || 'en', source_url: urlOverride, adhoc: true };
  }
  const manifest = readJson(MANIFEST_PATH);
  const rows = Array.isArray(manifest) ? manifest : manifest.pages || manifest.rows || [];
  const row = rows.find((r) => r.id === id);
  if (!row) die(3, `capture: no manifest row with id "${id}" in ${MANIFEST_PATH} (use --url for adhoc capture)`);
  if (!row.source_url) die(3, `capture: manifest row "${id}" has no source_url`);
  return row;
}

async function applyPixelMasks(sharp, pngBuffer, regions) {
  if (!regions.length) return pngBuffer;
  const img = sharp(pngBuffer);
  const { width, height } = await img.metadata();
  const composites = [];
  for (const r of regions) {
    const left = Math.max(0, Math.min(Math.round(r.x), width - 1));
    const top = Math.max(0, Math.min(Math.round(r.y), height - 1));
    const w = Math.min(Math.ceil(r.width), width - left);
    const h = Math.min(Math.ceil(r.height), height - top);
    if (w < 1 || h < 1) continue;
    composites.push({
      input: { create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } },
      left, top,
    });
  }
  if (!composites.length) return pngBuffer;
  return img.composite(composites).png().toBuffer();
}

const STYLE_PROPS = [
  'display', 'position', 'font-family', 'font-size', 'font-weight', 'line-height',
  'color', 'background-color', 'margin', 'padding', 'width', 'height',
];

// computed styles for a stable element sample + document-relative rects
// (rects are stored per viewport in capture-meta and used by compare.mjs to
// name the worst-failing selector for pixel diffs)
async function collectStylesAndRects(page, classMaskPatterns) {
  return page.evaluate(({ props, classMasks }) => {
    const masks = classMasks.map((p) => new RegExp(p));
    const els = [];
    const seen = new Set();
    const add = (e) => { if (e && !seen.has(e)) { seen.add(e); els.push(e); } };
    for (const sel of ['body', 'header', 'nav', 'main', 'footer', 'h1', 'h2', 'h3', '[role="main"]', '[role="banner"]', '[role="contentinfo"]']) {
      document.querySelectorAll(sel).forEach(add);
    }
    let n = 0;
    for (const e of document.querySelectorAll('[class]')) {
      if (n >= 30) break;
      if (!seen.has(e)) { add(e); n++; }
    }
    const styles = {};
    const rects = {};
    for (const el of els) {
      let key = el.tagName.toLowerCase();
      if (el.id) key += '#' + el.id;
      else {
        const classes = Array.from(el.classList).filter((c) => !masks.some((m) => m.test(c))).slice(0, 3);
        if (classes.length) key += '.' + classes.join('.');
      }
      if (styles[key] !== undefined) {
        let k = 2;
        while (styles[`${key}:nth(${k})`] !== undefined) k++;
        key = `${key}:nth(${k})`;
      }
      const cs = getComputedStyle(el);
      const st = {};
      for (const p of props) st[p] = cs.getPropertyValue(p);
      styles[key] = st;
      const r = el.getBoundingClientRect();
      rects[key] = {
        x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY),
        width: Math.round(r.width), height: Math.round(r.height),
      };
    }
    return { styles, rects };
  }, {
    props: STYLE_PROPS,
    classMasks: classMaskPatterns,
  });
}

async function collectHead(page) {
  return page.evaluate(() => {
    const meta = {};
    document.querySelectorAll('head meta[name], head meta[property]').forEach((m) => {
      const key = m.getAttribute('name') || m.getAttribute('property');
      if (key && !(key in meta)) meta[key] = m.getAttribute('content') || '';
    });
    const canonical = document.querySelector('head link[rel="canonical"]');
    const alternates = Array.from(document.querySelectorAll('head link[rel="alternate"]')).map((l) => ({
      hreflang: l.getAttribute('hreflang') || null,
      type: l.getAttribute('type') || null,
      href: l.getAttribute('href') || '',
    }));
    return {
      title: document.title,
      meta,
      canonical: canonical ? canonical.getAttribute('href') : null,
      alternates,
    };
  });
}

// Authored CSS — the design SYSTEM, not resolved px. getComputedStyle (used
// for parity) flattens 1.5rem→24px and var(--x)/clamp() away; design-token
// extraction (Phase 1.5) needs the authored values, so we read them from the
// cascade itself: custom properties, @font-face, media-query breakpoints, and
// the authored font-size/spacing declarations. Cross-origin sheets throw on
// .cssRules — their hrefs are returned for a node-side fetch fallback.
async function collectAuthoredCss(page) {
  return page.evaluate(() => {
    const rootCs = getComputedStyle(document.documentElement);
    const custom_properties = {};
    for (let i = 0; i < rootCs.length; i++) {
      const p = rootCs[i];
      if (p.startsWith('--')) custom_properties[p] = rootCs.getPropertyValue(p).trim();
    }
    const font_faces = [];
    const breakpoints = new Set();
    const type_scale = new Set();
    const spacing = new Set();
    const inaccessible_sheets = [];
    const SPACING_PROPS = ['margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
      'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'gap', 'row-gap', 'column-gap'];
    const unitRe = /-?\d*\.?\d+(rem|em|px|%|vw|vh|ch)/g;
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          font_faces.push({
            family: rule.style.getPropertyValue('font-family').trim(),
            src: rule.style.getPropertyValue('src').trim(),
            weight: rule.style.getPropertyValue('font-weight').trim(),
            style: rule.style.getPropertyValue('font-style').trim(),
          });
        } else if (rule.type === CSSRule.MEDIA_RULE) {
          (rule.conditionText || rule.media?.mediaText || '').replace(/\d*\.?\d+(px|em|rem)/g, (m) => breakpoints.add(m));
          walk(rule.cssRules);
        } else if (rule.type === CSSRule.STYLE_RULE) {
          const fs = rule.style.getPropertyValue('font-size').trim();
          if (fs) type_scale.add(fs);
          for (const sp of SPACING_PROPS) {
            const v = rule.style.getPropertyValue(sp).trim();
            if (v) (v.match(unitRe) || []).forEach((u) => spacing.add(u));
          }
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules); }
      catch { if (sheet.href) inaccessible_sheets.push(sheet.href); }
    }
    return {
      custom_properties,
      font_faces,
      breakpoints: [...breakpoints],
      type_scale: [...type_scale],
      spacing: [...spacing],
      inaccessible_sheets,
    };
  });
}

function looksLikeChallenge(title, status) {
  if (status === 403 || status === 503) return true;
  return /just a moment|attention required|access denied|checking your browser/i.test(title || '');
}

// Capture one URL into outDir with the full stabilize → mask → snapshot
// pipeline. Shared verbatim by compare.mjs for candidate captures — same
// pipeline on both sides is the parity contract.
export async function capturePage(browser, { url, outDir, config, maskRules, thresholds, label = 'source' }) {
  const sharp = requireFromProject('sharp');
  mkdirSync(outDir, { recursive: true });
  const viewports = thresholds.viewports || [{ name: 'desktop', width: 1440, height: 900 }];
  const classMaskPatterns = (maskRules.mask_attribute_patterns || [])
    .filter((r) => r.attr === 'class')
    .map((r) => r.pattern);

  const har = [];
  let domRaw = null;
  let stylesJson = {};
  let a11y = null;
  let headJson = {};
  let authoredCss = null;
  const sampleRects = {};

  for (let vi = 0; vi < viewports.length; vi++) {
    const vp = viewports[vi];
    const isLast = vi === viewports.length - 1;
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      userAgent: USER_AGENT,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('response', (res) => {
      try { har.push({ url: res.url(), status: res.status(), type: res.request().resourceType() }); } catch { /* ignore */ }
    });

    let resp;
    try {
      resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e) {
      await context.close().catch(() => {});
      die(3, `capture(${label}): navigation failed for ${url} @${vp.name}: ${e.message}`);
    }
    const status = resp ? resp.status() : 0;
    const title = await page.title().catch(() => '');
    if (!resp || status >= 400 || looksLikeChallenge(title, status)) {
      await context.close().catch(() => {});
      die(3, `capture(${label}): ${url} unreachable or challenged (HTTP ${status}, title "${title}")`);
    }

    await stabilizePage(page, maskRules);
    const regions = await maskRegions(page, maskRules);
    const shot = await page.screenshot({ fullPage: true, animations: 'disabled' });
    const masked = await applyPixelMasks(sharp, shot, regions);
    writeFileSync(join(outDir, `screenshot-${vp.name}.png`), masked);

    const collected = await collectStylesAndRects(page, classMaskPatterns).catch(() => ({ styles: {}, rects: {} }));
    sampleRects[vp.name] = collected.rects;

    if (isLast) {
      stylesJson = collected.styles;
      domRaw = await page.content();
      headJson = await collectHead(page).catch(() => ({}));
      try { a11y = await page.accessibility.snapshot(); } catch { a11y = null; }
      // authored CSS = the design system (rem/clamp/tokens), source of truth
      // for Phase 1.5; computed styles.json stays the parity source.
      authoredCss = await collectAuthoredCss(page).catch(() => null);
    }
    await context.close();
  }

  writeFileSync(join(outDir, 'dom.raw.html'), domRaw ?? '');
  writeFileSync(join(outDir, 'dom.html'), normalizeHtml(domRaw ?? '', maskRules));
  writeJsonAtomic(join(outDir, 'styles.json'), stylesJson);
  writeJsonAtomic(join(outDir, 'a11y.json'), a11y);
  writeJsonAtomic(join(outDir, 'head.json'), headJson);

  // node-side fetch fallback: cross-origin sheets that threw on .cssRules in
  // the browser are still fetchable here (no CORS in node). Store raw text so
  // the design-system phase can parse authored values from theme/CDN CSS.
  if (authoredCss) {
    const raw = {};
    for (const href of (authoredCss.inaccessible_sheets || []).slice(0, 20)) {
      try {
        const r = await fetch(href, { headers: { 'user-agent': USER_AGENT } });
        if (r.ok) raw[href] = (await r.text()).slice(0, 500000);
      } catch { /* best effort */ }
    }
    authoredCss.fetched_sheets = raw;
    writeJsonAtomic(join(outDir, 'authored-css.json'), authoredCss);
  }
  // dedup + sort for determinism
  const harUniq = [...new Map(har.map((e) => [`${e.url}|${e.status}|${e.type}`, e])).values()]
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : a.status - b.status));
  writeJsonAtomic(join(outDir, 'har.json'), harUniq);

  // wordpress REST item by slug — best effort, source side only
  if (label === 'source' && config?.source?.adapter === 'wordpress') {
    try {
      const u = new URL(url);
      const slug = u.pathname.replace(/\/+$/, '').split('/').pop();
      if (slug) {
        for (const type of ['pages', 'posts']) {
          const r = await fetch(`${u.origin}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}`, {
            headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
          });
          if (!r.ok) continue;
          const items = await r.json();
          if (Array.isArray(items) && items.length) {
            writeJsonAtomic(join(outDir, 'rest.json'), items[0]);
            break;
          }
        }
      }
    } catch { /* best effort — skip silently */ }
  }

  writeJsonAtomic(join(outDir, 'capture-meta.json'), {
    captured_at: new Date().toISOString(),
    source_url: url,
    viewports: viewports.map((v) => v.name),
    user_agent: USER_AGENT,
    sample_rects: sampleRects,
  });
  return { outDir, viewports: viewports.map((v) => v.name) };
}

async function main() {
  const args = process.argv.slice(2);
  let id = null;
  let calibrate = false;
  let urlOverride = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--calibrate') calibrate = true;
    else if (args[i] === '--url') urlOverride = args[++i];
    else if (!id) id = args[i];
    else die(3, `capture: unexpected argument "${args[i]}"`);
  }
  if (!id) die(3, 'usage: capture.mjs <id> [--calibrate] [--url <override>]');

  const config = readConfig();
  const { maskRules, thresholds } = loadTunables();
  const row = resolveRow(id, urlOverride, config);
  const url = urlOverride || row.source_url;

  const { chromium } = requireFromProject('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const fixtureDir = join(ROOT, 'fixtures', id);
    await capturePage(browser, { url, outDir: fixtureDir, config, maskRules, thresholds });
    const lines = [
      `captured ${id} ← ${url}`,
      `fixtures: ${fixtureDir}`,
      `viewports: ${(thresholds.viewports || []).map((v) => v.name).join(', ')}`,
    ];
    if (calibrate) {
      const recheckDir = join(ROOT, 'fixtures', `${id}.recheck`);
      await capturePage(browser, { url, outDir: recheckDir, config, maskRules, thresholds });
      lines.push(`recheck:  ${recheckDir} (run compare.mjs ${id} --calibrate to verify determinism)`);
    }
    summary(lines);
  } finally {
    await browser.close().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => die(3, `capture: harness error — ${e.stack || e.message}`));
}
