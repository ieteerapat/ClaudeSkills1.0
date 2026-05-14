---
name: figma-accuracy
description: Ensures pixel-perfect accuracy when reading and implementing Figma designs via MCP. Enforces correct tool sequence, handles large designs, validates against screenshots, and uses design system rules for consistent output. Use whenever implementing UI from Figma MCP data.
---

# Figma MCP Accuracy

Maximize design-to-code fidelity when reading from Figma MCP. Default AI accuracy is 65-80%. This skill pushes toward 95%+ through structured workflows, design system rules, and validation loops.

## When to use

- Implementing any UI from a Figma design
- Extracting design tokens or component specs from Figma
- Validating implemented code against Figma source
- Working with large/complex Figma files that exceed token limits
- Setting up a project for consistent Figma-to-code output

## Why Accuracy Fails (Root Causes)

1. **No project rules** — AI doesn't know your conventions, guesses class names and structure
2. **Wrong tool order** — Fetching full context before understanding structure wastes tokens and truncates
3. **No visual validation** — AI never compares output against the actual design
4. **No Code Connect** — AI creates new components instead of reusing existing ones
5. **Hardcoded values** — AI uses literal hex/px instead of design tokens
6. **Large designs truncated** — `get_design_context` exceeds 25K token limit, data is lost

## Setup (Do This First)

### Install Official Figma Plugin for Claude Code

```bash
claude plugin install figma@claude-plugins-official
```

This single command installs:
- Figma MCP server (remote, HTTP-based, `https://mcp.figma.com/mcp`)
- Agent Skills: `figma-implement-design`, `figma-create-design-system-rules`, `figma-code-connect`
- Asset handling rules

If you prefer manual setup:
```bash
claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp
```

### Environment Variable (for large designs)
```bash
MAX_MCP_OUTPUT_TOKENS=100000
```

## The Accuracy Stack (3 Layers)

### Layer 1: Design System Rules (one-time setup)

Run `create_design_system_rules` ONCE per project. This generates a rules file (CLAUDE.md / AGENTS.md) that tells the AI:
- Where components live
- What styling approach to use
- Where design tokens are defined
- How to name and structure components
- What to never hardcode

```
create_design_system_rules(clientLanguages="typescript", clientFrameworks="react")
```

This single step eliminates the #1 cause of inaccuracy: the AI guessing your conventions.

### Layer 2: Code Connect (component mapping)

Set up Code Connect to map Figma components → your code components:

```
get_code_connect_map(fileKey=":fileKey", nodeId="X-Y")
```

When Code Connect is configured:
- AI knows which existing component to use for each Figma instance
- No duplicate components created
- Props map correctly from Figma variants to code props
- Import paths are correct

### Layer 3: Structured Read Workflow (every implementation)

Follow this exact sequence for every Figma implementation:

## Required Tool Call Sequence

### Step 1: Parse the Figma URL

