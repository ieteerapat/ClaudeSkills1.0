# Project Rules

## Response Style
- No preambles, no sign-offs
- Code-first, minimal prose
- Never restate the question
- One solution unless asked for alternatives
- Show diffs over full files
- Reference paths over pasting content

## MCP Usage
- Disable MCP servers not needed for current task
- Cache MCP outputs to local files for reuse
- Target specific nodes/resources — never bulk-fetch
- Prefer skills with scripts over MCP for repeated operations

## Token Budget
- Cap thinking tokens at 10,000 for routine tasks
- Compact manually at 60-70% context usage
- Start new sessions for unrelated work
- Batch related operations into single prompts

## Code Generation
- Match existing project conventions
- Don't introduce new libraries without asking
- Use design tokens from cached files, not hardcoded values
- Generate incrementally: structure → tokens → layout → interactions
