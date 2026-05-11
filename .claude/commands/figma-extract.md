Extract design data from Figma for the specified frame/component. Follow this sequence:

1. Check if design tokens are already cached in the project (look for tokens.ts, tokens.json, or similar)
2. If not cached: call get_local_variables once and save to src/design-tokens/
3. Call get_file_nodes with ONLY the specified node ID
4. Extract: component structure, auto-layout properties, referenced tokens
5. Output a structured summary (not raw JSON)

Format output as:
```
Component: [name]
Structure: [layer tree, simplified]
Layout: [auto-layout → CSS mapping]
Tokens: [list of design tokens used]
Ready for: [framework] implementation
```

Do NOT fetch the entire file. Do NOT re-fetch tokens if already cached.

Arguments: $ARGUMENTS (expects: file_key and node_id, optionally framework)
