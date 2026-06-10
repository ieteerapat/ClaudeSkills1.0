# Source adapter: generic-crawl

Fallback when no content API exists (REST disabled, non-WP site, frontend-only
access). Capture-first: the rendered DOM fixture IS the content source.

## Enumeration (seed.mjs)

- sitemap.xml if present; otherwise BFS crawl from the homepage following
  same-origin links, respecting robots.txt, depth-capped, deduped by
  normalized URL (strip tracking params per mask-rules).
- hreflang/locale patterns discovered during crawl define page × locale rows.

## Locales — copy, never translate

Extract each locale from its real rendered page, per config `locale_mechanism`:
distinct URL → fetch it; cookie/JS switcher → drive the switcher in the same
Playwright session, then capture; Accept-Language → capture with the header
set. Missing translation = flagged gap in the manifest, never filled by
translating another locale's text.

## Extraction (extract.mjs)

- Source: the captured rendered DOM (atomic with fixtures — same Playwright
  session, same moment).
- Identify the content region: largest article-like container (main, article,
  content-density heuristic). Chrome (header/nav/footer) is NOT content — it is
  rebuilt once in Phase 1.5.
- Convert content region → MDX. Preserve heading hierarchy, lists, tables,
  blockquotes, figure/figcaption.
- Frontmatter from HEAD: title, meta description, canonical, OG set, JSON-LD
  blocks (carried verbatim for re-emission), published/modified times if
  present in meta or schema.
- Confidence is inherently lower than an API adapter: log extraction decisions
  per page; ambiguous content boundaries → flag in the manifest entry.

## Media + links

Same rules as the wordpress adapter: self-host source-domain assets, keep
third-party embeds, rewrite internal links via url-map, inventory everything.

## Politeness

Same throttle/UA/cache rules as the wordpress adapter. The crawl runs ONCE to
seed; per-page capture happens later in the loop — do not crawl repeatedly.
