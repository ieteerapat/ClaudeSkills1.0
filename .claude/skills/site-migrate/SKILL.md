---
name: site-migrate
description: Use when migrating a website to a new stack — running intake, capturing
  golden fixtures, extracting content, building pages, verifying parity, or resuming
  the migration loop. Stack-agnostic via adapters (source, target, CI). Reads
  migration.config.json and migration-manifest.json in the project repo to decide
  the next action. The only legitimate path to marking a migrated page done.
---

# site-migrate — stack migration engine

Goal: near-1:1 migration of a site to a new stack with near-zero human
intervention. "Done" for a page means **parity-passed**, never "built".

## Project-aware routing (this skill is global)

- `SKILL_DIR` = this skill's directory. Scripts and references live here. **Never
  write project state into the skill directory.**
- `PROJECT_ROOT` = git root of cwd (or cwd). All state lives there:
  `migration.config.json`, `migration-manifest.json`, `migration/` (mask-rules,
  thresholds), `fixtures/` (gitignored), `reports/`, `content/`, `public-assets/`,
  `CC-Session-Logs/`.

## Resume rule (always do this first)

1. No `migration.config.json` in PROJECT_ROOT → you are in **Phase 0**.
2. Otherwise run `node $SKILL_DIR/scripts/manifest.mjs status` — the manifest
   decides the phase. Never decide from memory, prose, or conversation history.

## Phases

Each phase lists: command(s) + the ONE reference to read. Do not pre-read others.

### Phase 0 — Intake (once)
- `node scripts/intake.mjs <source-url>` → probe report (generator, wp-json,
  sitemap, locales/hreflang, forms, embeds, animation surface, CI provider via
  `git remote -v`).
- Read `references/intake-checklist.md`. Ask the user ONLY the non-detectables
  (one AskUserQuestion round). Write `migration.config.json`.
- Copy `config/mask-rules.default.json` + `config/thresholds.default.json` →
  `PROJECT_ROOT/migration/`.

### Phase 1 — Seed + URL map (once, human gate)
- `node scripts/seed.mjs` → manifest rows (page × locale), full scope known.
- `node scripts/urlmap.mjs` → `migration/url-map.json` + host-level redirect plan.
- Read `references/seo-rules.md`. Set config `urlmap_approved:false`; notify the
  user; proceed only when flipped true (or `auto_approve_urlmap:true`).
- `node scripts/report.mjs` → writes `reports/migration-summary.html`: a
  self-contained HTML recon summary (config, scope by status/type/locale, URL
  map + redirect count, flags/blockers, full page list). This is the
  human-readable artifact to review at the URL-map approval gate. Information
  gathering (intake + seed + url-map) is complete at this point.

### Phase 1.25 — Calibration (once; validates the harness, attended)
- Capture 2 representative pages, then compare each **against itself**
  (`compare.mjs --calibrate`). Any diff = masking bug, not a content bug.
- Fix `migration/mask-rules.json`, re-run until self-parity is 100%. Log every
  rule added (with reason) the moment it's added.

### Phase 1.5 — Design system + build contract (once, before any page is built)
The ORCHESTRATOR lays the rails here so build subagents COMPOSE from a known
kit instead of inventing — this is the primary defense against subagents
hallucinating structure and drifting from the path.
- Read `references/targets/<target>.md`. Extract tokens from the AUTHORED CSS
  in `fixtures/<id>/authored-css.json` (custom properties, type scale in
  rem/em, spacing scale, real media-query breakpoints, @font-face) — NOT from
  computed styles. getComputedStyle flattens rem→px, drops var()/clamp(), and
  can't see breakpoints; using it builds a px-soup theme that loses the
  source's design system. Computed `styles.json` is a CROSS-CHECK / fallback
  only (gaps where the source has no token). Carry the source's own token
  NAMES where present (C.I. fidelity). Then build shared chrome (header/nav,
  footer, locale switcher) once, each verified by mini-parity; establish one
  template per manifest `type` — the FIRST page of each type is the template.
