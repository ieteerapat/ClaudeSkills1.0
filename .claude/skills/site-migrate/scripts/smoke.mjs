#!/usr/bin/env node
// site-migrate :: smoke — site-wide checks on the built static export.
// Usage: smoke.mjs [--fast] [--ci] [--dir <export-dir>]
// Checks: manifest routes exist in export, redirects file parses, sitemap.xml +
// robots.txt + 404 exist, internal links resolve. Full mode adds a browser
// console-error pass (playwright over a local static server) and Lighthouse
// (skipped if not installed). --ci writes reports/smoke.json.
// Exit: 0 all pass, 1 checks failed, 3 harness error.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, dirname, posix, extname } from 'node:path';
import {
  ROOT, MANIFEST_PATH, CONFIG_PATH, importFromProject, readJson, writeJsonAtomic, die, summary,
} from './lib/project.mjs';

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const FAST = argv.includes('--fast');
const CI = argv.includes('--ci');
let exportDir = null;
const dirIdx = argv.indexOf('--dir');
if (dirIdx !== -1) {
  if (!argv[dirIdx + 1]) die(3, 'smoke: --dir requires a path');
  exportDir = resolve(argv[dirIdx + 1]);
} else {
  for (const cand of ['out', 'dist', join('.next', 'out'), 'build']) {
    const p = join(ROOT, cand);
    if (existsSync(p) && statSync(p).isDirectory()) { exportDir = p; break; }
  }
}
if (!exportDir || !existsSync(exportDir)) {
  die(3, `smoke: no export dir found (tried --dir, out/, dist/, .next/out/, build/) — build first`);
}

// ---- check registry -----------------------------------------------------------
const checks = [];
function check(name, pass, offenders = [], note = '') {
  checks.push({ name, pass: !!pass, offenders, note });
}

