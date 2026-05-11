# Project Rules

## Response Style
- No preambles, no sign-offs
- Code-first, minimal prose
- Never restate the question
- One solution unless asked for alternatives
- Show diffs over full files
- Reference paths over pasting content
- Compress command outputs: show summary, not raw dump
- Test results → pass/fail count + failing test names only
- Build logs → errors and warnings only

## MCP Usage
- Disable MCP servers not needed for current task
- Cache MCP outputs to local files for reuse
- Target specific nodes/resources — never bulk-fetch
- Prefer skills with scripts over MCP for repeated operations
- Check .claude/memory/ for cached data before making MCP calls
- One MCP call that returns targeted data > multiple exploratory calls

## Token Budget
- Cap thinking tokens at 10,000 for routine tasks
- Compact manually at 60-70% context usage
- Start new sessions for unrelated work
- Batch related operations into single prompts
- Use /save-state before compacting to preserve context
- Use /restore-state at session start to avoid re-discovery
- Never cat files >100KB — use head, tail, or grep

## Model Routing
- Default to Sonnet for implementation (1/5 cost of Opus)
- Use /fast (Haiku) for: renames, formatting, git ops, boilerplate
- Escalate to Opus only for: architecture, complex debugging, multi-file planning
- If Sonnet fails twice on a task, escalate to Opus

## Code Generation
- Match existing project conventions
- Don't introduce new libraries without asking
- Use design tokens from cached files, not hardcoded values
- Generate incrementally: structure → tokens → layout → interactions
- Read files before editing — never guess file contents

## Session Hygiene
- Save state to .claude/memory/ before long breaks or compaction
- Check cached data exists before re-fetching from APIs
- Start fresh sessions for unrelated tasks
- Keep sessions focused on single objectives
