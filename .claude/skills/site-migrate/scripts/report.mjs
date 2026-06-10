#!/usr/bin/env node
// site-migrate :: report — self-contained HTML summary of the migration state.
// Reads config + manifest + url-map (all on disk); writes a standalone HTML
// file (inline CSS, no deps, no JS). Useful at two checkpoints:
//   - after seed + urlmap (information-gathering done) → scope/recon summary
//     the human reviews before approving the URL map
//   - at wrap-up → final results (passed / failed / needs_human)
// It simply renders whatever state the manifest is in.
//
// Usage: node report.mjs [--open]
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  ROOT, readJson, writeJsonAtomic, CONFIG_PATH, MANIFEST_PATH, die, summary,
} from './lib/project.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const config = readJson(CONFIG_PATH, null);
if (!config) die(3, 'no migration.config.json — run intake first (Phase 0)');
const manifest = readJson(MANIFEST_PATH, { pages: [] });
const urlMap = readJson(join(ROOT, 'migration', 'url-map.json'), null);
const integrations = readJson(join(ROOT, 'migration', 'integrations.json'), null);

const pages = manifest.pages || [];
const generatedAt = new Date().toISOString();

// ---- aggregates ----
const count = (pred) => pages.filter(pred).length;
const groupCount = (key) => {
  const m = {};
  for (const p of pages) { const k = p[key] ?? '—'; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};
const byStatus = groupCount('status');
const byType = groupCount('type');
const byLocale = groupCount('locale');

const STATUS_COLOR = {
  pending: '#94a3b8', claimed: '#0ea5e9', in_progress: '#0ea5e9', built: '#6366f1',
  parity_passed: '#16a34a', failed: '#dc2626', needs_human: '#d97706',
  needs_reverify: '#a855f7',
};

const passed = count((p) => p.status === 'parity_passed');
const pct = pages.length ? Math.round((passed / pages.length) * 100) : 0;
const nonIdentityRedirects = urlMap
  ? (urlMap.mappings || []).filter((m) => m.source_path !== m.target_path).length : null;

// ---- flags / blockers ----
const gaps = pages.filter((p) => (p.gaps || []).length);
const needsHuman = pages.filter((p) => p.status === 'needs_human');
const failed = pages.filter((p) => p.status === 'failed');

// ---- HTML pieces ----
const bar = (rows, colorFor) => {
  const total = rows.reduce((n, [, c]) => n + c, 0) || 1;
  const seg = rows.map(([k, c]) =>
    `<div class="seg" style="width:${(c / total) * 100}%;background:${colorFor(k)}" title="${esc(k)}: ${c}"></div>`).join('');
  const legend = rows.map(([k, c]) =>
    `<li><span class="dot" style="background:${colorFor(k)}"></span>${esc(k)} <b>${c}</b></li>`).join('');
  return `<div class="bar">${seg}</div><ul class="legend">${legend}</ul>`;
};

const kv = (label, value) => `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
const chip = (s) => `<span class="chip">${esc(s)}</span>`;

const configRows = [
  kv('Source', `<a href="${esc(config.source?.url)}">${esc(config.source?.url)}</a> <span class="muted">(${esc(config.source?.adapter)})</span>`),
  kv('Target', `${esc(config.target?.framework)} + ${esc(config.target?.css)} · ${esc(config.target?.rendering)} · CMS: ${esc(config.target?.cms)}`),
  kv('Hosting', esc(config.target?.hosting || '—')),
  kv('Locales', `${(config.locales || []).map(chip).join(' ')} <span class="muted">mechanism: ${esc(config.locale_mechanism || '—')}</span>`),
  kv('SEO bar', `<b>${esc(config.seo_bar)}</b>${config.seo_bar === 'equal_or_better' ? ' <span class="muted">(Lighthouse/CWV ≥ source enforced)</span>' : ''}`),
  kv('Fidelity', (config.fidelity || []).map(chip).join(' ')),
  kv('Form policy', esc(config.form_policy?.default || '—')),
  kv('Media policy', esc(config.media_policy || '—')),
  kv('Exclusions', (config.exclusions || []).length ? (config.exclusions).map(chip).join(' ') : '<span class="muted">none</span>'),
  kv('CI', esc(config.ci?.provider || 'none')),
].join('');

const flagSection = (title, list, render) => list.length
  ? `<h3>${esc(title)} <span class="count">${list.length}</span></h3><ul class="flags">${list.map(render).join('')}</ul>`
  : '';

const pageRows = pages.map((p) => `<tr>
  <td><code>${esc(p.id)}</code></td>
  <td>${esc(p.type)}</td>
  <td>${esc(p.locale)}</td>
  <td class="path">${esc(p.source_path)} → ${esc(p.target_path)}</td>
  <td><span class="status" style="--c:${STATUS_COLOR[p.status] || '#888'}">${esc(p.status)}</span></td>
  <td>${p.attempts || 0}</td>
</tr>`).join('');

const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Migration summary — ${esc(config.source?.url)}</title>
<style>
  :root{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b}
  body{margin:0;background:#f8fafc;line-height:1.5}
  .wrap{max-width:1000px;margin:0 auto;padding:32px 24px 64px}
  h1{font-size:24px;margin:0 0 4px}.sub{color:#64748b;margin:0 0 24px;font-size:14px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 28px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
  .card .n{font-size:28px;font-weight:700}.card .l{color:#64748b;font-size:13px}
  .card.ok .n{color:#16a34a}.card.warn .n{color:#d97706}.card.bad .n{color:#dc2626}
  section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 20px}
  h2{font-size:16px;margin:0 0 14px}h3{font-size:14px;margin:18px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;color:#64748b;font-weight:500;vertical-align:top;padding:6px 12px 6px 0;white-space:nowrap}
  td{padding:6px 0}
  .bar{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:6px 0}
  .seg{height:100%}.legend{list-style:none;display:flex;flex-wrap:wrap;gap:14px;padding:0;margin:8px 0 0;font-size:13px;color:#475569}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}
  .chip{display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:1px 7px;font-size:12px;margin:1px 0}
  .muted{color:#94a3b8;font-size:13px}.count{background:#fee2e2;color:#b91c1c;border-radius:10px;padding:0 8px;font-size:12px}
  .ptable{font-size:13px}.ptable td{border-top:1px solid #f1f5f9;padding:7px 8px 7px 0}.ptable th{border-bottom:1px solid #e2e8f0;padding-bottom:8px}
  .ptable .path{color:#475569}code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px}
  .status{font-size:12px;font-weight:600;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#fff);border:1px solid color-mix(in srgb,var(--c) 30%,#fff);padding:1px 8px;border-radius:6px}
  .flags{margin:0;padding-left:18px;font-size:13px;color:#475569}
  a{color:#0ea5e9}
</style>
<div class="wrap">
  <h1>Migration summary</h1>
  <p class="sub">${esc(config.source?.url)} → ${esc(config.target?.framework)} · generated ${esc(generatedAt)}</p>

  <div class="cards">
    <div class="card"><div class="n">${pages.length}</div><div class="l">pages × locale</div></div>
    <div class="card ok"><div class="n">${passed}</div><div class="l">parity passed (${pct}%)</div></div>
    <div class="card warn"><div class="n">${needsHuman.length}</div><div class="l">needs human</div></div>
    <div class="card bad"><div class="n">${failed.length}</div><div class="l">failed</div></div>
    ${nonIdentityRedirects != null ? `<div class="card"><div class="n">${nonIdentityRedirects}</div><div class="l">301 redirects</div></div>` : ''}
  </div>

  <section><h2>Configuration</h2><table>${configRows}</table></section>

  <section>
    <h2>Scope</h2>
    <h3>By status</h3>${bar(byStatus, (k) => STATUS_COLOR[k] || '#888')}
    <h3>By type</h3>${bar(byType, () => '#6366f1')}
    <h3>By locale</h3>${bar(byLocale, () => '#0ea5e9')}
  </section>

  ${(gaps.length || needsHuman.length || failed.length || (config.exclusions || []).length) ? `<section>
    <h2>Flags &amp; blockers</h2>
    ${flagSection('Content gaps (e.g. missing translation, DOM-sourced fields)', gaps, (p) => `<li><code>${esc(p.id)}</code>: ${esc((p.gaps || []).join(', '))}</li>`)}
    ${flagSection('Needs human', needsHuman, (p) => `<li><code>${esc(p.id)}</code> — ${esc(p.target_path)}</li>`)}
    ${flagSection('Failed (attempts exhausted)', failed, (p) => `<li><code>${esc(p.id)}</code> — ${esc(p.target_path)} (${p.attempts})</li>`)}
    ${(config.exclusions || []).length ? `<h3>Excluded from migration</h3><ul class="flags">${config.exclusions.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
  </section>` : ''}

  ${Array.isArray(integrations) && integrations.length ? `<section>
    <h2>Integrations &amp; keys <span class="muted">(${integrations.length})</span></h2>
    <table class="ptable">
      <tr><th>name</th><th>tier</th><th>env var</th><th>status</th><th>action</th></tr>
      ${integrations.map((i) => `<tr>
        <td>${esc(i.name)}</td><td>${esc(i.tier)}</td><td><code>${esc(i.env_var || '—')}</code></td>
        <td><span class="status" style="--c:${i.status === 'ok' ? '#16a34a' : i.status === 'needs_owner' ? '#d97706' : '#dc2626'}">${esc(i.status)}</span></td>
        <td class="muted">${esc(i.action || '')}</td></tr>`).join('')}
    </table>
  </section>` : ''}

  <section>
    <h2>Pages <span class="muted">(${pages.length})</span></h2>
    <table class="ptable">
      <tr><th>id</th><th>type</th><th>loc</th><th>path</th><th>status</th><th>att</th></tr>
      ${pageRows || '<tr><td colspan="6" class="muted">no pages yet — run seed.mjs</td></tr>'}
    </table>
  </section>
</div></html>`;

const outDir = join(ROOT, 'reports');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'migration-summary.html');
writeFileSync(outPath, html);

summary([
  `wrote ${outPath}`,
  `pages: ${pages.length} | passed: ${passed} (${pct}%) | needs_human: ${needsHuman.length} | failed: ${failed.length}`,
  nonIdentityRedirects != null ? `redirects: ${nonIdentityRedirects}` : 'url-map: not generated yet',
]);

if (process.argv.includes('--open')) {
  const { spawn } = await import('node:child_process');
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [outPath], { detached: true, stdio: 'ignore' }).unref();
}
