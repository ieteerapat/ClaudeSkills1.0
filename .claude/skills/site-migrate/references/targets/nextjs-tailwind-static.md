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

## Structure

- App Router. `content/` MDX consumed at build (contentlayer-style or direct
  MDX imports — pick once in Phase 1.5, record in CC-Session-Logs decision).
- i18n: NO next.config i18n (incompatible with export). Mirror the source's
  locale URL structure as literal route segments (e.g. `app/[locale]/...` with
  generateStaticParams over config locales, or duplicated trees if structures
  differ per locale). hreflang emitted per page from the url-map.
- Per-type templates (Phase 1.5): one layout component per manifest `type`.
  Pages compose template + shared chrome + MDX body. The first page of a type
  defines the template; later pages of that type reuse it unchanged.

## Design tokens (Phase 1.5)

- From fixture computed styles: palette → `theme.colors` (use the SOURCE's
  exact hex values — C.I. fidelity, no Tailwind default approximations),
  font families/scale → `theme.fontFamily`/`fontSize`, spacing, breakpoints
  matched to the source's actual responsive breakpoints (from capture
  viewports), container widths.
- Fonts: self-host (download WOFF2, `next/font/local` or @font-face +
  preload). Never hotlink source-domain fonts; Google Fonts via next/font.

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
- Animations: prefer CSS (transitions/keyframes) recreated from fixture
  computed styles; JS-driven source animations are needs_human per SKILL.md.
- Budget check is part of parity when seo_bar=equal_or_better: LCP/CLS/TBT and
  Lighthouse scores must be ≥ source baseline.
