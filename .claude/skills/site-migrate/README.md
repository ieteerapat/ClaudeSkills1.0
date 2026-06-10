# site-migrate — Claude Code skill

Stack-agnostic website migration engine for Claude Code. Migrates a site to a
new stack (e.g. WordPress → Next.js/Tailwind static, or → Astro) with near-zero
human intervention: intake-first configuration, golden-fixture capture via
Playwright, manifest-driven per-page loop, and a parity gate — a page is never
"done" until it mechanically matches the captured source within tolerance.

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