- WRITE `PROJECT_ROOT/migration/build-contract.md` — the project-specific,
  frozen rules every build subagent must obey (see references/build-contract.md
  for the required sections: file/dir layout, component inventory + import
  paths, naming conventions, the per-type template skeletons, token usage,
  island rules, what a subagent may NOT do — create new shared components,
  rename, restructure, invent class systems). This is derived from THIS site,
  not generic. Update it only via the orchestrator; subagents treat it as
  read-only law.

### Phase 2 — Pilot (3–5 pages, sequential, attended)
- Run the per-page loop below on pilot pages. Inspect verdicts yourself only to
  confirm thresholds agree with human judgment.

### Cost gate (once)
- `node scripts/manifest.mjs estimate` — projects total spend per page type from
  measured pilot actuals. User approves before widening. After approval, never
  prompt about cost again; include estimates in status reports instead.

### Phase 3 — Unattended loop
```
while manifest has {pending | failed(attempts<N) | needs_reverify}:
  manifest.mjs claim                         # atomic
  capture.mjs <id>     # fixtures + extract SAME moment (atomic pair), timestamped
  extract.mjs <id>     # source adapter from config → content/
  BUILD: fresh subagent (cheap-tier where it can; see model tiering) with a
         SCOPED PACKET: manifest entry + extracted content +
         migration/build-contract.md (the LAW) + the existing component
         inventory it must reuse + acceptance criteria. Nothing else.
         The subagent COMPOSES existing components into the page's template;
         it does NOT create shared components, rename, restructure, or invent
         conventions. A page that genuinely needs a NEW shared component →
         the subagent STOPS and flags it to the orchestrator (which decides
         and updates the contract); it never adds one unilaterally.
  target build must succeed (counts as an attempt if not)
  compare.mjs <id> <candidate-url> → exit code:
    0 → manifest: parity_passed → git commit "migrate: <path>" → log
    1 → DIAGNOSE (see MCP rules) → targeted fix → attempts++ (max N from config)
    2 or N exhausted → manifest: needs_human → log → CONTINUE, never block
    ≥3 → HARNESS ERROR: never a page verdict, never counts as an attempt →
         read references/troubleshooting.md, fix the harness/env, re-run step
  if build touched shared files (components/layouts/global css/config):
    manifest.mjs mark-stale --touching <files>   # passed pages → needs_reverify
  append page log per references/logging.md
```
One page at a time. needs_reverify pages re-run compare.mjs only.

Orchestration: prefer running this loop via the Workflow tool (deterministic
script drives the loop; each page's build/diagnose is a fresh subagent
returning only a verdict object) — the user has opted into this design. In a
plain supervised session, the same loop runs inline with /clear at page
boundaries. Either way the manifest, not the conversation, is the loop state.

Model tiering (cost discipline): spawn subagents on the CHEAPEST model that
can do the job. Mechanical steps — capture, extract, manifest writes, smoke —
use a small/fast model (e.g. haiku). The build subagent and MCP failure
diagnosis use a mid model (e.g. sonnet). Reserve the top tier for the
orchestrator only. Never fan out the whole manifest on an expensive model.

Lazy spawn (cost discipline): spawn ONE page's subagent only when it is that
page's turn and its inputs exist — spawn → get verdict → discard → next.
NEVER eager-fan-out the whole manifest (subagents don't talk to each other, so
nothing is gained; you'd only pay for agents the circuit breaker / needs_human
may make moot, and idle agents risk uncached re-priming). Coordination is via
on-disk state (manifest, build-contract), not live agents. For concurrency use
pipeline() so page N+1's capture overlaps page N's build — overlap, not
eager batch. Token cost = context loaded + output generated; waiting is free
in tokens, so never spawn early "to save time."

