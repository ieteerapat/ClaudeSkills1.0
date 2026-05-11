---
name: "Figma MCP Accuracy"
description: "Ensures pixel-perfect accuracy when reading and implementing Figma designs via MCP. Enforces the correct tool call sequence, handles large designs gracefully, validates output against screenshots, and prevents common fidelity failures. Use whenever implementing UI from Figma MCP data."
---

# Figma MCP Accuracy

Maximize design-to-code fidelity when reading from Figma MCP. Current AI tools achieve 65-80% accuracy by default — this skill pushes it toward 95%+ through structured workflows and validation loops.

## When to use

- Implementing any UI from a Figma design
- Extracting design tokens or component specs from Figma
- Validating implemented code against Figma source
- Working with large/complex Figma files that exceed token limits

## The Accuracy Problem

AI-assisted design-to-code typically fails on:
- **Spacing**: 4px vs 8px gaps, padding inconsistencies
- **Typography**: Wrong font weight, size, or line-height
- **Colors**: Close-but-wrong hex values, missing opacity
- **Layout**: Auto-layout direction misread, wrong constraints
- **Assets**: Hallucinated icons, placeholder images instead of real ones

Root cause: The AI doesn't have enough structured context, or processes too much at once and loses detail.

## Required Tool Call Sequence

Follow this exact order. Do NOT skip steps.

### Step 1: Parse the Figma URL