Extract from: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y`
- `fileKey` = segment after `/design/`
- `nodeId` = value of `node-id` param (format: `X-Y`)

For desktop MCP: no fileKey needed, uses current selection.

### Step 2: Get Structure First (get_metadata)

```
get_metadata(fileKey=":fileKey", nodeId="X-Y")
```

Returns sparse XML: layer IDs, names, types, positions, sizes.
- Understand hierarchy BEFORE fetching full context
- Identify which child nodes need individual fetching
- Plan implementation order (top-down)

**Why first**: `get_design_context` can return 351,000+ tokens on large designs and exceed limits. Metadata is lightweight.

### Step 3: Get Design Context (targeted)

**Small/medium components** (<20 layers):
```
get_design_context(fileKey=":fileKey", nodeId="X-Y")
```

**Large/complex designs** (full pages, >20 layers):
```
# Fetch each major section individually using IDs from metadata
get_design_context(fileKey=":fileKey", nodeId=":headerNodeId")
get_design_context(fileKey=":fileKey", nodeId=":contentNodeId")
get_design_context(fileKey=":fileKey", nodeId=":footerNodeId")
```

**If response exceeds token limit**: STOP. Break into smaller node fetches. Never proceed with partial data.

### Step 4: Get Screenshot (visual truth)

```
get_screenshot(fileKey=":fileKey", nodeId="X-Y")
```

This is your **source of truth**. Keep accessible throughout implementation. Compare final output against this.

### Step 5: Get Variables/Tokens

```
get_variable_defs(fileKey=":fileKey", nodeId="X-Y")
```

Returns colors, spacing, typography tokens. Map to your project's token system. Cache locally.

### Step 6: Check Code Connect

```
get_code_connect_map(fileKey=":fileKey", nodeId="X-Y")
```

If mappings exist: USE the mapped components. Don't recreate.
If no mappings: check your component library manually before creating new.

### Step 7: Download Assets

If Figma MCP returns localhost URLs for images/icons/SVGs:
- **Use those URLs directly**
- **DO NOT** import icon packages (no lucide, no heroicons, no font-awesome)
- **DO NOT** create placeholders
- Assets are served through Figma MCP's built-in endpoint

### Step 8: Implement with Project Conventions

Translate Figma output (React + Tailwind default) into YOUR project's:
- Framework (Vue, Svelte, Angular, etc.)
- Styling approach (CSS Modules, styled-components, etc.)
- Component patterns (naming, props, file structure)
- Design tokens (your token file, not hardcoded values)

### Step 9: Validate Against Screenshot

Compare implementation against Step 4 screenshot:

- [ ] Layout matches (spacing, alignment, sizing)
- [ ] Typography matches (font, size, weight, line-height)
- [ ] Colors match exactly (including opacity)
- [ ] Border radius correct
- [ ] Shadows/effects match
- [ ] Assets render (no broken images, no wrong icons)
- [ ] Interactive states work (hover, active, disabled)

If using Playwright MCP: take a browser screenshot and compare programmatically.

## Accuracy Boosters

### Use Auto Layout in Figma (designer responsibility)

Components built with Auto Layout produce MUCH better code because responsive intent is captured in the data. If designs use absolute positioning, accuracy drops significantly.

### Name Layers Semantically (designer responsibility)

- `CardContainer` → AI generates meaningful class/component names
- `Group 45` → AI guesses, output is inconsistent

### Use Framelink MCP for Better Layout Data

The official Figma MCP sometimes lacks position data for non-AutoLayout elements. **Framelink** (GLips/Figma-Context-MCP) simplifies and translates responses for better layout accuracy:

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

Or use the **Smart Position fork** (tianmuji/figma-context-mcp) which adds x/y/width/height for non-AutoLayout elements:

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

### Visual Verification Loop (Playwright)

For pixel-perfect results, add Playwright MCP to create a self-correction loop:

1. Implement from Figma data
2. Render in browser via Playwright
3. Screenshot the rendered output
4. Compare against Figma screenshot
5. Fix discrepancies
6. Repeat until match

### Figma File Structure Tips (for designers)

Tell your designers these improve AI accuracy:
- Use Auto Layout everywhere (not absolute positioning)
- Name layers semantically (not "Frame 1", "Group 2")
- Use variables/tokens for colors and spacing (not raw hex)
- Keep component variants organized in component sets
- Publish components to team library
- Set up Code Connect mappings

## Handling Common Failures

### "Response exceeds maximum allowed tokens (25000)"

```bash
# Fix: Set environment variable
MAX_MCP_OUTPUT_TOKENS=100000
```

Or: use `get_metadata` first, then fetch child nodes individually.

### Spacing is wrong by 2-4px

- Always use exact `itemSpacing`, `paddingTop/Right/Bottom/Left` from design context
- Never round or approximate
- Cross-reference with screenshot

### Wrong font weight

| Figma Style | CSS weight |
|---|---|
| Thin | 100 |
| Light | 300 |
| Regular | 400 |
| Medium | 500 |
| SemiBold | 600 |
| Bold | 700 |
| ExtraBold | 800 |
| Black | 900 |

### Colors slightly off

- Use hex/rgba directly from `get_design_context`
- If design token exists with that value, reference the token
- If no token matches, use literal value (don't approximate)

### Icons are wrong or missing

- Use ONLY assets from Figma MCP response
- Never substitute with icon library
- If SVG data provided, use inline or save to assets
- If localhost URL provided, download from that URL

### Auto-layout not matching

| Figma | CSS |
|---|---|
| `layoutMode: HORIZONTAL` | `flex-direction: row` |
| `layoutMode: VERTICAL` | `flex-direction: column` |
| `primaryAxisAlignItems: MIN` | `justify-content: flex-start` |
| `primaryAxisAlignItems: CENTER` | `justify-content: center` |
| `primaryAxisAlignItems: MAX` | `justify-content: flex-end` |
| `primaryAxisAlignItems: SPACE_BETWEEN` | `justify-content: space-between` |
| `counterAxisAlignItems: MIN` | `align-items: flex-start` |
| `counterAxisAlignItems: CENTER` | `align-items: center` |
| `layoutWrap: WRAP` | `flex-wrap: wrap` |
| `layoutGrow: 1` | `flex-grow: 1` |
| `layoutAlign: STRETCH` | `align-self: stretch` |

## MCP Server Options (May 2026)

| Server | Setup | Best For |
|---|---|---|
| **Figma Official Plugin** | `claude plugin install figma@claude-plugins-official` | Full accuracy — Code Connect, design system rules, write-to-canvas |
| **Figma Official (manual)** | `claude mcp add --transport http figma https://mcp.figma.com/mcp` | Same as above without bundled skills |
| **Framelink** (GLips) | `npx figma-developer-mcp --figma-api-key=KEY --stdio` | Simplified output, better one-shot accuracy, no rate limit concerns |
| **Smart Position** (tianmuji) | `npx figma-context-mcp --figma-api-key=KEY --stdio` | Non-AutoLayout designs with absolute positioning |
| **Direct REST API** | `curl -H "X-Figma-Token: KEY" https://api.figma.com/v1/...` | Fallback when MCP fails |

See `references/mcp-servers.md` for full setup configs for each.

## Quick Setup Checklist

- [ ] Install official plugin: `claude plugin install figma@claude-plugins-official`
- [ ] Run `create_design_system_rules` for your project
- [ ] Set up Code Connect for your component library
- [ ] Set `MAX_MCP_OUTPUT_TOKENS=100000` in environment
- [ ] Add Figma implementation rules to CLAUDE.md (auto-generated by step 2)
- [ ] Cache design tokens locally after first extraction
- [ ] (Optional) Add Framelink MCP for simplified layout data on Starter plans
- [ ] (Optional) Add Playwright MCP for visual verification loop
