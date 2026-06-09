# Memory Vault

An Obsidian vault that serves as the **persistent memory store** for this repo's `session-memory` skill. It survives Claude Code compactions and new sessions, so the agent never re-discovers the same context twice.

## Why an Obsidian vault?

- **Cross-session memory**: session state, decisions, and extracted knowledge persist as Markdown notes
- **Linkable**: `[[wikilinks]]` and the graph view connect related context (a session → the decision it produced → the file it touched)
- **Searchable**: full-text + tags, so the agent (and you) can recall past work fast
- **Plain Markdown**: version-controlled, readable without Obsidian, portable across tools

## Structure

```
vault/
├── .obsidian/        # Obsidian config (makes this a vault)
├── Index.md          # vault home / map of content
├── Sessions/         # one note per work session (state, decisions, next steps)
├── Knowledge/        # durable knowledge (design tokens, architecture, conventions)
├── Daily/            # daily notes (auto-dated)
└── _templates/       # note templates (session, knowledge, daily)
```

## How it ties to the `session-memory` skill

The `session-memory` skill writes session state before compaction and reads it back in new sessions. Point it at this vault:

1. Before compacting: save a note in `Sessions/` using the session template
2. New session: read the latest `Sessions/` note to restore context
3. Durable facts (design tokens, decisions) graduate from a session note into `Knowledge/`

## Open this vault in Obsidian

It's registered automatically by `installers/setup-obsidian-vault.sh`. Or open manually:

1. Open Obsidian → **Open folder as vault**
2. Select this `vault/` directory
3. Local path: `C:\Users\<you>\...\claude-code-mcp-optimizer\vault`

## Conventions

- One session = one note in `Sessions/` named `YYYY-MM-DD-<slug>.md`
- Link sessions to the knowledge they produce: `[[Knowledge/design-tokens]]`
- Tag by project/area: `#figma`, `#mcp`, `#video`
- Keep notes terse — this is memory, not documentation
