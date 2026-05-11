# Figma MCP Server Options

Multiple MCP servers exist for Figma. Each has different strengths for accuracy.

## 1. Figma Official MCP Server (Recommended)

**Best for**: Full accuracy with Code Connect, design system search, and all official tools.

### Desktop Server (local)
Works with Figma desktop app. Selection-based — select a node, AI reads it.

**Setup**: Built into Figma desktop app. Enable in Figma settings → MCP.

**Pros**:
- No URL needed (uses current selection)
- All tools available including `use_figma` for writing
- Code Connect integration
- `create_design_system_rules` tool
- `search_design_system` for finding existing components

**Cons**:
- Requires Figma desktop app running
- Rate limited (6-600 calls/day depending on plan)
- `get_design_context` can exceed 25K token limit on large designs

### Remote Server (cloud)
Works without desktop app. Requires Figma URL with node-id.

**Setup**:
```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server"]
    }
  }
}
```

**Pros**:
- No desktop app needed
- `generate_figma_design` (code-to-canvas)
- `use_figma` for writing to files
- `search_design_system` across all libraries
- `create_new_file`

**Cons**:
- Requires URL with node-id (no selection-based)
- Same rate limits
- Some tools are beta/paid features

---

## 2. Framelink MCP (GLips/Figma-Context-MCP)

**Best for**: Simplified, layout-focused data that produces better one-shot implementations.

**What it does differently**: Before returning Figma API data, it simplifies and translates the response so only the most relevant layout and styling information is provided. Less noise = more accurate AI output.

**Setup**:
```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

**Windows**:
```json
{
  "mcpServers": {
    "Framelink MCP for Figma": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

**Pros**:
- Simplified output = less token waste, more accurate AI interpretation
- Trusted by 11,600+ developers
- Works with any MCP client (Cursor, Claude Code, VS Code, etc.)
- Good for one-shot implementations

**Cons**:
- No Code Connect integration
- No `use_figma` (read-only)
- No `search_design_system`
- Uses Figma REST API (your personal access token)

**Repo**: https://github.com/GLips/Figma-Context-MCP

---

## 3. Smart Position Fork (tianmuji/figma-context-mcp)

**Best for**: Designs that use absolute positioning instead of Auto Layout.

**What it does differently**: Adds x, y, width, height data for non-AutoLayout elements. This helps AI infer logical layout relationships from absolute positioning.

**Setup**:
```json
{
  "mcpServers": {
    "figma-context": {
      "command": "npx",
      "args": ["figma-context-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

**Pros**:
- Position data for non-AutoLayout elements
- Better layout inference from absolute positioning
- Fully backward compatible with Framelink
- Helps with legacy Figma files that don't use Auto Layout

**Cons**:
- Same limitations as Framelink (no Code Connect, read-only)
- Fork, may lag behind upstream updates

**Repo**: https://github.com/tianmuji/Figma-Context-MCP

---

## 4. Direct Figma REST API (fallback)

**Best for**: When MCP servers fail, rate limits hit, or you need full control.

**How to use**:
```bash
curl -H "X-Figma-Token: YOUR_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/nodes?ids=NODE_ID"
```

**Pros**:
- No MCP overhead
- No rate limit concerns (standard API limits)
- Full control over what data you fetch
- Works when MCP servers won't connect

**Cons**:
- Raw JSON (not simplified for AI)
- No progressive disclosure
- Must parse response manually
- More tokens consumed (verbose output)

---

## Recommendation by Use Case

| Scenario | Use This |
|---|---|
| New project, full setup | Figma Official (desktop or remote) |
| Quick one-shot implementation | Framelink |
| Legacy designs (no Auto Layout) | Smart Position fork |
| MCP connection issues | Direct REST API |
| Maximum accuracy | Official + Code Connect + design system rules |
| Token-efficient reading | Framelink (simplified output) |
| Writing back to Figma | Official remote (`use_figma`) |

## Using Multiple Servers Together

You can configure multiple Figma MCP servers simultaneously:

```json
{
  "mcpServers": {
    "figma-official": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/figma-mcp-server"]
    },
    "figma-framelink": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

**Strategy**:
- Use Official for Code Connect lookups and design system search
- Use Framelink for actual design context (cleaner, more accurate output)
- This gives you the best of both worlds

**Warning**: Each connected server adds to your token overhead. Only connect what you're actively using.
