# Changelog

All notable changes to the skills in this package are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com). Skills follow semver.

## Skill Versions

| Skill | Version | Last Updated |
|---|---|---|
| figma-accuracy | 1.3.0 | 2026-06-08 |
| api-token-optimization | 1.0.0 | 2026-06-08 |
| session-memory | 1.1.0 | 2026-06-08 |
| hyperframes-video | 2.0.0 | 2026-06-05 |
| site-migrate | 1.5.0 | 2026-06-08 |

---

## site-migrate

### 1.5.0 — 2026-06-08
- Updated from vendored site-migrate-skill v1.5.0 (32 files, +2 vs v1.1.0)
- Added `references/integrations.md` and `scripts/report.mjs`
- Updated SKILL.md, build-contract, implementation-plan, intake-checklist, seo-rules, wordpress source, astro + nextjs-tailwind targets, and capture/compare/extract/extract-markdown/smoke scripts
- Installed to global `~/.claude/skills/` on this machine

### 1.1.0 — 2026-06-08
- Vendored from site-migrate-skill v1.1.0 (30 files: SKILL.md, config/, references/, scripts/)
- Stack-agnostic website migration engine: WordPress/generic-crawl → Next.js+Tailwind static or Astro
- Phase-driven, manifest-routed loop; parity gate (a page is "done" only when it mechanically matches the captured source within tolerance)
- v1.1.0 change vs 1.0.0: added "Lazy spawn (cost discipline)" guidance — spawn one page's subagent at a time, coordinate via on-disk state, never eager-fan-out the manifest
- Bundled scripts (Playwright capture, visual compare, content extract, manifest/urlmap/smoke) run via node; some need their own deps (playwright) installed on first use

---

## api-token-optimization

### 1.0.0 — 2026-06-08
- New skill for direct Anthropic API cost optimization (fills the API-side gap; CLAUDE.md covers Claude Code session tuning)
- Prompt caching (90% off reads) with the cache-invalidation gotchas: images break cache, volatile-before-breakpoint, concurrency miss, per-model min token thresholds
- Batch API (50% off, stacks with caching), effort/budget_tokens tuning, prefill, token-efficient tools, dynamic tool loading
- Diagnostic workflow (measure → identify → apply → verify) + verification checklist
- Adapted from amunozdev/token-optimizer v1.4.0 (MIT)

## figma-accuracy

### 1.3.0 — 2026-06-08
- Documented the expanded official Figma skill set (June 2026): added figma-use-slides, figma-swiftui, figma-generate-library to the bundled-skills table
- Clarified which official skills matter for reading vs writing to Figma

### 1.2.0 — 2026-06-05
- Added Code to Canvas bidirectional workflow (live UI → Figma → back to code)
- Updated supported clients list to June 2026 (Augment, Codex, Cursor, Factory, Firebender, VS Code, Warp)
- Added version metadata to frontmatter
- Fixed date label on MCP Server Options table (May → June 2026)

### 1.1.0 — 2026-05
- Switched to official Figma plugin setup: `claude plugin install figma@claude-plugins-official`
- Updated remote MCP server URL to `https://mcp.figma.com/mcp`
- Documented all 16 official Figma MCP tools with rate-limit status
- Added `references/mcp-servers.md`, `references/property-mapping.md`, `references/tool-reference.md`

### 1.0.0 — initial
- 3-layer accuracy stack (design system rules → Code Connect → structured read workflow)
- Correct tool call sequence (metadata → context → screenshot → variables)
- Large design handling, font weight / auto-layout / color mapping tables
- Validation checklist and common failure fixes

---

## hyperframes-video

### 2.0.0 — 2026-06-05
- Reworked into a self-contained local skill — no plugin/upstream install required
- All authoring rules embedded directly in SKILL.md (3 non-negotiable rules, media, aspect ratios, workflow)
- Added 3 reference files:
  - `references/animation-patterns.md` — GSAP recipes + non-GSAP adapter registration (Lottie, Three.js, Anime.js, WAAPI, CSS)
  - `references/cli-reference.md` — full CLI command/flag reference + prerequisite install
  - `references/pipeline.md` — 7-step pipeline for multi-beat videos + frame.md notes
- Removed dependency on `npx skills add heygen-com/hyperframes` (kept CLI usage only, via npx)

### 1.0.0 — 2026-06-05
- Initial release. Quickstart skill for HeyGen's HyperFrames (HTML → MP4 video framework)
- Captures core composition rules agents get wrong: `class="clip"`, root data attributes, paused GSAP timelines registered on `window.__timelines`
- Pointed to official upstream skills (superseded by 2.0.0 self-contained approach)
- Based on upstream v0.6.73

---

## session-memory

### 1.1.0 — 2026-06-08
- Added Obsidian vault (`vault/`) as the persistent memory store
- Session notes → `vault/Sessions/`, durable facts → `vault/Knowledge/`, linked with wikilinks
- Falls back to `.claude/memory/session-state.md` when no vault is present
- Added `installers/setup-obsidian-vault.sh` (installs Obsidian, registers the vault path locally)

### 1.0.0 — 2026-06-05
- Save/restore session state to `.claude/memory/session-state.md`
- Avoids re-fetching cached data and re-reading unchanged files across compactions
- Added version metadata to frontmatter

---

## Package History

- **2026-06**: Added Obsidian MCP integration — `installers/setup-obsidian-mcp.sh` connects Claude Code to the vault via mcp-obsidian (Local REST API plugin) for semantic search + structured note ops. API key is gitignored; falls back to plain file access (no MCP) when not set up.
- **2026-06**: Added Obsidian vault (`vault/`) + `setup-obsidian-vault.sh` installer — persistent memory store for the session-memory skill. Obsidian installed/registered locally; vault path merged into `obsidian.json` without disturbing existing vaults.

- **2026-06**: Added `installers/` — RTK (Rust Token Killer) installer scripts for macOS/Linux/WSL/Git Bash (`install-rtk.sh`) and native Windows (`install-rtk.ps1`). RTK is a CLI tool, not a skill — it ships its own Claude Code hook via `rtk init -g`, so it's delivered as an installer rather than a redundant skill.
- **2026-06**: Refactored from 7 skills to 2 after agentskills.io evaluation, then added hyperframes-video (3 total).

- **2026-06**: Refactored from 7 skills to 2 after agentskills.io evaluation. Removed token-saver, output-filter, model-routing, mcp-token-optimizer, figma-design-to-code (absorbed into CLAUDE.md or merged into figma-accuracy).
- **2026-06**: All skills validated against the [Agent Skills specification](https://agentskills.io/specification).
