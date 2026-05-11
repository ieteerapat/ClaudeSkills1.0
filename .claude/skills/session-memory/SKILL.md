---
name: "Session Memory Manager"
description: "Preserves critical context across compactions and sessions. Saves work state to files before compaction hits, restores context in new sessions. Use when working on long tasks that span multiple sessions or when context is getting full."
---

# Session Memory Manager

Prevent context loss during compaction by persisting critical state to files.

## When to use

- Context usage is above 60%
- Working on multi-session tasks
- Before manually compacting
- Starting a new session on an ongoing task

## Instructions

### Before Compaction (save state)

1. Create/update `.claude/memory/session-state.md` with:
   - Current task description (1-2 sentences)
   - Files modified in this session (paths only)
   - Key decisions made
   - Next steps remaining
   - Active branch name
   - Any cached data locations (design tokens, API responses)

2. Format:
```markdown
# Session State
## Task: [brief description]
## Modified: [file paths]
## Decisions: [key choices made]
## Next: [what to do next]
## Branch: [git branch]
## Cached: [paths to cached MCP data]
```

### After Starting New Session (restore state)

1. Check if `.claude/memory/session-state.md` exists
2. Read it to understand where we left off
3. Do NOT re-fetch any data listed under "Cached"
4. Continue from "Next" steps

### Automatic State Tracking

During any session, maintain awareness of:
- Which files have been read (avoid re-reading)
- Which MCP calls have been made (avoid re-fetching)
- What design tokens are already cached locally

## Examples

### Saving state before compact:
```markdown
# Session State
## Task: Implementing ProductCard from Figma design
## Modified: src/components/ProductCard.tsx, src/tokens.ts
## Decisions: Using Tailwind, tokens extracted to src/tokens.ts
## Next: Add hover states and responsive breakpoints
## Branch: feature/product-card
## Cached: src/tokens.ts (Figma variables), .claude/memory/figma-nodes.json
```

### Restoring in new session:
```
Read .claude/memory/session-state.md → understand context
Skip: re-fetching Figma tokens (already in src/tokens.ts)
Skip: re-reading unchanged files
Start: implement hover states on ProductCard
```

## Common Edge Cases

- **State file is stale**: Check git log to see if files changed since state was saved
- **Cached data outdated**: If design changed in Figma, re-fetch only changed nodes
- **Multiple tasks in progress**: Create separate state files per task
