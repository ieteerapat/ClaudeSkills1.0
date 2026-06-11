# site-migrate — Claude Code skill (v1.8)

Stack-agnostic website migration engine for Claude Code. Migrates a site to a
new stack (e.g. WordPress → Next.js/Tailwind static, or → Astro) with near-zero
human intervention: intake-first configuration, golden-fixture capture via
Playwright, manifest-driven per-page loop, and a parity gate — a page is never
"done" until it mechanically matches the captured source within tolerance.

## v1.8 highlights

- **Locale-grouped, build-once loop** — the biggest token lever for
  multi-language sites. Locales of a page share everything but text + direction,
  so the page is built ONCE (default locale, shared `[locale]` route) and
  sibling locales are a content swap + parity, no build subagent. New
  `manifest.mjs siblings <id>` groups the locale variants. For a 6-locale site
  that's ≈6× fewer expensive builds.

## v1.7 highlights

- **Image-decode stabilization** — capture now awaits every image's load +
  `decode()` (plus `document.fonts.ready`) before screenshotting. `networkidle`
  only means bytes arrived, not painted; without this, loaded-but-undecoded
  images caused intermittent false layout diffs (esp. deep/image-heavy mobile).
  Verified: en-home mobile layout self-parity 2.09% → 0%, all 7 dimensions pass.

## v1.6 highlights

- **Animation/transition parity** — captures `@keyframes` + animation/transition
  signatures from authored CSS (screenshots freeze motion, so definitions are
  the only verifiable record) and adds an `animations` parity dimension.
  Validated: 6 keyframes + 20 motions checked, self-parity passes.

## v1.5 highlights

- **Staging noindex guard** — staging is non-indexable; cutover flips to
  indexable; smoke.mjs asserts no `noindex` ever ships to production.
- **Multi-script font subsetting**, **archive/pagination parity**, **search
  (Pagefind) intake question**, **functional consent (PDPA/GDPR) requirement** —
  surfaced as rules/decisions so they aren't late surprises.

## v1.4 highlights

- **DOM-first extraction** — REST is used only as default-locale enrichment.
  Fixes on-the-fly translation stacks (TranslatePress/WPML — REST returns the
  default language for every locale) and page builders (Bricks/Elementor —
  layout lives in postmeta, not content.rendered). Verified: an /ar/ page now
  extracts Arabic, not English.
- **RTL support** — `rtl_locales` drives `dir="rtl"` + logical-CSS builds;
  parity needs no change (each locale compares against its own fixture).
- **Authored-CSS extraction** — design tokens come from the source's real
  custom properties / rem-em scale / media-query breakpoints / @font-face,
  not computed px (which flattens rem→px and loses var()/clamp()/breakpoints).
- **Integrations & secrets handling** — three-tier model for third-party
  keys (GTM/GA public IDs, domain-restricted Maps/reCAPTCHA, server secrets);
  env-var'd, never hardcoded, gaps surfaced as owner actions.
- **HTML summary report** (`report.mjs`) at the recon gate and at wrap-up.
- **Build contract** so build subagents compose from a fixed kit, not improvise.
- Lazy per-page spawning + model tiering for token-cost discipline.

## Install

**Claude Code (global, available in every project):**
```bash
unzip site-migrate-skill.zip -d ~/.claude/skills/
```

**Claude Code (single project):**
```bash
unzip site-migrate-skill.zip -d <repo>/.claude/skills/
```

Then start a session and say "migrate this site" or invoke `/site-migrate`.

## How it works (short version)

- **Global skill, project-local state.** Invoke it from inside the project
  repo: all state (`migration.config.json`, `migration-manifest.json`,
  fixtures, reports, logs) lives in the repo, never in the skill.
- **Phases:** intake (probe + ask once) → seed + URL-map approval →
  calibration (self-parity proves the diff harness) → design-system
  extraction → pilot → cost gate → unattended per-page loop → wrap-up smoke →
  cutover checklist.
- **Honesty:** only the compare script's verdict can mark a page
  `parity_passed`. Failures route to retry (capped) or `needs_human` — the
  loop never blocks and never silently passes.
- **Four human touchpoints total:** intake answers, URL-map approval,
  post-pilot cost approval, final `needs_human` triage.

## Status

The process contract (SKILL.md + references/) is complete. The harness
scripts in `scripts/` are **stubs** — each exits 3 with a pointer to its
contract in `references/implementation-plan.md`. Implement them in the order
given there (Claude Code can do this for you: open the skill folder and ask
it to "implement the site-migrate scripts per implementation-plan.md").

## Requirements (project-level, installed at intake)

Node 20+, playwright, pixelmatch, sharp, vitest, lighthouse. A Playwright
MCP server is optional but recommended (used only for failure diagnosis).
