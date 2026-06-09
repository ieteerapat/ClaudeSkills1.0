#!/usr/bin/env sh
# setup-obsidian-mcp.sh — connect Claude Code to the repo's Obsidian vault via MCP.
#
# Gives Claude semantic search + structured read/write over the vault through the
# Obsidian Local REST API plugin (server: MarkusPfundstein/mcp-obsidian via uvx).
#
# Usage:  sh installers/setup-obsidian-mcp.sh
#
# What it does:
#   1. Installs `uv` (provides uvx) if missing
#   2. Installs the Local REST API plugin into vault/ and enables it
#   3. Generates a local API key (gitignored — never committed)
#   4. Registers the `obsidian` MCP server in Claude Code (user scope)
#
# Runtime requirement: Obsidian must be RUNNING with this repo's vault open and
# the Local REST API plugin enabled. The MCP server talks to 127.0.0.1:27124,
# which only listens while Obsidian is open.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VAULT_DIR="$REPO_DIR/vault"
PLUGIN_DIR="$VAULT_DIR/.obsidian/plugins/obsidian-local-rest-api"
PORT=27124

echo "==> Obsidian MCP setup"
[ -d "$VAULT_DIR/.obsidian" ] || { echo "[!!] no vault at $VAULT_DIR — run setup-obsidian-vault.sh first"; exit 1; }

# 1. Install uv / uvx
if command -v uvx >/dev/null 2>&1; then
  echo "[ok] uvx present: $(uvx --version)"
elif command -v pip >/dev/null 2>&1; then
  echo "[..] installing uv via pip"; pip install uv
elif command -v curl >/dev/null 2>&1; then
  echo "[..] installing uv via official installer"; curl -LsSf https://astral.sh/uv/install.sh | sh
else
  echo "[!!] need pip or curl to install uv. See https://docs.astral.sh/uv/"; exit 1
fi

# 2. Ensure the Local REST API plugin is present + enabled
if [ ! -f "$PLUGIN_DIR/main.js" ]; then
  echo "[!!] Local REST API plugin not found in the vault."
  echo "    Install it in Obsidian: Settings -> Community plugins -> Browse ->"
  echo "    'Local REST API' -> Install -> Enable. Then re-run this script."
  echo "    (Or copy an existing install into: $PLUGIN_DIR)"
  exit 1
fi
echo "[ok] Local REST API plugin present"

# enable it
CP="$VAULT_DIR/.obsidian/community-plugins.json"
[ -f "$CP" ] || printf '[\n  "obsidian-local-rest-api"\n]\n' > "$CP"

# 3. Generate an API key if none exists (gitignored)
DATA="$PLUGIN_DIR/data.json"
if [ -f "$DATA" ] && command -v node >/dev/null 2>&1 && node -e "process.exit(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).apiKey?0:1)" "$DATA" 2>/dev/null; then
  KEY="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).apiKey)" "$DATA")"
  echo "[ok] reusing existing API key"
else
  KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)"
  node -e "require('fs').writeFileSync(process.argv[1], JSON.stringify({port:$PORT,insecurePort:27123,enableInsecureServer:false,apiKey:process.argv[2],crypto:{}},null,2))" "$DATA" "$KEY"
  echo "[ok] generated new API key (stored locally, gitignored)"
fi

# 4. Register the MCP server in Claude Code (user scope)
if command -v claude >/dev/null 2>&1; then
  claude mcp remove obsidian --scope user >/dev/null 2>&1 || true
  claude mcp add obsidian --scope user \
    --env OBSIDIAN_API_KEY="$KEY" \
    --env OBSIDIAN_HOST=127.0.0.1 \
    --env OBSIDIAN_PORT=$PORT \
    -- uvx mcp-obsidian
  echo "[ok] registered 'obsidian' MCP server in Claude Code (user scope)"
else
  echo "[!!] claude CLI not found. Add this to your MCP config manually:"
  echo '    "obsidian": { "command": "uvx", "args": ["mcp-obsidian"],'
  echo "      \"env\": { \"OBSIDIAN_API_KEY\": \"$KEY\", \"OBSIDIAN_HOST\": \"127.0.0.1\", \"OBSIDIAN_PORT\": \"$PORT\" } }"
fi

echo ""
echo "Done. To use it:"
echo "  1. Open Obsidian with this vault: $VAULT_DIR"
echo "  2. Ensure 'Local REST API' plugin is enabled (Settings -> Community plugins)"
echo "  3. Restart Claude Code, then: claude mcp list   (obsidian should show Connected)"
echo ""
echo "Note: the MCP server only connects while Obsidian is running with this vault open."
