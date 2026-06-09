#!/usr/bin/env sh
# setup-obsidian-vault.sh — register this repo's vault/ folder with Obsidian
# so it opens as a local vault. Installs Obsidian first if missing.
#
# Usage:  sh installers/setup-obsidian-vault.sh
#
# Works on macOS, Linux, WSL, and Git Bash / MSYS on Windows.
set -e

echo "==> Obsidian vault setup"

# Resolve the vault path (this script lives in installers/, vault/ is its sibling)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VAULT_DIR="$REPO_DIR/vault"

if [ ! -d "$VAULT_DIR/.obsidian" ]; then
  echo "[!!] $VAULT_DIR is not an Obsidian vault (.obsidian missing)"
  exit 1
fi
echo "[ok] vault: $VAULT_DIR"

OS="$(uname -s 2>/dev/null || echo unknown)"

# 1. Install Obsidian if missing
have_obsidian() {
  case "$OS" in
    MINGW*|MSYS*|CYGWIN*)
      [ -f "$USERPROFILE/AppData/Local/Programs/Obsidian/Obsidian.exe" ] ;;
    Darwin) [ -d "/Applications/Obsidian.app" ] ;;
    *) command -v obsidian >/dev/null 2>&1 ;;
  esac
}

if have_obsidian; then
  echo "[ok] Obsidian already installed"
else
  echo "[..] installing Obsidian"
  case "$OS" in
    MINGW*|MSYS*|CYGWIN*) winget install -e --id Obsidian.Obsidian ;;
    Darwin) brew install --cask obsidian ;;
    *)
      if command -v flatpak >/dev/null 2>&1; then flatpak install -y flathub md.obsidian.Obsidian
      elif command -v snap >/dev/null 2>&1; then sudo snap install obsidian --classic
      else echo "[!!] Install Obsidian manually: https://obsidian.md/download"; fi ;;
  esac
fi

# 2. Compute the path Obsidian stores (Windows wants a backslash path)
case "$OS" in
  MINGW*|MSYS*|CYGWIN*)
    WIN_VAULT="$(cygpath -w "$VAULT_DIR" 2>/dev/null || echo "$VAULT_DIR")"
    OBS_JSON="$APPDATA/obsidian/obsidian.json" ;;
  Darwin)
    WIN_VAULT="$VAULT_DIR"
    OBS_JSON="$HOME/Library/Application Support/obsidian/obsidian.json" ;;
  *)
    WIN_VAULT="$VAULT_DIR"
    OBS_JSON="$HOME/.config/obsidian/obsidian.json" ;;
esac

echo "[ok] registering path: $WIN_VAULT"
echo "     obsidian.json: $OBS_JSON"

# 3. Register the vault in obsidian.json (merge, don't clobber existing vaults)
VAULT_ID="$(printf '%s' "$WIN_VAULT" | (sha1sum 2>/dev/null || shasum) | cut -c1-16)"
mkdir -p "$(dirname "$OBS_JSON")"

if command -v node >/dev/null 2>&1; then
  WIN_VAULT="$WIN_VAULT" VAULT_ID="$VAULT_ID" OBS_JSON="$OBS_JSON" node - <<'NODE'
const fs = require("fs");
const p = process.env.OBS_JSON;
const path = process.env.WIN_VAULT;
const id = process.env.VAULT_ID;
let data = { vaults: {} };
try { data = JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) {}
data.vaults = data.vaults || {};
// don't duplicate if an entry already points here
const exists = Object.values(data.vaults).some(v => v.path === path);
if (!exists) {
  data.vaults[id] = { path, ts: Date.now(), open: false };
  fs.writeFileSync(p, JSON.stringify(data));
  console.log("[ok] vault registered (id " + id + ")");
} else {
  console.log("[ok] vault already registered");
}
NODE
else
  echo "[!!] node not found — register manually:"
  echo "     Open Obsidian → 'Open folder as vault' → select:"
  echo "     $WIN_VAULT"
fi

echo ""
echo "Done. Open Obsidian and pick the vault, or it will appear in the vault switcher."
