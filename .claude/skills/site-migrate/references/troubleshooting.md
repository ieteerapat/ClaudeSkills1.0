# Troubleshooting — triage tree for the unattended loop

First law: **decide WHICH layer is broken before fixing anything.**
A page can be wrong, the harness can be wrong, or the environment can be
wrong — and they need opposite responses. Misclassifying a harness bug as
page failures burns attempts across the whole manifest.

## Triage question 1: one page, or many?

- **One page failing, others passing** → page-level. Use the normal diagnose
  path (localized diff → browser_evaluate → fix → retry). Nothing special.
- **Same failure shape on consecutive pages** → SYSTEMIC until proven
  otherwise. Stop the loop (circuit breaker in SKILL.md fires at 3
  consecutive fails / 2 consecutive harness errors). Triage below.

## Triage question 2 (systemic): harness, source, or regression?

Run `compare.mjs --calibrate` on a previously-passing page (source vs itself):

- **Calibrate FAILS** → masking/harness bug (a mask rule regressed, source
  site changed globally — new banner, theme update, A/B test). Fix
  mask-rules.json, recalibrate to 100%, then `manifest.mjs` reset the
  wrongly-failed pages to pending (their attempts were not their fault —
  decrement or reset attempts).
- **Calibrate PASSES, builds fail to compile** → target-side systemic: a
  shared component/config change broke the build for everyone. Check recent
  commits (per-page commits make this bisectable: `git log --oneline`),
  revert the offending commit, reset affected rows.
- **Calibrate PASSES, parity fails on a shared region (header/footer)** →
  shared-component regression. Same git bisect; this is what
  needs_reverify/mark-stale exists for — if it fired correctly, the staleness
  queue already lists the victims.

## Error classes and responses

- **Harness errors (script exit ≥3, crashes, Playwright errors):** NEVER a
  page verdict, NEVER increments attempts. Common causes: browsers not
  installed (`npx playwright install chromium`), missing project deps
  (`npm ci`), node version. Fix env, re-run the same step.
- **Source unreachable / WAF / rate-limit (403, 503, challenge page,
  timeouts):** do not hammer. Back off (double the throttle), retry once;
  still blocked → pause the loop, log the incident, notify the user
  (PushNotification) — resuming later costs nothing, the manifest holds.
  Challenge-page HTML in a fixture poisons it: delete that fixture, recapture.
- **Stale claims (crash mid-page):** rows stuck in claimed/in_progress with
  old updated_at. `manifest.mjs status` flags them; release with
  `manifest.mjs set <id> status pending` after confirming no concurrent run.
- **Page content breaks the build (bad MDX, exotic embed):** page-level —
  counts as an attempt, diagnostics to the page log.
- **CI red, local green:** environment drift — pin node version in the CI
  file to match local; confirm `npm ci` not `npm install`.
- **Disk pressure:** fixtures grow GBs. Prune diff images of parity_passed
  pages; never delete fixtures of unfinished pages.

## Recovery principles

- The manifest is the recovery point: cold restart = rerun the loop, it
  resumes. Per-page git commits are the revert unit.
- Never "fix" a failure by deleting fixtures, loosening thresholds, or adding
  mask rules to hide a REAL difference. Mask rules hide noise, not signal;
  every addition is logged with a reason and followed by recalibration.
- Every systemic incident gets one entry in CC-Session-Logs/decisions.md:
  symptom → diagnosis → fix → pages reset. Repeated incidents are a pattern
  the next session must know about (and belong in the vault current-truth).
