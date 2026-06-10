# Source adapter: WordPress

Used when intake detects WP (generator meta, /wp-json, wp-content paths).

## Enumeration (seed.mjs)

- Primary: `GET /wp-json/wp/v2/posts?per_page=100&page=N` + `/pages` +
  `/categories` + `/tags` (paginate via X-WP-TotalPages header).
- Cross-check against sitemap.xml — REST shows content objects, sitemap shows
  routes; union is the scope, mismatches get logged.
- Locale plugins (WPML/Polylang): locale routes appear in sitemap/hreflang, not
  always in REST. Manifest rows are page × locale; mirror the source's locale
  URL structure exactly.

## Locales — copy, never translate

Each locale row is extracted from that locale's REAL source: WPML/Polylang
expose per-locale REST objects or distinct URLs — fetch the locale's own
content (config `locale_mechanism` says how: URL, switcher-drive, or
Accept-Language header). If a page has no translation in some locale, record
it in the partial-translation inventory and flag the manifest row — NEVER
generate the missing locale by translating. Model translation is invented
content (fidelity violation) and a token sink.

## Content extraction (extract.mjs) — DOM-first, REST as default-locale enrichment

REST is NOT universally reliable for this stack. Two failure modes determine
the strategy (extract.mjs implements this — DOM-first by default):
- **Page builders (Bricks/Elementor/Divi):** layout lives in postmeta, so
  `content.rendered` is empty or partial for builder-built page types. Detect
  `brxe-`/`elementor-`/`et_pb_` classes in the captured DOM → extract body from
  the rendered-DOM fixture, stripping the builder's layout wrappers but keeping
  content.
- **TranslatePress/WPML on-the-fly translation:** REST `?slug=` returns the
  DEFAULT language for every locale (no `lang`/`translations` fields). So for
  any non-default locale, REST yields the WRONG language — extract from that
  locale's rendered-DOM fixture (captured at the prefixed URL) instead.

Rule: REST `content.rendered` is used ONLY when (a) default locale AND (b) the
body is substantial (>200 text chars). Otherwise the per-locale DOM fixture is
the source of truth. Metadata still usable from REST for the default locale:
title, slug, date, excerpt → frontmatter. HEAD meta (canonical/OG/schema) comes
from the captured per-locale HEAD regardless.
- SEO plugin meta (Yoast/RankMath): exposed via REST `yoast_head_json` or
  similar if present; otherwise harvest canonical/OG/schema from the captured
  fixture HEAD (fixture is atomic with extraction, so it's consistent).
- ACF fields: WITHOUT admin access they are absent from public REST. Fallback:
  extract from the captured rendered DOM, and LOG that the field came from DOM
  (lower confidence). Flag heavy ACF pages in the manifest.

## HTML → MDX cleanup rules

- Strip WP wrappers: `wp-block-*` div soup that carries no layout, empty
  paragraphs, `&nbsp;` runs.
- Shortcodes left unrendered in REST output (`[gallery]`, `[contact-form-7]`,
  plugin shortcodes): each must map to a target component or be flagged — an
  unrendered shortcode in output text is an automatic parity failure later, so
  resolve at extraction: render-from-fixture or component mapping.
- Media URLs: rewrite every source-domain/CDN asset URL to the self-hosted path
  in `public-assets/` and record the download in the media inventory. Keep
  third-party embeds (YouTube/Vimeo/Maps/LINE) as embeds.
- srcset/sizes: capture the largest source, regenerate variants at build.
- Links: classify per references/seo-rules.md § Link classification (internal
  → url-map rewrite; external → verbatim incl. rel/target; unknown → triage).

## Politeness

- Throttle: ≥500ms between requests, single connection, identify with a custom
  UA. Cache every REST response to `fixtures/<id>/rest.json` — never re-fetch
  for retries; re-capture only when the manifest row is re-claimed.
