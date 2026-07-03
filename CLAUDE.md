# Project Rules

## Response Style
- No preambles, no sign-offs
- Code-first, minimal prose
- Never restate the question
- One solution unless asked for alternatives
- Show diffs over full files
- Reference paths over pasting content
- Test results → pass/fail count + failing test names only
- Build logs → errors and warnings only
- Never paste raw command output >50 lines — summarize first

## MCP Usage
- Disable MCP servers not needed for current task
- Cache MCP outputs to local files for reuse
- Target specific nodes/resources — never bulk-fetch
- Check the vault (or .claude/memory/) for cached data before making MCP calls
- One targeted MCP call > multiple exploratory calls
- If MCP response exceeds token limit, break into smaller requests
- Obsidian MCP only connects while Obsidian runs with the repo vault open; otherwise use direct file access on vault/

## Persistent Memory (Obsidian vault)
- The repo ships an Obsidian vault at `vault/` as the persistent memory store
- Session notes → `vault/Sessions/YYYY-MM-DD-<slug>.md` (template: `vault/_templates/session.md`)
- Durable facts/decisions → `vault/Knowledge/` (template: `vault/_templates/knowledge.md`)
- Link related notes with `[[wikilinks]]`; keep notes terse (memory, not docs)
- Prefer direct file read/write on vault/ (zero MCP overhead); use the Obsidian MCP only for vault-wide semantic search
- The `session-memory` skill drives this; fall back to `.claude/memory/` when no vault exists

## Token Tooling (RTK)
- RTK is active globally — Bash commands (git, cargo, npm/test, ls, grep, docker) are auto-filtered to compact output, saving 60-90% tokens
- Don't fight it: trust RTK's compact output; if a command fails, RTK saves full output to a tee log for inspection
- RTK only filters Bash tool calls — Read/Grep/Glob bypass it, so use shell commands when you want filtering there
- Check savings with `rtk gain`

## Token Budget
- Cap thinking tokens at 10,000 for routine tasks
- Compact manually at 60-70% context usage
- Start new sessions for unrelated work
- Batch related operations into single prompts
- Use /save-state before compacting to preserve context
- Use /restore-state at session start to avoid re-discovery
- Never cat files >100KB — use head, tail, or grep

## Model Routing
- Default to Sonnet for implementation
- Use /fast (Haiku) for: renames, formatting, git ops, boilerplate
- Escalate to Opus only for: architecture, complex debugging, multi-file planning

## Code Generation
- Match existing project conventions
- Don't introduce new libraries without asking
- Use design tokens from cached files, not hardcoded values
- Generate incrementally: structure → tokens → layout → interactions
- Read files before editing — never guess file contents

## Session Hygiene
- Save state to the vault (`vault/Sessions/`) or `.claude/memory/` before long breaks or compaction
- Check cached data exists before re-fetching from APIs
- Start fresh sessions for unrelated tasks
- Keep sessions focused on single objectives

## Available Skills (this repo)
- `figma-accuracy` — pixel-perfect Figma MCP implementation (tool sequence, validation, Code Connect)
- `api-token-optimization` — direct Anthropic API cost cuts (prompt caching, Batch API, effort tuning)
- `session-memory` — persist/restore context across compactions via the vault
- `hyperframes-video` — author HTML→MP4 videos (self-contained, no plugin)
- `site-migrate` — stack-agnostic site migration with parity gate (WordPress/crawl → Next.js/Astro)
- `hallmark` — anti-AI-slop UI design (build/audit/redesign/study; 20 themes, self-contained HTML+CSS)
