# SEO rules — URL map, redirects, meta parity, cutover

SEO equity loss is the highest-stakes irreversible failure of a migration.
The build is cheap by comparison. Hence: URL map first, human-gated.

## URL map (urlmap.mjs → migration/url-map.json)

- One row per (source_url, locale) → target_path. Default: PRESERVE the path
  exactly. Only restructure when the user explicitly opts in at intake, and
  then every changed URL gets a 301.
- The url-map is SACRED: extraction, builds, internal-link rewriting, hreflang,
  canonicals, and redirects all read from it. Never invent a URL inline.
- Access via manifest.mjs/urlmap CLI — never Read url-map.json into context.

## Redirect plan (host-level — static export has no runtime)

- 301 for every URL whose path changes; also the classic WP long tail:
  `/?p=<id>` forms, `/feed/` variants, paginated archives, uploads paths that
  moved to `public-assets/`.
- Emission format by config hosting: Netlify `_redirects` | `vercel.json` |
  Cloudflare `_redirects` | nginx map. Generated, committed, deployed with the
  site, and smoke-tested (every redirect resolves) in Phase 4.

## Link classification (used by extract.mjs, urlmap.mjs, smoke.mjs)

Decided by URL host after normalization (resolve relative URLs against the
page URL; treat http/https and www/no-www as the same host):

- **Internal** — relative URLs, or absolute URLs whose host = source domain
  (incl. www variant). → Rewrite through the url-map to the target path.
- **Source media/CDN** (uploads paths, cdn.<source> hosts) → media policy:
  becomes a self-hosted `public-assets/` path, never a hotlink.
- **Source SUBDOMAINS** (blog., shop.) → ambiguous; intake decides per
  subdomain: in-scope (rows in manifest) or external. Never guess.
- **Special schemes** — `mailto:`, `tel:`, `line:`, `#anchor` → preserve
  verbatim. In-page anchors require heading/element ids to survive the
  rebuild (the `links` parity dimension checks this).
- **External** (any other host) → INCLUDED in the rebuilt page, copied
  verbatim: same href, same anchor text, same `rel`
  (nofollow/sponsored/noopener) and `target` attributes — link-equity
  signals are part of SEO parity. "External" only changes what we DON'T do:
  no url-map rewrite, no crawling/migrating the destination. Never drop an
  external link from the build.

The `links` parity dimension verifies the FULL link inventory per page —
internal and external — href + rel + target + anchor text. A missing or
altered external link fails parity like any other difference.

**Internal-but-not-in-manifest** is a triage, not a default: missed page
(seed gap → add the row), excluded page (CUTOVER HAZARD — the link will die
with the old site; intake's exclusion answer must say keep-to-old-domain /
drop / redirect), or dead on source (preserve + log; don't "fix" content).

## Per-page meta parity (enforced by compare.mjs `seo_meta` dimension)

- Exact match required: title, meta description, canonical (rewritten through
  url-map), OG/Twitter set, robots meta, hreflang cluster.
- JSON-LD (Article/Breadcrumb/FAQ/LocalBusiness): re-emit the captured blocks
  with url-map-rewritten URLs; diff is structural (parsed JSON), not textual.
- Feeds: preserve RSS URLs if the source exposed them (redirect or re-emit).

## Equal-or-better gate (when seo_bar = equal_or_better)

- Per-page: Lighthouse perf/SEO scores and LCP/CLS/TBT — candidate ≥ source
  (same throttling profile both sides; source baseline captured ONCE at fixture
  time and stored, not re-measured per attempt).
- Site-wide (Phase 4): full-route sweep, plus sitemap validity and internal
  link-graph integrity (no lost inbound paths to any migrated page).

## Cutover (Phase 5 checklist)

1. Deploy to staging; run smoke.mjs against staging (routes, redirects,
   sitemap, console errors).
2. Freshness spot-check: source pages modified since their captured_at →
   re-capture + re-verify those rows only.
3. DNS flip (human). TTL lowered in advance.
4. Post-launch watch: 404 logs daily for 2 weeks (every 404 = a missed
   redirect → add it), Search Console coverage + CWV reports, re-submit
   sitemap. Keep the old host's uploads dir reachable until 404 logs go quiet.
