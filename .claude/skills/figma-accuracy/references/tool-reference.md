# Figma MCP Tools Reference

Complete reference for all Figma MCP server tools, their token cost, and when to use each.

## Tools Overview

| Tool | Purpose | Token Cost | When to Use |
|---|---|---|---|
| `get_metadata` | Sparse XML of layer structure | Low (~200-500) | ALWAYS first — understand structure |
| `get_design_context` | Full design data (layout, styles, tokens) | High (~2,000-351,000) | After metadata, targeted to specific nodes |
| `get_variable_defs` | Variables and styles in selection | Medium (~500-2,000) | Once per session, cache result |
| `get_screenshot` | Visual screenshot of selection | Medium (~1,000) | Once per component for validation |
| `get_code_connect_map` | Mapping between Figma nodes and code components | Low (~300-800) | When project uses Code Connect |
| `add_code_connect_map` | Add node-to-code mapping | Low (~200) | Setting up Code Connect |
| `get_code_connect_suggestions` | AI suggestions for Code Connect mappings | Medium (~500-1,500) | Initial Code Connect setup |
| `search_design_system` | Search libraries for components/variables | Medium (~500-2,000) | Before creating new components |
| `create_design_system_rules` | Generate agent rules file | Medium (~1,000-3,000) | One-time project setup |
| `use_figma` | Execute Plugin API JavaScript in Figma | Variable | Writing to Figma files |
| `generate_figma_design` | Generate design layers from code | Variable | Code-to-canvas workflows |

## Optimal Call Sequence for Reading

```
┌─────────────────────────────────────────────────────┐
│ 1. get_metadata (understand structure)              │
│    ↓                                                │
│ 2. get_design_context (targeted nodes only)         │
│    ↓                                                │
│ 3. get_screenshot (visual validation reference)     │
│    ↓                                                │
│ 4. get_variable_defs (design tokens — cache this)   │
└─────────────────────────────────────────────────────┘
```

## Tool Details

### get_metadata

**Returns**: Sparse XML with basic properties:
- Layer IDs
- Layer names
- Node types (FRAME, TEXT, RECTANGLE, COMPONENT, INSTANCE, etc.)
- Position (x, y)
- Size (width, height)

**Use for**:
- Understanding page/frame hierarchy before deep fetching
- Identifying which child nodes to fetch individually
- Planning implementation order
- Breaking large designs into manageable chunks

**Does NOT return**: Colors, typography details, spacing, effects, constraints

---

### get_design_context

**Returns**: Full structured design data:
- Layout properties (Auto Layout direction, spacing, padding, sizing modes)
- Typography (font family, size, weight, line-height, letter-spacing)
- Colors (fills, strokes with exact values)
- Component structure and variants
- Constraints and responsive behavior
- Design token references

**Known issue**: Can return 351,000+ tokens on large designs, exceeding Claude's 25,000 token MCP limit.

**Mitigation**:
1. Set `MAX_MCP_OUTPUT_TOKENS=100000` in environment variables
2. Or: use `get_metadata` first, then fetch individual child nodes

**Output format**: React + Tailwind by default. Customizable via prompt:
- "generate my Figma selection in Vue"
- "generate my Figma selection in plain HTML + CSS"
- "generate my Figma selection in iOS"

---

### get_variable_defs

**Returns**: Variables and styles used in selection:
- Color variables (with mode values: light/dark)
- Spacing variables
- Typography variables
- Variable collection names and modes

**Best practice**: Call once, cache to local file, reference thereafter.

---

### get_screenshot

**Returns**: PNG screenshot of the selected node/frame.

**Use for**:
- Visual validation source of truth
- Comparing implemented code against design
- Understanding visual relationships not captured in structured data

**Note**: Consumes tokens for the image. Use once per component, not repeatedly.

---

### get_code_connect_map

**Returns**: Object mapping Figma node IDs to code components:
```json
{
  "nodeId": {
    "componentName": "Button",
    "source": "src/components/Button.tsx",
    "snippet": "...",
    "label": "React"
  }
}
```

**Use for**: Identifying which project components already map to Figma components. Prevents recreating existing components.

---

### search_design_system (remote only)

**Returns**: Components, variables, and styles matching a text query across all connected libraries.

**Use for**:
- Finding existing components before creating new ones
- Discovering available design tokens
- Checking if a component variant already exists

---

## Rate Limits

| Plan | Limit |
|---|---|
| Starter | 6 calls/month |
| Professional | 50 calls/day |
| Organization | 200 calls/day |
| Enterprise | 600 calls/day |

**Implication**: Every call counts. Use `get_metadata` (cheap) to plan, then make targeted `get_design_context` calls only for what you need.

## Environment Variables

```bash
# Increase MCP output token limit (default: 25000)
MAX_MCP_OUTPUT_TOKENS=100000
```

Add to Claude Code settings or shell environment to handle large Figma responses.
