# Target adapter: Next.js + Tailwind, static export

For fully static migrations (`output: 'export'` in next.config). No CMS, no
server runtime. Optimize for fastest possible load; SEO equal-or-better.

## Hard constraints of static export (violating these = build/runtime surprises)

- `next.config`: `output: 'export'`, `trailingSlash` matched to the SOURCE
  site's URL style (parity of exact URLs matters for SEO).
- **No runtime redirects/headers/rewrites from next.config** — redirects are
  emitted host-level by urlmap.mjs (`_redirects`, `vercel.json`, nginx — per
  config hosting).
- **Image optimizer is disabled.** Pre-optimize at build: sharp → WebP/AVIF
  variants + width set, emit `<Image unoptimized>` or plain `<picture>` with
  srcset. LCP image: priority + preload. Media files come from
  `public-assets/` (already downloaded/optimized by the media step).
- No dynamic routes without `generateStaticParams`; every manifest route must
  statically resolve. API routes don't exist — forms follow config form_policy.
- ARCHIVES / pagination (listing pages — blog, category, tag, date): content is
  DERIVED from posts, not authored. Pre-generate every page (`page/2…N`) via
  generateStaticParams so each paginated route exists statically. Parity for a
  listing is a different shape: match the ITEM SET (which posts, in what order)
  + counts + excerpts/thumbnails, not prose-body diffing. RULE: an archive is
  parity-checked ONLY after every post it lists is `parity_passed` — its
  member pages are a dependency. Until then it stays pending (not failed). The
  loop should order archives after their members, or skip-and-revisit when a
  member is still unmigrated. This compares like-for-like and avoids false
  failures from half-migrated listings.
- Third-party IDs/keys come from env vars (`NEXT_PUBLIC_*` for public Tier-1
  IDs like GTM/GA; `.env.local` for Tier-2/3) — NEVER hardcode a key in a
  component. See references/integrations.md + migration/integrations.json.
  GTM/GA via @next/third-parties or a Script with `strategy="afterInteractive"`.

## Structure

- App Router. `content/` MDX consumed at build (contentlayer-style or direct
  MDX imports — pick once in Phase 1.5, record in CC-Session-Logs decision).
- i18n: NO next.config i18n (incompatible with export). Mirror the source's
  locale URL structure as literal route segments (e.g. `app/[locale]/...` with
  generateStaticParams over config locales, or duplicated trees if structures
  differ per locale). hreflang emitted per page from the url-map.
- RTL: for any locale in config `rtl_locales` (ar/he/fa/ur…), render
  `<html dir="rtl" lang="…">` and use logical CSS / Tailwind `rtl:` variants
  and `ms-`/`me-` (inline-start/end) utilities — never hardcoded left/right.
  The source already serves RTL for these locales, so the captured fixture is
  RTL; an LTR-built RTL page simply fails parity against its own fixture (the
  gate working correctly). No parity-harness change is needed.
- Per-type templates (Phase 1.5): one layout component per manifest `type`.
  Pages compose template + shared chrome + MDX body. The first page of a type
  defines the template; later pages of that type reuse it unchanged.

## Design tokens (Phase 1.5)

- Source = `fixtures/<id>/authored-css.json` (AUTHORED values), NOT computed
  styles. It carries: `custom_properties` (the source's token system — map
  these into `theme` keeping the relationships and, where useful, the names),
  `type_scale` (rem/em — preserve the unit, don't bake to px), `spacing`,
  `breakpoints` (the REAL media-query breakpoints → `theme.screens`, not the
  capture viewports), `font_faces` (self-host these), and `fetched_sheets`
  (raw CSS from cross-origin theme/CDN sheets for anything not in the above).
- Palette → `theme.colors` from the source's exact values (C.I. fidelity, no
  Tailwind default approximations). Computed `styles.json` is a cross-check
  for values the authored CSS leaves implicit, never the primary source.
- Fonts: self-host (download WOFF2, `next/font/local` or @font-face +
  preload). Never hotlink source-domain fonts; Google Fonts via next/font.
- MULTI-SCRIPT payload (Latin + Thai + Arabic + CJK): naive self-hosting of all
  @font-face files tanks the perf gate — CJK faces are MBs. Subset per script
  and gate with `unicode-range` so a browser downloads only the script(s) a
  page needs; load each locale's font only on that locale's routes. This is a
  hard requirement when seo_bar=equal_or_better — the "fastest load" goal and a
  multi-MB font payload are in direct conflict; subsetting resolves it.

## SEO mapping (per page — see also references/seo-rules.md)

- Metadata API: title, description, canonical (from url-map TARGET url),
  full OG/Twitter set copied from fixture values.
- JSON-LD: re-emit captured schema blocks as `<script type="application/ld+json">`
  via a component, with URLs rewritten through the url-map.
- Generate sitemap.xml + robots.txt at build from the manifest.

## Performance bar ("fastest possible load")

- Zero client JS by default: Server Components everywhere; `'use client'` only
  for genuinely interactive islands (slider, form, locale switcher if needed).
- No site-wide state libs, no CSS-in-JS runtime. Tailwind + static HTML.
- Animations: reproduce CSS motion from authored-css.json — copy the source
  `@keyframes` VERBATIM (same names + step bodies) and reapply the same
  animation/transition signatures (duration/easing/delay/property). The
  `animations` parity dimension diffs these definitions (screenshots freeze
  motion, so definitions are the only verifiable record). JS-driven source
  animations (GSAP/sliders/scroll-triggers) → needs_human per SKILL.md.
- Budget check is part of parity when seo_bar=equal_or_better: LCP/CLS/TBT and
  Lighthouse scores must be ≥ source baseline.
