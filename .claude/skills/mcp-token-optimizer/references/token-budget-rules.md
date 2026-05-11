# Token Budget Rules & Strategies

## The Four Token Drains

| Drain | Typical Share | Mitigation |
|---|---|---|
| System prompt + MCP tool manifest | 30-50% | Disable unused MCP servers, use skills instead |
| Tool call inputs/outputs | 30-45% | Target specific data, cache results |
| Extended thinking | 10-30% | Cap at 10K tokens for routine tasks |
| Visible output (prose + code) | 1-10% | Terse responses, no fluff |

## Auto-Compaction Trap

- Auto-compaction fires at ~93% context (187K/200K)
- Each compaction costs 100-200K tokens to summarize
- Can fire 3-4 times in a long session

**Prevention:**
- Compact manually at 60-70% context usage
- Use `/compact` command proactively
- Start new sessions for unrelated tasks
- Keep sessions focused on single objectives

## MCP Server Token Tax

Each connected MCP server loads ALL tool definitions into context at startup:

| Servers Connected | Approx Tools | Startup Token Cost |
|---|---|---|
| 1 server (5 tools) | 5 | ~5,000 tokens |
| 3 servers (20 tools) | 20 | ~22,000 tokens |
| 5 servers (60 tools) | 60 | ~55,000 tokens |

**Mitigation strategies:**
1. Only connect MCP servers you're actively using
2. Prefer Skills with scripts for operations that don't need live API access
3. Use tool filtering if your MCP client supports it
4. Consider an MCP gateway/proxy that exposes only needed tools

## Skills vs MCP Decision Matrix

| Need | Use Skills | Use MCP |
|---|---|---|
| Read Figma design tokens | ✓ (cache to file) | First time only |
| Generate component from design | ✓ (reference cached data) | Only if design changed |
| Live API interaction | | ✓ |
| Database queries | | ✓ |
| Code generation patterns | ✓ | |
| File transformations | ✓ (scripts run outside context) | |

## Practical Token Savings Checklist

### Before Starting a Session
- [ ] Disable MCP servers not needed for this task
- [ ] Check if design tokens are already cached locally
- [ ] Prepare specific node IDs / file keys in advance
- [ ] Set thinking token cap: `MAX_THINKING_TOKENS=10000`

### During a Session
- [ ] Monitor context usage (use statusline gauge)
- [ ] Compact at 60-70% — don't wait for auto-compaction
- [ ] Cache MCP outputs to local files for reuse
- [ ] Use file references instead of pasting content

### After a Session
- [ ] Save any extracted design tokens/data to files
- [ ] Note component patterns for skill reuse
- [ ] Clean up temporary files

## Settings for Token Efficiency

Add to `~/.claude/settings.json`:

```json
{
  "preferences": {
    "maxThinkingTokens": 10000,
    "verbosity": "minimal"
  }
}
```

Add to project `CLAUDE.md`:

```markdown
# Response Rules
- No preambles or sign-offs
- Code-first, minimal prose
- Never restate the question
- One solution unless asked for alternatives
- Use existing project conventions, don't introduce new patterns
```
