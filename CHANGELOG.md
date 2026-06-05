# Changelog

All notable changes to the skills in this package are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com). Skills follow semver.

## Skill Versions

| Skill | Version | Last Updated |
|---|---|---|
| figma-accuracy | 1.2.0 | 2026-06-05 |
| session-memory | 1.0.0 | 2026-06-05 |
| hyperframes-video | 2.0.0 | 2026-06-05 |

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

## figma-accuracy

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

## session-memory

### 1.0.0 — 2026-06-05
- Save/restore session state to `.claude/memory/session-state.md`
- Avoids re-fetching cached data and re-reading unchanged files across compactions
- Added version metadata to frontmatter

---

## Package History

- **2026-06**: Refactored from 7 skills to 2 after agentskills.io evaluation. Removed token-saver, output-filter, model-routing, mcp-token-optimizer, figma-design-to-code (absorbed into CLAUDE.md or merged into figma-accuracy).
- **2026-06**: All skills validated against the [Agent Skills specification](https://agentskills.io/specification).
