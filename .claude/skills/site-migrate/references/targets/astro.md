# Target adapter: Astro (static)

For static migrations targeting Astro. Same fidelity/SEO rules as any target;
this file holds only the Astro-specific conventions.

## Conventions

- Static generation for every public route. Islands (`client:*`) only for
  genuine interactivity (form, search, slider). No site-wide client-state
  framework — if a page is app-shaped (auth, cart, dashboard), stop and flag:
  it may not belong in the static migration.
- Content collections: `content/` MDX with a zod schema mirroring the
  extraction frontmatter (title, description, canonical, og, schema, locale,
  type, source_url, captured_at).
- Design tokens (Phase 1.5): derive from `fixtures/<id>/authored-css.json`
  (custom properties, rem/em type scale, real media-query breakpoints,
  @font-face) — NOT computed styles, which flatten everything to px and lose
  var()/clamp()/breakpoints. Computed styles.json is a cross-check only.
- Per-type templates (Phase 1.5): one layout per manifest `type` in
  `src/layouts/`; shared chrome in `src/components/`.
- i18n: mirror source locale URL structure as literal route dirs
  (`src/pages/en/...`), hreflang from url-map.
- Images: `astro:assets` with downloaded `public-assets/` sources; fonts
  self-hosted WOFF2 + preload.
- Search: Pagefind (build-time index) if source has search. RSS: @astrojs/rss
  if source exposes feeds (preserve feed URLs via redirects).
- SEO: canonical/OG via a shared Head component; JSON-LD re-emitted verbatim
  with url-map-rewritten URLs; sitemap via @astrojs/sitemap, robots.txt static.
- Redirects: host-level from urlmap.mjs (Netlify `_redirects` / vercel.json /
  Cloudflare), not Astro middleware.