Extract from URL format: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y`
- `fileKey` = segment after `/design/`
- `nodeId` = value of `node-id` param (format: `X-Y`)

For desktop MCP: no fileKey needed, uses current selection.

### Step 2: Get Structure First (get_metadata)

```
get_metadata(fileKey=":fileKey", nodeId="X-Y")
```

Returns sparse XML with layer IDs, names, types, positions, sizes.
- Use this to understand the component hierarchy BEFORE fetching full context
- Identify which child nodes need individual fetching
- Plan your implementation order (top-down)

**Why metadata first**: `get_design_context` on large designs can return 351,000+ tokens and exceed limits. Metadata is lightweight and gives you the map.

### Step 3: Get Design Context (targeted)

For small/medium components (single frame, <20 layers):
```
get_design_context(fileKey=":fileKey", nodeId="X-Y")
```

For large/complex designs (full pages, >20 layers):
```
# Fetch each major section individually
get_design_context(fileKey=":fileKey", nodeId=":headerNodeId")
get_design_context(fileKey=":fileKey", nodeId=":contentNodeId")
get_design_context(fileKey=":fileKey", nodeId=":footerNodeId")
```

**Critical**: If response is truncated or exceeds token limit, STOP and break into smaller node fetches. Never proceed with partial data.

### Step 4: Get Screenshot (visual truth)

```
get_screenshot(fileKey=":fileKey", nodeId="X-Y")
```

This is your **source of truth** for validation. Keep it accessible throughout implementation.

### Step 5: Get Variables/Tokens

```
get_variable_defs(fileKey=":fileKey", nodeId="X-Y")
```

Returns colors, spacing, typography tokens used in the selection.
- Map these to your project's design token system
- Cache locally for reuse across components

### Step 6: Download Assets

If Figma MCP returns localhost URLs for images/icons/SVGs:
- Use those URLs directly
- Do NOT import icon packages
- Do NOT create placeholders
- Assets are served through Figma MCP's built-in endpoint

### Step 7: Implement with Validation

Generate code, then validate against the screenshot from Step 4.

## Accuracy Rules

### Spacing & Layout
- ALWAYS use exact pixel values from `get_design_context`, not approximations
- Auto-layout direction (HORIZONTAL/VERTICAL) maps to flex-row/flex-col
- `itemSpacing` = gap between children
- `paddingTop/Right/Bottom/Left` = exact padding values
- `primaryAxisSizingMode: AUTO` = content-hugging
- `counterAxisSizingMode: FIXED` = explicit width/height

### Typography
- Extract exact: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
- `lineHeight` in Figma can be: AUTO, px value, or percentage — handle each
- `letterSpacing` can be px or percentage
- Font weight names vary: "SemiBold" vs "Semi Bold" vs "Semibold" — use exact string from Figma

### Colors
- Figma uses 0-1 range internally, MCP returns hex or rgba
- Always include opacity when present (don't assume 100%)
- Map to design tokens where possible, but use exact values if no token matches
- Check for gradient fills — they need special handling

### Components & Variants
- Check if your project already has a matching component before creating new
- If extending existing: add variant, don't duplicate
- Preserve Figma's component property names in your props interface

### Responsive Behavior
- Figma shows ONE breakpoint — ask user about responsive requirements
- `constraints` in Figma map to CSS positioning behavior
- `layoutGrow: 1` = flex-grow: 1
- `layoutAlign: STRETCH` = align-self: stretch

## Validation Checklist

Before marking implementation complete:

- [ ] Layout matches screenshot (spacing, alignment, sizing)
- [ ] Typography matches (font, size, weight, line-height, letter-spacing)
- [ ] Colors match exactly (including opacity)
- [ ] Border radius values are correct
- [ ] Shadows/effects match
- [ ] Assets render (no broken images, no placeholder icons)
- [ ] Interactive states work (hover, active, disabled, focus)
- [ ] Accessibility: semantic HTML, ARIA labels, contrast ratios

## Handling Common Failures

### "Response exceeds maximum allowed tokens (25000)"

The design is too large for a single `get_design_context` call.

**Fix**:
1. Use `get_metadata` to get the node tree
2. Identify top-level sections
3. Fetch each section individually
4. Implement section by section

### "Spacing is wrong by 2-4px"

The AI approximated instead of using exact values.

**Fix**:
- Always extract exact `itemSpacing`, `paddingTop/Right/Bottom/Left` from design context
- Never round or approximate spacing values
- Cross-reference with screenshot if values seem off

### "Wrong font weight"

Figma font style names don't always map cleanly to CSS weights.

**Fix**:
- "Thin" = 100, "Light" = 300, "Regular" = 400
- "Medium" = 500, "SemiBold" = 600, "Bold" = 700
- "ExtraBold" = 800, "Black" = 900
- When in doubt, use the exact `fontWeight` number from design context

### "Colors are slightly off"

The AI used a close color instead of the exact token.

**Fix**:
- Always use hex/rgba values directly from `get_design_context`
- If a design token exists with that value, reference the token
- If no token matches, use the literal value (don't approximate to nearest token)

### "Auto-layout not matching"

**Fix**:
- Check `layoutMode`: HORIZONTAL = row, VERTICAL = column
- Check `primaryAxisAlignItems`: MIN = start, CENTER = center, MAX = end, SPACE_BETWEEN = space-between
- Check `counterAxisAlignItems`: MIN = start, CENTER = center, MAX = end
- Check `layoutWrap`: WRAP = flex-wrap

### "Icons are wrong or missing"

**Fix**:
- Use ONLY assets from Figma MCP response
- Never substitute with icon library icons
- If SVG data is provided, use it inline or save to assets folder
- If localhost URL is provided, download from that URL

## Token-Efficient Accuracy

Achieving accuracy WITHOUT burning excessive tokens:

1. **Metadata first** (cheap) → understand structure
2. **Targeted context** (moderate) → fetch only what you need
3. **Screenshot once** (moderate) → visual reference for validation
4. **Variables once** (cheap) → cache tokens locally
5. **Implement incrementally** → one section at a time, validate each

Total cost for a typical component: ~3,000-5,000 tokens
vs. naive approach (full file fetch): ~15,000-50,000+ tokens

## Project Rules Template

Add to your project's CLAUDE.md for consistent Figma implementation:

```markdown
## Figma Implementation Rules
- Framework: [React/Vue/Svelte/etc.]
- Styling: [Tailwind/CSS Modules/Styled Components/etc.]
- Design tokens location: [path to tokens file]
- Component directory: [path to components]
- Naming convention: [PascalCase/kebab-case]
- Always use get_metadata before get_design_context on large designs
- Always validate against get_screenshot before marking complete
- Map Figma tokens to project tokens in [tokens file path]
```
