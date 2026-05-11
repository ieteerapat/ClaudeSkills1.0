---
name: "Figma Design-to-Code (Token Efficient)"
description: "Converts Figma designs to production code using minimal token budget. Use when implementing UI from Figma designs, extracting design systems, or generating components from Figma MCP data."
---

# Figma Design-to-Code (Token Efficient)

Convert Figma designs to production-ready code with minimal token usage.

## When to use

- Implementing a UI component from a Figma design
- Extracting design system tokens from Figma
- Generating multiple components from a design file
- Syncing design changes to code

## Instructions

### Phase 1: Preparation (before MCP calls)

1. Check if `tokens.ts` or equivalent design token file exists in project
2. Check if target component has been partially implemented
3. Identify the exact Figma node ID(s) needed — ask user if not provided
4. Determine target framework (React, Vue, Svelte, etc.) from project structure

### Phase 2: Minimal Data Extraction

1. If no cached tokens exist:
   - Call `get_local_variables` once
   - Save result to `src/design-tokens/` or equivalent
   - Never call this again in the same session

2. For the target component:
   - Call `get_file_nodes` with specific node ID only
   - Extract: structure, constraints, auto-layout properties
   - Do NOT fetch the entire file or page

3. For referenced components:
   - Only fetch if not already in local component library
   - Get one at a time, implement, then move to next

### Phase 3: Code Generation

Generate code in this order (not all at once):

1. **Structure** — HTML/JSX skeleton matching Figma layer tree
2. **Tokens** — Apply design tokens from cached file
3. **Layout** — Flexbox/Grid matching auto-layout settings
4. **Responsive** — Breakpoint behavior (ask user for requirements)
5. **Interactions** — States, hover, focus (only if specified in design)

### Phase 4: Validation

- Compare generated structure against Figma node tree
- Verify all design tokens are referenced (not hardcoded values)
- Check accessibility: semantic HTML, ARIA labels, contrast

## Output Format

```
[Component Name]
├── Structure: [brief description]
├── Tokens used: [list referenced tokens]
├── Layout: [auto-layout → CSS mapping]
└── Code: [implementation]
```

## Examples

### Input
```
Frame: "Card/Product" (node_id: 456:789)
File: abc123def
Framework: React + Tailwind
```

### Output
```tsx
// ProductCard.tsx — from Figma node 456:789
import { colors, spacing, typography } from '@/tokens';

export function ProductCard({ title, price, image }: ProductCardProps) {
  return (
    <article className="flex flex-col gap-4 p-4 rounded-lg bg-surface">
      <img src={image} alt={title} className="aspect-video object-cover rounded" />
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-primary font-bold">{price}</span>
      </div>
    </article>
  );
}
```

## Common Edge Cases

- **Missing tokens**: If Figma uses raw hex values instead of variables, flag it and suggest token creation
- **Complex nesting**: Flatten unnecessary wrapper layers from Figma's layer structure
- **Responsive gaps**: Figma shows one breakpoint — ask user about mobile/tablet behavior before generating
- **Icon handling**: Extract SVGs separately, don't inline large SVG data in components