// resolve a route path to a file in the export (trailing-slash agnostic)
function routeFile(route) {
  const clean = decodeURIComponent(String(route).split(/[?#]/)[0]);
  const p = posix.normalize('/' + clean).replace(/^\/+/, '');
  const candidates = p === '' || p === '.'
    ? ['index.html']
    : [p, `${p.replace(/\/$/, '')}.html`, posix.join(p, 'index.html')];
  for (const c of candidates) {
    const abs = join(exportDir, c);
    if (abs.startsWith(exportDir) && existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

// ---- 1. manifest routes ---------------------------------------------------------
const manifestDoc = readJson(MANIFEST_PATH, null);
const rows = manifestDoc == null ? []
  : Array.isArray(manifestDoc) ? manifestDoc
  : Array.isArray(manifestDoc.pages) ? manifestDoc.pages
  : Array.isArray(manifestDoc.rows) ? manifestDoc.rows : [];
if (!rows.length) {
  check('routes', true, [], 'skipped (no manifest rows)');
} else {
  const passed = rows.filter((r) => r.status === 'parity_passed');
  const scope = passed.length ? passed : rows;
  const mode = passed.length ? '' : 'report mode (no parity_passed rows yet)';
  const missing = scope
    .filter((r) => r.target_path && !routeFile(r.target_path))
    .map((r) => `${r.id} → ${r.target_path}`);
  check('routes', missing.length === 0, missing, mode || `${scope.length} routes`);
}

// ---- 2. redirects file parses ------------------------------------------------------
function checkRedirects() {
  const migDir = join(ROOT, 'migration');
  if (!existsSync(migDir)) return check('redirects', true, [], 'skipped (no migration/ dir)');
  const files = readdirSync(migDir).filter((f) =>
    f === '_redirects' || f === 'vercel.json' || f === 'redirects.json' || f.endsWith('.conf'));
  if (!files.length) return check('redirects', true, [], 'skipped (no redirects file)');
  const bad = [];
  for (const f of files) {
    const path = join(migDir, f);
    const text = readFileSync(path, 'utf8');
    try {
      if (f.endsWith('.json')) {
        const j = JSON.parse(text);
        if (f === 'vercel.json' && j.redirects !== undefined && !Array.isArray(j.redirects)) {
          bad.push(`${f}: "redirects" is not an array`);
        }
      } else if (f === '_redirects') {
        text.split('\n').forEach((line, i) => {
          const t = line.trim();
          if (!t || t.startsWith('#')) return;
          if (t.split(/\s+/).length < 2) bad.push(`_redirects:${i + 1}: needs "<from> <to> [code]"`);
        });
      } else {
        // nginx-style: braces must balance
        const open = (text.match(/{/g) || []).length;
        const close = (text.match(/}/g) || []).length;
        if (open !== close) bad.push(`${f}: unbalanced braces (${open} vs ${close})`);
      }
    } catch (e) {
      bad.push(`${f}: ${e.message}`);
    }
  }
  check('redirects', bad.length === 0, bad, files.join(', '));
}
checkRedirects();

// ---- 3. export essentials -------------------------------------------------------------
{
  const missing = [];
  if (!existsSync(join(exportDir, 'sitemap.xml'))) missing.push('sitemap.xml');
  if (!existsSync(join(exportDir, 'robots.txt'))) missing.push('robots.txt');
  if (!routeFile('/404') && !existsSync(join(exportDir, '404.html'))) missing.push('404 page');
  check('essentials', missing.length === 0, missing, 'sitemap.xml, robots.txt, 404');
}

// ---- 4. internal links ---------------------------------------------------------------
function htmlFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const allHtml = htmlFiles(exportDir);

// ---- 4a. noindex guard (catastrophic if shipped to production) -----------------------
// Production must NOT contain noindex. Staging SHOULD (config.staging_noindex).
// This asserts the cutover flip happened — a noindex tag in a production build
// silently de-indexes the whole site.
{
  const cfg = readJson(CONFIG_PATH, {});
  const noindexed = allHtml.filter((f) =>
    /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(readFileSync(f, 'utf8')));
  if (cfg.staging_noindex) {
    check('staging-noindex', true, [`${noindexed.length}/${allHtml.length} pages noindex (staging)`]);
  } else {
    check('production-indexable', noindexed.length === 0,
      noindexed.slice(0, 10).map((f) => f.replace(exportDir, '')),
      'noindex meta found in a production build — would de-index the site');
  }
}
{
  const dead = [];
  const hrefRe = /<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi;
  for (const file of allHtml) {
    const html = readFileSync(file, 'utf8');
    const fileRel = file.slice(exportDir.length + 1);
    let m;
    while ((m = hrefRe.exec(html))) {
      const href = (m[2] ?? m[3] ?? '').trim().replace(/&amp;/g, '&');
      if (!href || href.startsWith('#')) continue;
      if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(href)) continue;
      const target = href.startsWith('/')
        ? href
        : '/' + posix.join(posix.dirname('/' + fileRel), href);
      if (!routeFile(target)) dead.push(`${fileRel}: ${href}`);
    }
  }
  check('internal-links', dead.length === 0, dead, `${allHtml.length} html files scanned`);
}

// ---- 5. console errors (full mode) -----------------------------------------------------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
function startServer() {
  return new Promise((resolveStart) => {
    const server = createServer((req, res) => {
      const file = routeFile(req.url || '/') ||
        (existsSync(join(exportDir, decodeURIComponent((req.url || '/').split(/[?#]/)[0]).replace(/^\/+/, '')))
          ? join(exportDir, decodeURIComponent((req.url || '/').split(/[?#]/)[0]).replace(/^\/+/, ''))
          : null);
      if (!file || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        return res.end('not found');
      }
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolveStart(server));
  });
}

let server = null;
let origin = '';
async function keyPages() {
  const pages = ['/'];
  const seenTypes = new Set();
  for (const r of rows) {
    if (pages.length >= 5) break;
    if (!r.type || seenTypes.has(r.type) || !r.target_path) continue;
    seenTypes.add(r.type);
    if (!pages.includes(r.target_path)) pages.push(r.target_path);
  }
  return pages.slice(0, 5);
}

if (!FAST) {
  server = await startServer();
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser = null;
  try {
    const { chromium } = await importFromProject('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    let current = '';
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`${current}: ${msg.text().slice(0, 120)}`); });
    page.on('pageerror', (err) => errors.push(`${current}: ${String(err).slice(0, 120)}`));
    const targets = await keyPages();
    for (const p of targets) {
      current = p;
      await page.goto(origin + p, { waitUntil: 'load', timeout: 30000 }).catch((e) => errors.push(`${p}: ${e.message.slice(0, 120)}`));
    }
    check('console-errors', errors.length === 0, errors, `${targets.length} key pages`);
  } catch (e) {
    await browser?.close().catch(() => {});
    server.close();
    die(3, `smoke: console-error check could not run — ${e.message}`);
  }
  await browser.close();
} else {
  check('console-errors', true, [], 'skipped (--fast)');
}

// ---- 6. lighthouse (full mode, optional dep) ----------------------------------------------
if (!FAST) {
  const lhBin = join(ROOT, 'node_modules', '.bin', 'lighthouse');
  if (!existsSync(lhBin)) {
    console.log('lighthouse: skipped (not installed)');
    check('lighthouse', true, [], 'skipped (not installed)');
  } else {
    const { execFileSync } = await import('node:child_process');
    try {
      const out = execFileSync(lhBin, [
        `${origin}/`, '--quiet', '--output=json',
        '--chrome-flags=--headless --no-sandbox',
        '--only-categories=performance,seo,accessibility',
      ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
      const lhr = JSON.parse(out);
      const scores = Object.entries(lhr.categories || {})
        .map(([k, v]) => `${k}=${Math.round((v.score || 0) * 100)}`).join(' ');
      check('lighthouse', true, [], scores);
    } catch (e) {
      check('lighthouse', false, [`lighthouse run failed: ${e.message.slice(0, 160)}`]);
    }
  }
} else {
  check('lighthouse', true, [], 'skipped (--fast)');
}
server?.close();

// ---- report ------------------------------------------------------------------------------
const failed = checks.filter((c) => !c.pass);
if (CI) {
  writeJsonAtomic(join(ROOT, 'reports', 'smoke.json'), {
    ok: failed.length === 0,
    export_dir: exportDir,
    fast: FAST,
    generated_at: new Date().toISOString(),
    checks,
  });
}
const lines = [`smoke ${FAST ? '--fast ' : ''}on ${exportDir.replace(ROOT + '/', '')} — ${failed.length ? 'FAIL' : 'PASS'}`];
for (const c of checks) {
  lines.push(`  ${c.pass ? 'pass' : 'FAIL'} ${c.name}${c.note ? ` (${c.note})` : ''}${c.offenders.length ? ` — ${c.offenders.length} offender(s)` : ''}`);
  for (const o of c.offenders.slice(0, 3)) lines.push(`    - ${o}`);
}
summary(lines);
process.exit(failed.length ? 1 : 0);
