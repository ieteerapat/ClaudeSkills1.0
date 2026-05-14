# Figma MCP Server Options (Updated May 2026)

## 1. Figma Official Remote MCP Server (RECOMMENDED)

The official Figma MCP server is now the recommended approach. It connects directly to your Figma files via HTTP — no desktop app required.

**URL**: `https://mcp.figma.com/mcp`

### Setup for Claude Code (Preferred — Official Plugin)

```bash
claude plugin install figma@claude-plugins-official
```

This installs:
- MCP server configuration
- Agent Skills for common workflows (implement-design, create-design-system-rules, code-connect)
- Asset handling rules

### Setup for Claude Code (Manual)

```bash
# Project-level:
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Global (all projects):
claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp
```

### Setup for VS Code

```json
{
  "servers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

### Setup for Cursor

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

### Features
- **Write to canvas**: Create/modify native Figma content (frames, components, variables, auto layout)
- **Generate designs from live UI**: Capture web app UI → Figma Design file
- **Generate code from frames**: Select frame → get code
- **Extract design context**: Variables, components, layout data
- **Code Connect**: Map Figma components to code components
- **Generate diagrams**: Create FigJam diagrams from Mermaid/natural language
- **Search design system**: Find components/variables across all libraries
- **Design system rules**: Generate project-specific CLAUDE.md rules

### All Official Tools (May 2026)

| Tool | Purpose | Rate Limited |
|---|---|---|
| `get_design_context` | Full design data for a node | Yes |
| `get_metadata` | Sparse XML structure (IDs, names, types, positions) | Yes |
| `get_variable_defs` | Variables and styles in selection | Yes |
| `get_screenshot` | Screenshot of selection | Yes |
| `get_code_connect_map` | Figma node → code component mapping | Yes |
| `add_code_connect_map` | Add node-to-code mapping | Yes |
| `get_code_connect_suggestions` | AI suggestions for Code Connect | Yes |
| `send_code_connect_mappings` | Confirm Code Connect mappings | Yes |
| `create_design_system_rules` | Generate rules file for your project | Yes |
| `search_design_system` | Search libraries for components/variables | Yes (remote only) |
| `use_figma` | Execute Plugin API JavaScript in Figma | No (remote only) |
| `generate_figma_design` | Generate design layers from live UI | No (remote only) |
| `generate_diagram` | Create FigJam diagram from Mermaid | No (remote only) |
| `create_new_file` | Create new Figma/FigJam file | No (remote only) |
| `whoami` | Get authenticated user info | No (remote only) |
| `get_figjam` | Convert FigJam to XML | Yes |

### Rate Limits

| Plan | Limit |
|---|---|
| Starter / View / Collab seats | 6 calls/month |
| Professional (Dev/Full seat) | Per-minute (Tier 1 REST API limits) |
| Organization (Dev/Full seat) | Per-minute (Tier 1 REST API limits) |
| Enterprise (Dev/Full seat) | Per-minute (Tier 1 REST API limits) |

**Important**: `use_figma`, `generate_figma_design`, `generate_diagram`, and `create_new_file` are EXEMPT from rate limits.

---

## 2. Figma Desktop MCP Server (Local)

Works with Figma desktop app. Selection-based — select a node in Figma, AI reads it automatically.

**Setup**: Built into Figma desktop app. Enable in Figma settings.

**Key difference from remote**: 
- No URL needed (uses current selection)
- No `fileKey` parameter needed in tool calls
- Some tools not available (no `use_figma`, no `search_design_system`)

**Best for**: Quick iteration when you have Figma desktop open.

---

## 3. Framelink MCP (GLips/Figma-Context-MCP)

**Best for**: Simplified layout data that produces better one-shot implementations with less token waste.

**What it does differently**: Simplifies and translates Figma API responses so only the most relevant layout and styling information reaches the AI. Less noise = more accurate interpretation.

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
- Simplified output = less tokens, more accurate AI interpretation
- 11,600+ developers using it
- Works with any MCP client

**Cons**:
- No Code Connect
- No `use_figma` (read-only)
- No `search_design_system`
- Requires personal access token (not OAuth)

**Repo**: https://github.com/GLips/Figma-Context-MCP

---

## 4. Smart Position Fork (tianmuji/figma-context-mcp)

**Best for**: Designs using absolute positioning instead of Auto Layout.

**What it adds**: x, y, width, height for non-AutoLayout elements. Helps AI infer layout from absolute positioning.

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

**Repo**: https://github.com/tianmuji/Figma-Context-MCP

---

## 5. Figma Console MCP (southleft)

**Best for**: Design system as an API — extraction, creation, and debugging.

**Repo**: https://github.com/southleft/figma-console-mcp

---

## Recommendation (May 2026)

**For most users**: Install the official Figma plugin for Claude Code:
```bash
claude plugin install figma@claude-plugins-official
```

This gives you everything: MCP server, skills, Code Connect, design system rules, asset handling — all in one command.

**If you need better layout accuracy on non-AutoLayout designs**: Add Framelink or Smart Position fork alongside the official server.

**If you're on Starter plan (6 calls/month)**: Use Framelink with a personal access token instead — no rate limit concerns beyond standard API limits.
