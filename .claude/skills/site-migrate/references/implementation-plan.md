# Implementation plan — build order + script contracts

Scripts are stubs (exit 3) until implemented. Truth-first order; each step has
a verify gate before the next (Karpathy: goal-driven, verifiable).

## Build order

1. **manifest.mjs** — foundation; everything reads/writes through it.
   Verify: vitest covering legal/illegal transitions, atomic claim, status math.
2. **intake.mjs** — probe + config writer. Verify: run against a live site,
   probe report correct; config validates against intake-checklist schema.
3. **capture.mjs + lib/normalize.mjs** — fixtures + masking.
   Verify: capture 2 live pages twice; normalized captures are identical
   (deterministic) — this IS the calibrate mode.
4. **compare.mjs** — diff + report + verdict. Verify: self-parity exit 0 on
   calibrated pages; report summary localizes an injected fake diff.
5. **seed.mjs + urlmap.mjs** — enumeration + URL map + redirect emission.
   Verify: vitest on URL mapping rules; counts match sitemap.
6. **extract.mjs** — adapter-routed extraction. Verify: MDX of 2 pilot pages
   passes lint, frontmatter complete, media inventory written.
7. **smoke.mjs** — fast + full modes. Verify: runs green on the pilot export;
   deliberately broken link makes it fail.
8. Hook (parity gate) + CI file emission. Verify: hook blocks a manual
   parity_passed write without a fresh passing report.

## CLI contracts

- `manifest.mjs status` → counts by status + phase hint + estimates (if pilot
  data exists). `next` → one claimable row. `get <id>` → one row.
  `claim <id> --by <agent>` → atomic or fail. `set <id> <field> <value>` —
  REFUSES status=parity_passed unless reports/<id>/parity-report.json exists,
  verdict=pass, compared_at > last build touch (code-level gate; hook is
  backstop). `mark-stale --touching <paths>` → passed pages importing those
  files → needs_reverify. `estimate` → per-type projection from pilot actuals.
- `intake.mjs <url> [--json]` → probe report; with answers file → writes
  migration.config.json + copies defaults + places .migration/smoke.mjs.
- `capture.mjs <id> [--calibrate]` → fixtures/<id>/ (screenshots×viewports,
  rendered DOM, computed styles.json [PARITY source], authored-css.json
  [DESIGN-SYSTEM source: custom props, rem/em type scale, real breakpoints,
  @font-face, fetched cross-origin sheets], a11y, HAR, HEAD meta, rest.json if
  WP) + captured_at. Atomic with extraction input. --calibrate captures twice.
  NOTE: computed styles = parity diff; authored CSS = Phase 1.5 tokens. Never
  build the theme from computed px (loses rem/var/clamp/breakpoints).
- `extract.mjs <id>` → content/<locale>/<slug>.mdx + media inventory + download
  queue processed into public-assets/.
- `compare.mjs <id> <candidate-url> [--calibrate]` → reports/<id>/ + exit 0/1/2.
- `seed.mjs` → manifest rows page×locale from adapter enumeration.
- `urlmap.mjs [--emit-redirects]` → url-map.json + host-format redirect file.
- `smoke.mjs [--fast] [--ci]` → site-wide checks; nonzero exit on failure.
- `report.mjs [--open]` → renders reports/migration-summary.html (self-contained,
  no deps) from config + manifest + url-map. Run at the URL-map gate (recon
  summary) and at wrap-up (final results). --open launches the browser.

## Statuses

pending | claimed | in_progress | built | parity_passed | failed |
needs_human | needs_reverify. Only compare.mjs verdicts move pages to
parity_passed/needs_human. attempts increments on every failed
build-or-compare cycle; attempts ≥ config.attempt_cap → needs_human.

## Dependencies (project-local, installed at intake)

playwright, pixelmatch, sharp, vitest, lighthouse (or @lhci/cli) — installed
in the PROJECT repo (CI needs them), never globally in the skill dir.
