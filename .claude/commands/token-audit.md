Audit current session for token waste. Check:

1. How many MCP servers are connected? List them with approximate tool count.
2. Are there any MCP outputs in context that could be cached to a file?
3. Is context usage above 60%? If yes, recommend compaction.
4. Are there repeated data fetches that should be cached?

Output a brief report:
```
Token Audit
───────────
MCP servers active: [count] ([approx token overhead])
Cacheable data: [yes/no] — [what to cache]
Context usage: [estimate]
Recommendation: [action to take]
```
