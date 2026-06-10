#!/usr/bin/env node
// site-migrate :: intake — source-site probe + config writer.
// Usage: intake.mjs <url> [--json] [--answers <file>]
// Without --answers: read-only except PROJECT_ROOT/reports/intake-probe.json.
// With --answers: also writes migration.config.json, copies config defaults
// into PROJECT_ROOT/migration/, and ensures .gitignore entries. Never commits.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync, appendFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SKILL_DIR, CONFIG_PATH, readJson, writeJsonAtomic, die, summary } from './lib/project.mjs';
import { politeFetch, analyzeHtml, probeSitemap, inferLocales } from './lib/probe.mjs';

// ---------- CLI ----------

const args = process.argv.slice(2);
let url = null, asJson = false, answersFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') asJson = true;
  else if (args[i] === '--answers') answersFile = args[++i] ?? die(3, '--answers requires a file path');
  else if (!url) url = args[i];
  else die(3, `unexpected argument: ${args[i]}`);
}
if (!url) die(3, 'usage: intake.mjs <url> [--json] [--answers <file>]');
let origin;
try { origin = new URL(url).origin; } catch { die(3, `invalid url: ${url}`); }
const answers = answersFile ? readJson(answersFile) : null;

// ---------- probe ----------

const report = await probe(url, origin);
const reportPath = join(ROOT, 'reports', 'intake-probe.json');
writeJsonAtomic(reportPath, report);

async function probe(url, origin) {
  const home = await politeFetch(url);
  if (!home.ok) die(3, `homepage fetch failed: ${home.status || home.error} — ${url}`);
  const page = analyzeHtml(home.text, home.url);

  // WordPress REST API
  const wpJsonRes = await politeFetch(`${origin}/wp-json`);
  let wpJson = { reachable: false, types: null };
  try {
    if (wpJsonRes.ok && JSON.parse(wpJsonRes.text)) wpJson.reachable = true;
  } catch { /* not JSON → not open */ }
  if (wpJson.reachable) {
    const typesRes = await politeFetch(`${origin}/wp-json/wp/v2/types`);
    try {
      if (typesRes.ok) wpJson.types = Object.keys(JSON.parse(typesRes.text));
    } catch { /* types endpoint closed or non-JSON */ }
  }

  // robots.txt
  const robotsRes = await politeFetch(`${origin}/robots.txt`);
  const robotsPresent = robotsRes.ok && !/<html/i.test(robotsRes.text);
  const robotsSitemaps = robotsPresent
    ? [...robotsRes.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1])
    : [];

  // sitemap (follows a sitemap index one level)
  const sitemap = await probeSitemap(origin, robotsSitemaps);

  // contact-like page forms
  const contactCandidates = sitemap.urls.filter((u) => /contact|inquiry|booking/i.test(u));
  let contactPage = null;
  if (contactCandidates.length) {
    const res = await politeFetch(contactCandidates[0]);
    contactPage = res.ok
      ? { url: contactCandidates[0], forms: analyzeHtml(res.text, res.url).forms }
      : { url: contactCandidates[0], forms: [], error: `HTTP ${res.status || res.error}` };
  }

  const locales = inferLocales(page.hreflang, home.url, page.htmlLang);
  const wpGenerator = page.generators.find((g) => /wordpress/i.test(g));
  const wordpress = page.wordpress || wpJson.reachable;

  return {
    probed_at: new Date().toISOString(),
    url: home.url,
    generator: {
      meta: page.generators,
      wordpress,
      wordpress_version: wpGenerator?.match(/wordpress\s+([\d.]+)/i)?.[1] ?? null,
    },
    wp_json: wpJson,
    robots: { present: robotsPresent, sitemaps: robotsSitemaps },
    sitemap: {
      url: sitemap.url, type: sitemap.type,
      subsitemaps: sitemap.subsitemaps, total_urls: sitemap.total_urls,
    },
    locales: {
      html_lang: page.htmlLang,
      hreflang: page.hreflang,
      locales: locales.locales,
      default_locale: locales.default_locale,
      locale_urls: locales.locale_urls,
      mechanism: locales.mechanism,
      mechanism_note: locales.mechanism_note,
    },
    forms: { homepage: page.forms, contact_page: contactPage },
    embeds: {
      iframes: page.iframes,
      third_party_script_domains: page.thirdPartyScriptDomains,
    },
    animation: page.animation,
    consent_banner: page.consentBanner,
    ci: { provider: detectCiProvider() },
  };
}

