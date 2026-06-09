# Obsidian MCP Integration

Connect Claude Code to the repo's `vault/` so it can **search, read, and write** notes through Obsidian's API — not just raw files. Powered by [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) (3.9K ⭐) over the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin.

## File access vs MCP — when to use which

| | File access (default) | Obsidian MCP |
|---|---|---|
| How | Claude reads/writes `vault/*.md` directly | Claude calls Obsidian's REST API |
| Needs Obsidian running | No | **Yes** |
| Token overhead | Zero | MCP tool definitions per session |
| Capabilities | read/write files | search, list, get, patch, append, delete via API |
| Best for | simple save/restore memory | semantic search, structured queries across the vault |

The `session-memory` skill works fine with file access alone. Add MCP when you want Claude to **search the whole vault** or do structured note operations.

## Setup

```bash
sh installers/setup-obsidian-mcp.sh
```

This:
1. Installs `uv` (provides `uvx`) if missing
2. Ensures the Local REST API plugin is in `vault/` and enabled
3. Generates a local API key (gitignored — never committed)
4. Registers the `obsidian` MCP server in Claude Code (user scope)

### One manual step (first time only)

Community plugins can't be installed headlessly. If the plugin isn't already in the vault:

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search **Local REST API** → Install → Enable
3. Re-run `setup-obsidian-mcp.sh`

(If you already have it in another vault, the installer can reuse the plugin files.)

## Runtime requirement

The MCP server talks to `127.0.0.1:27124`, which **only listens while Obsidian is running with this vault open** and the Local REST API plugin enabled. So:

- Obsidian closed → `claude mcp list` shows `obsidian ✘ Failed to connect` (normal)
- Obsidian open with the vault → `obsidian ✔ Connected`

## Tools the MCP server exposes

| Tool | What it does |
|---|---|
| `list_files_in_vault` | List all files/dirs in the vault root |
| `list_files_in_dir` | List a specific directory |
| `get_file_contents` | Read a note |
| `search` | Full-text search across the vault |
| `patch_content` | Insert relative to a heading/block/frontmatter |
| `append_content` | Append to a new or existing note |
| `delete_file` | Delete a file/dir |

## Verify

```bash
# 1. Open Obsidian with the repo vault
# 2. Confirm Local REST API is enabled (Settings -> Community plugins)
claude mcp list                 # obsidian should show ✔ Connected
```

Then prompt Claude: *"Using Obsidian, search the vault for 'figma' and summarize what you find."*

## Security

- The API key lives in `vault/.obsidian/plugins/obsidian-local-rest-api/data.json` — **gitignored**.
- It's also stored in Claude Code's user config (`~/.claude.json`) which isn't part of this repo.
- The REST API binds to localhost only. Never expose port 27124 publicly.
- `.mcp.json` (if you use project scope instead of user scope) is gitignored — use `.mcp.json.example` as the template.

## Remove

```bash
claude mcp remove obsidian --scope user
```
