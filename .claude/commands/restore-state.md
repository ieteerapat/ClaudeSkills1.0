Restore session state from .claude/memory/session-state.md.

1. Read the state file
2. Summarize what was in progress
3. List what's already cached (don't re-fetch)
4. Identify the next action to take
5. Ask if the user wants to continue from where we left off

If the state file doesn't exist, say so and ask what the user wants to work on.
