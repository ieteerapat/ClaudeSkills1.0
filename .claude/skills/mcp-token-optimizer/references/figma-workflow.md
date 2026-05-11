# Figma MCP Workflow Reference

## Optimal Call Sequence for Design-to-Code

```
Step 1: Get file structure (minimal depth)
─────────────────────────────────────────
Tool: get_file
Args: { file_key: "...", depth: 1 }
Purpose: Understand page/frame layout without loading all nodes
Token cost: ~200-500 tokens

Step 2: Target specific frame
─────────────────────────────
Tool: get_file_nodes  
Args: { file_key: "...", ids: ["specific:node_id"] }
Purpose: Get full detail for only the frame you're implementing
Token cost: ~500-2000 tokens (vs 10,000+ for full file)

Step 3: Extract design tokens (once per session)
────────────────────────────────────────────────
Tool: get_local_variables
Args: { file_key: "..." }
Purpose: Get all variables/tokens, cache to local file
Token cost: ~1000 tokens (one-time)

Step 4: Get component definitions (as needed)
─────────────────────────────────────────────
Tool: get_component
Args: { key: "component_key" }
Purpose: Get specific component spec for implementation
Token cost: ~300-800 tokens per component
```

## Anti-Patterns to Avoid

| Anti-Pattern | Token Cost | Better Approach | Savings |
|---|---|---|---|
| Fetch entire file | 10,000-50,000 | Target specific nodes | 80-95% |
| Re-fetch tokens each component | 1,000 × N | Cache to file, reference | 90% |
| Ask "what's in this file" | 3,000-5,000 | Specify exact frame ID | 70% |
| Generate all variants at once | 5,000-15,000 | One variant, then iterate | 60% |
| Describe design in prose | 2,000-4,000 | Use structured token refs | 75% |

## Design Token Caching Strategy

After first extraction, save tokens to a local file:

```typescript
// tokens.ts — generated from Figma, cached locally
export const colors = {
  primary: { light: '#1a73e8', dark: '#8ab4f8' },
  surface: { light: '#ffffff', dark: '#1e1e1e' },
  // ...
} as const;

export const spacing = {
  xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px'
} as const;

export const typography = {
  h1: { size: '32px', weight: 700, lineHeight: '40px' },
  body: { size: '16px', weight: 400, lineHeight: '24px' },
  // ...
} as const;
```

Reference this file in subsequent prompts instead of re-fetching from Figma.

## Component Generation Template

When generating components from Figma data, follow this structure:

```
Input: [node structure from get_file_nodes]
Output format:
1. Component skeleton (structure only)
2. Apply design tokens from cached tokens.ts
3. Add responsive behavior
4. Add accessibility attributes
```

This avoids the common pattern of generating everything in one massive output.
