---
type: session
date: 2026-06-08
tags: [mcp, figma, skills, rtk, obsidian, pptx]
---

# Session: Skills package build (claude-code-mcp-optimizer)

## Task
Building/maintaining the `claude-code-mcp-optimizer` skills repo (GitHub: ieteerapat/ClaudeSkills1.0) + installing tools to this Windows/Git-Bash machine.

## Repo state (all pushed, main in sync)
5 skills, validated against agentskills.io:
- figma-accuracy 1.3.0
- api-token-optimization 1.0.0
- session-memory 1.1.0
- hyperframes-video 2.0.0
- site-migrate 1.8.0 (vendored; latest given was v1.8.0)

Also in repo: installers/ (RTK, Obsidian vault, Obsidian MCP), vault/ (this memory store), CLAUDE.md, README.md, CHANGELOG.md, SOURCES.md.

## Installed on this machine
- RTK 0.42.3 (global Claude Code hook, active)
- Obsidian + repo vault registered (id 356723dc08f20b09)
- Obsidian MCP (mcp-obsidian via uvx) registered in ~/.claude.json — connects only when Obsidian runs with vault open
- uv 0.11.19
- All 5 skills copied to global ~/.claude/skills/

## IN PROGRESS (next step)
Installing official Anthropic **pdf** + **pptx** skills for PDF→PowerPoint (Claude Cowork use).
- Cloned to /tmp/anthropics-skills (shallow). Both skills/pdf and skills/pptx present.
- NOT yet copied to ~/.claude/skills/ or the repo.
- NEXT: copy pdf + pptx into ~/.claude/skills/; install deps: `pip install "markitdown[pptx]" Pillow`, `npm i -g pptxgenjs`. Optional (visual QA only): LibreOffice (soffice) + Poppler (pdftoppm) — likely NOT installed on this machine, flag as optional.
- Decide: add to repo too? (pptx license is Proprietary/source-available — note in SOURCES if added.)

## Env notes
- Windows + Git Bash (MINGW). curl install.sh scripts fail on MinGW (use prebuilt binaries).
- Node v24, Python 3.12, pip ok.
- Git auth: pushes work as-is now (earlier had a transient 403 as user TeerapatIe vs repo owner ieteerapat — resolved).

## Cached / don't re-fetch
- agentskills.io spec already applied (name lowercase-hyphen, desc <1024)
- Figma official skill set (June 2026): figma-use, -figjam, -slides, -swiftui, code-connect, create-new-file, generate-diagram, generate-library, generate-design
