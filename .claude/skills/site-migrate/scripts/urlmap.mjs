#!/usr/bin/env node
// site-migrate :: urlmap — URL map + host-level redirect plan.
// Contract: references/implementation-plan.md § CLI contracts; policy per
// references/seo-rules.md: PRESERVE paths 1:1 (locale prefixes + trailing
// slashes kept as-is); restructuring is an explicit intake opt-in, not done here.
// --emit-redirects writes migration/redirects.<fmt> in the hosting provider's format.
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  ROOT, readJson, writeJsonAtomic, readConfig, MANIFEST_PATH, die, summary,
} from './lib/project.mjs';

const emitRedirects = process.argv.includes('--emit-redirects');

const config = readConfig();
const manifest = readJson(MANIFEST_PATH); // dies if absent — run seed first
const hosting = (config.target?.hosting || '').toLowerCase();

let sourceOrigin;
try {
  sourceOrigin = new URL(config.source.url);
} catch {
  die(3, 'config.source.url is not a valid URL');
}
const host = sourceOrigin.hostname;
const isWww = host.startsWith('www.');
const apex = isWww ? host.slice(4) : host;
const canonicalHost = host; // keep the source's canonical host (www/apex) as-is
const altHost = isWww ? apex : `www.${apex}`;

// --- mappings: 1:1 preserve (row.target_path is authoritative if already set) --

const mappings = manifest.pages.map((p) => ({
  id: p.id,
  locale: p.locale,
  source_path: p.source_path,
  target_path: p.target_path || p.source_path,
}));
const nonIdentity = mappings.filter((m) => m.source_path !== m.target_path);

// --- host-level redirect plan --------------------------------------------------

const hostRedirects = [
  { from: `http://${canonicalHost}/*`, to: `https://${canonicalHost}/:splat`, status: 301, reason: 'http→https' },
  { from: `http://${altHost}/*`, to: `https://${canonicalHost}/:splat`, status: 301, reason: `http+${isWww ? 'apex→www' : 'www→apex'}` },
  { from: `https://${altHost}/*`, to: `https://${canonicalHost}/:splat`, status: 301, reason: isWww ? 'apex→www' : 'www→apex' },
];

const urlMap = {
  version: 1,
  generated_at: new Date().toISOString(),
  source_url: config.source.url,
  policy: 'preserve-1:1',
  canonical_host: canonicalHost,
  hosting,
  host_redirects: hostRedirects,
  mappings,
};
const urlMapPath = join(ROOT, 'migration', 'url-map.json');
writeJsonAtomic(urlMapPath, urlMap);

// --- redirect file emission ------------------------------------------------------

let redirectPath = null;
if (emitRedirects) {
  const dir = join(ROOT, 'migration');
  mkdirSync(dir, { recursive: true });
  if (hosting === 'vercel') {
    // vercel.json "redirects" fragment. HTTPS is enforced by the platform;
    // host canonicalization uses a `has` host condition.
    const rules = [
      {
        source: '/:path*',
        has: [{ type: 'host', value: altHost }],
        destination: `https://${canonicalHost}/:path*`,
        permanent: true,
      },
      ...nonIdentity.map((m) => ({
        source: m.source_path.replace(/\/$/, '') || '/',
        destination: m.target_path,
        permanent: true,
      })),
    ];
    redirectPath = join(dir, 'redirects.vercel.json');
    writeFileSync(redirectPath, JSON.stringify({ redirects: rules }, null, 2) + '\n');
  } else if (hosting === 'netlify' || hosting === 'cloudflare') {
    const lines = [
      `# host-level canonicalization (${isWww ? 'apex→www' : 'www→apex'}, http→https)`,
      `http://${altHost}/* https://${canonicalHost}/:splat 301!`,
      `https://${altHost}/* https://${canonicalHost}/:splat 301!`,
      `http://${canonicalHost}/* https://${canonicalHost}/:splat 301!`,
      ...nonIdentity.map((m) => `${m.source_path} ${m.target_path} 301`),
    ];
    redirectPath = join(dir, 'redirects._redirects');
    writeFileSync(redirectPath, lines.join('\n') + '\n');
  } else {
    die(3, `--emit-redirects: unsupported hosting "${hosting}" (vercel | netlify | cloudflare)`);
  }
}

// --- summary ---------------------------------------------------------------------

const lines = [
  `urlmap: ${mappings.length} mappings → ${urlMapPath}`,
  `policy preserve-1:1 | non-identity mappings: ${nonIdentity.length}`,
];
for (const m of nonIdentity.slice(0, 10)) lines.push(`  ${m.source_path} → ${m.target_path}`);
lines.push(`host plan (${hosting}): canonical https://${canonicalHost} | ${hostRedirects.length} host rules (http→https, ${isWww ? 'apex→www' : 'www→apex'})`);
if (redirectPath) lines.push(`redirects emitted: ${redirectPath}`);
summary(lines);
