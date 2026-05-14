---
name: mcp-token-optimizer
description: Reduces token drain when working with MCP servers (especially Figma MCP). Enforces progressive disclosure, caches design data, and keeps responses terse. Use this skill whenever working with MCP tools, Figma designs, or when token usage is a concern.
---

# MCP Token Optimizer

Optimize token usage when working with MCP servers, with special focus on Figma MCP workflows.

## When to use

- Working with Figma MCP server (design-to-code)
- Any MCP-heavy workflow where token drain is a concern
- Long coding sessions where context window preservation matters
- Design system extraction and component generation

## Core Principles

### 1. Progressive Disclosure Over Bulk Loading

Never request all data at once from MCP servers. Follow this hierarchy:

1. **Metadata first** — Get node IDs, names, types before full data
2. **Targeted extraction** — Request only the specific nodes/frames you need
3. **Incremental detail** — Start with structure, add styling details only when needed

### 2. Response Compression

All responses follow terse format:
- No preambles ("Sure!", "Great question!")
- No restating the question
- No unsolicited suggestions beyond scope
- Code-first, prose-minimal
- Use shorthand: `→` for "results in", `∵` for "because", `∴` for "therefore"

### 3. MCP Call Batching

- Combine related MCP calls where the API supports it
- Cache repeated lookups (component definitions, design tokens, variables)
- Never re-fetch data already in context

## Instructions

### For Figma MCP Workflows

1. **Before any Figma call**: Check if the data is already in context from a previous call
2. **Get structure first**: Use `get_file` with `depth=1` to understand page layout before diving deep
3. **Target specific frames**: Always use node IDs rather than fetching entire files
4. **Extract tokens once**: Get design tokens/variables in one call, reference them throughout
5. **Batch component reads**: Group related component fetches into minimal calls

### For General MCP Optimization

1. **Audit tool definitions**: If an MCP server exposes 20+ tools, only describe the ones relevant to current task
2. **Cache tool outputs**: Store structured results in local files rather than re-querying
3. **Minimize round-trips**: Plan your MCP calls before executing — fewer calls = fewer tokens
4. **Compress outputs**: When MCP returns verbose JSON, extract only needed fields immediately

### Token Budget Rules

- **Thinking tokens**: Cap at 10,000 unless task is architecturally complex
- **Compact early**: Trigger manual compaction at 60-70% context usage, don't wait for auto-compaction at 93%
- **One-shot preference**: Prefer single comprehensive prompts over multi-turn conversations for simple tasks
- **File references over inline**: Point to files on disk rather than pasting content into context

## Examples

### Bad (token-heavy Figma workflow):
```
"Please look at my Figma file and tell me about all the components,
their styles, spacing, colors, typography, and then generate the
full React component with all variants."
```

### Good (token-efficient Figma workflow):
```
"Get frame node_id=123:456. Extract: component structure, design tokens used.
Generate React component matching structure. Use existing tokens from ./tokens.ts"
```

### Bad (verbose MCP interaction):
```
User: What tools does the Figma MCP have?
Claude: [lists all 15 tools with full descriptions = 3000 tokens]
User: Now use get_file to...
```

### Good (direct MCP interaction):
```
User: Get frame 123:456 from file ABC, extract color tokens and component tree
Claude: [single targeted call, structured output]
```

## Common Edge Cases

- **Large Figma files**: Always scope to specific pages/frames, never fetch entire file
- **Nested components**: Get parent structure first, then selectively expand children
- **Design token conflicts**: When tokens have modes (light/dark), specify which mode upfront
- **MCP timeout**: If a call takes >30s, break it into smaller targeted requests