function detectCiProvider() {
  try {
    const out = execSync('git remote -v', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    // loose match: SSH host aliases (git@github-work:…) are common
    if (/github/i.test(out)) return 'github';
    if (/bitbucket/i.test(out)) return 'bitbucket';
    if (/gitlab/i.test(out)) return 'gitlab';
  } catch { /* not a repo or no git */ }
  return 'none';
}

// ---------- config (only with --answers) ----------

if (answers) writeConfigAndScaffold(report, answers);

function writeConfigAndScaffold(report, answers) {
  const missing = ['target', 'seo_bar', 'fidelity'].filter((k) => answers[k] == null);
  const formsFound = report.forms.homepage.length + (report.forms.contact_page?.forms.length ?? 0);
  if (formsFound > 0 && answers.form_policy == null) missing.push('form_policy (forms detected — mandatory)');
  if (missing.length) die(3, `answers file missing required keys: ${missing.join(', ')}`);
  if (report.locales.mechanism === 'unknown' && !answers.locale_mechanism) {
    die(3, 'locale mechanism could not be auto-detected (js-switcher or accept-language) — set "locale_mechanism" in the answers file');
  }

  const config = {
    version: 1,
    source: { url: report.url, adapter: report.generator.wordpress ? 'wordpress' : 'generic-crawl' },
    target: {
      framework: '', css: '', rendering: 'static-export', hosting: '', cms: 'none',
      ...answers.target,
    },
    locales: answers.locales ?? report.locales.locales,
    default_locale: answers.default_locale ?? report.locales.default_locale,
    locale_mechanism: answers.locale_mechanism ?? report.locales.mechanism,
    seo_bar: answers.seo_bar,
    fidelity: answers.fidelity,
    form_policy: answers.form_policy ?? { default: '', per_form: {} },
    media_policy: answers.media_policy ?? 'self-host source-domain assets; keep third-party embeds',
    exclusions: answers.exclusions ?? [],
    attempt_cap: answers.attempt_cap ?? 2,
    urlmap_approved: false,
    auto_approve_urlmap: answers.auto_approve_urlmap ?? false,
    ci: { provider: report.ci.provider },
    pilot_pages: answers.pilot_pages ?? [],
  };
  writeJsonAtomic(CONFIG_PATH, config);

  // copy pristine default templates → PROJECT_ROOT/migration/ (never clobber)
  const migrationDir = join(ROOT, 'migration');
  mkdirSync(migrationDir, { recursive: true });
  for (const name of readdirSync(join(SKILL_DIR, 'config'))) {
    if (!name.endsWith('.default.json')) continue;
    const dest = join(migrationDir, name.replace('.default.json', '.json'));
    if (!existsSync(dest)) copyFileSync(join(SKILL_DIR, 'config', name), dest);
  }

  // ensure .gitignore covers fixtures + diff images (append only what's missing)
  const gitignorePath = join(ROOT, '.gitignore');
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  const lines = new Set(existing.split('\n').map((l) => l.trim()));
  const toAdd = ['fixtures/', 'reports/**/diff-images/'].filter((l) => !lines.has(l));
  if (toAdd.length) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    appendFileSync(gitignorePath, `${prefix}${toAdd.join('\n')}\n`);
  }
}

// ---------- output ----------

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const g = report.generator;
  const loc = report.locales;
  const libs = Object.entries(report.animation.lib_refs)
    .filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(' ') || 'none';
  const lines = [
    `intake probe: ${report.url}`,
    `generator: ${g.meta[0] ?? (g.wordpress ? 'WordPress (wp-content paths)' : 'unknown')}`,
    `wp-json: ${report.wp_json.reachable ? `open${report.wp_json.types ? ` (${report.wp_json.types.length} types)` : ''}` : 'not reachable'}`,
    `sitemap: ${report.sitemap.type === 'none' ? 'not found' : `${report.sitemap.type}, ${report.sitemap.subsitemaps.length} sub-sitemaps, ${report.sitemap.total_urls} URLs`}`,
    `robots.txt: ${report.robots.present ? 'present' : 'missing'}`,
    `locales: ${loc.locales.join(', ')} (default ${loc.default_locale}) — mechanism: ${loc.mechanism}${loc.mechanism_note ? ' [NEEDS CONFIRMATION]' : ''}`,
    `forms: ${report.forms.homepage.length} on homepage; ${report.forms.contact_page ? `${report.forms.contact_page.forms.length} on ${new URL(report.forms.contact_page.url).pathname}` : 'no contact-like page found'}`,
    `embeds: ${report.embeds.iframes.length} iframes; ${report.embeds.third_party_script_domains.length} third-party script domains`,
    `animation: lib refs ${libs}; css animation:${report.animation.css_animation_refs} transition:${report.animation.css_transition_refs}`,
    `consent banner: ${report.consent_banner ? 'detected' : 'not detected'}`,
    `ci provider: ${report.ci.provider}`,
    `report: ${reportPath}`,
    answers ? `config written: ${CONFIG_PATH} (+ migration/ defaults, .gitignore)` : 'no --answers file — migration.config.json NOT written (probe only)',
  ];
  summary(lines);
}
