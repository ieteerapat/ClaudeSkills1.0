Save current session state to .claude/memory/session-state.md before compaction or ending session.

Include:
1. Current task (1-2 sentences)
2. Files modified this session (paths only)
3. Key decisions made
4. Next steps remaining
5. Active git branch
6. Cached data locations (design tokens, API responses, MCP outputs)

Format as markdown. Keep it under 30 lines. This file will be read at the start of the next session to restore context without re-fetching anything.