CIRCUIT BREAKER: 3 consecutive page failures, or 2 consecutive harness
errors, or a source 403/503/challenge response → STOP the loop. It is
systemic until proven otherwise — triage per references/troubleshooting.md
(calibrate-on-a-passing-page decides: masking bug vs build regression vs
source change). Wrongly-failed pages get their attempts reset. Never let an
unattended run grind a broken harness across the whole manifest.

### Phase 4 — Wrap-up
- `node scripts/smoke.mjs` full suite: every route 200 in export output, redirects
  resolve, sitemap/robots/404 valid, no dead internal links, zero console errors
  on key pages, Lighthouse/CWV ≥ source baseline.
- `manifest.mjs status` → final report: counts by status + every needs_human and
  failed page listed. Update the vault current-truth note. Notify user.
- `node scripts/report.mjs` → regenerates `reports/migration-summary.html` with
  final results (passed %, needs_human, failed). Same artifact as the recon
  summary, now showing outcomes — hand this to the user as the wrap-up report.

### Phase 5 — Cutover (checklist, human executes DNS)
- Emit redirects for the host (from config), deploy to staging, run smoke against
  staging, freshness spot-check, DNS flip checklist, post-launch watch (404 logs,
  Search Console). Read `references/seo-rules.md` § cutover.

## Hard rules (honesty)

- `parity_passed` is set ONLY on compare.mjs exit 0. Never by judgment, never by
  eyeballing screenshots. A hook may additionally block illegal writes.
- Never edit fixtures, mask rules, or thresholds to force a pass on a real
  difference. After ANY mask-rule change, re-run calibration.
- `needs_human` is a valid outcome of a healthy process — surface it, route
  around it, never silently pass or retry forever.
- **NEVER translate content yourself.** Every locale's content is captured
  from that locale's REAL pages: locate the language mechanism at intake
  (path/domain/switcher), navigate to the locale variant, extract its actual
  text. A locale row with no source content is a GAP (flag in manifest +
  partial-translation inventory) — never filled by translating another locale.
  Self-translation is both a fidelity violation (invented content) and a
  token sink.

## Hard rules (context discipline)

- NEVER Read `migration-manifest.json` or `url-map.json` directly — always go
  through `manifest.mjs` (status | next | get <id> | claim | set | mark-stale |
  estimate). Aggregates are cheap; the file is not.
- Scripts write artifacts to disk and print a ≤20-line summary. Read ONLY the
  `summary` block of any parity report.
- Playwright MCP is for FAILURE DIAGNOSIS only, never bulk capture. The report
  names the failing selector/region — inspect THAT via browser_evaluate on both
  sides. Full browser_snapshot is last resort, max once per side per attempt.
- One page per fresh subagent. Supervised sessions: /clear at page boundaries;
  the only carry-forward state is the manifest.
- Log decisions at the moment they're made, not at session end.

## Media policy

- Assets on the source domain or its CDN → download, optimize, self-host in
  `public-assets/`. Never hotlink infrastructure that dies at cutover.
- Genuine third-party embeds (YouTube/Vimeo/Maps/LINE) → keep as embeds.
- DRM/streaming/auth-gated → needs_human.

## Integrations & secrets (see references/integrations.md)

Third-party keys/IDs are detected at intake and classified into three tiers:
Tier 1 public IDs (GTM/GA/Pixel) → env var + owner confirms property; Tier 2
domain-restricted keys (Maps/reCAPTCHA) → preserved but flagged needs_owner
(re-key or allow-list the new domain); Tier 3 server secrets (form/payment) →
unrecoverable from the scrape, must_provision. NEVER hardcode a key or commit
a secret — everything is an env var; secrets live in gitignored `.env.local`.
Inventory: `migration/integrations.json`; documented in `.env.example`.

## Human touchpoints (the complete list — four)

1. Intake answers. 2. URL-map approval. 3. Cost gate after pilot.
4. Final needs_human triage. Everything else is unattended.

## Harness status

Scripts not yet implemented exit 3 with a pointer. Build order and per-script
contracts: `references/implementation-plan.md`.
