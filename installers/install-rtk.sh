#!/usr/bin/env sh
# install-rtk.sh — install RTK (Rust Token Killer) and wire it into Claude Code.
# RTK compresses command output before it reaches the LLM context (60-90% token savings).
# Repo: https://github.com/rtk-ai/rtk  |  License: Apache 2.0
#
# Usage:
#   sh installers/install-rtk.sh            # install + global Claude Code hook
#   sh installers/install-rtk.sh --local    # also inject RTK into ./CLAUDE.md for this project
#
# Works on: macOS, Linux, WSL, and Git Bash / MSYS2 on Windows.
set -e

LOCAL_SCOPE=0
[ "$1" = "--local" ] && LOCAL_SCOPE=1

echo "==> RTK installer"

# 1. Install the binary if missing
if command -v rtk >/dev/null 2>&1; then
  echo "[ok] rtk already installed: $(rtk --version)"
else
  echo "[..] rtk not found — installing"
  if command -v brew >/dev/null 2>&1; then
    echo "    using Homebrew"
    brew install rtk
  elif command -v curl >/dev/null 2>&1; then
    echo "    using curl install script (-> ~/.local/bin)"
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
    # ensure ~/.local/bin is on PATH for this session
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) : ;;
      *) export PATH="$HOME/.local/bin:$PATH" ;;
    esac
  elif command -v cargo >/dev/null 2>&1; then
    echo "    using cargo"
    cargo install --git https://github.com/rtk-ai/rtk
  else
    echo "[!!] No brew, curl, or cargo found. Install one, or download a prebuilt"
    echo "     binary from https://github.com/rtk-ai/rtk/releases"
    exit 1
  fi
fi

# 2. Verify
if ! command -v rtk >/dev/null 2>&1; then
  echo "[!!] rtk still not on PATH. Add this to your shell rc and re-open the terminal:"
  echo '     export PATH="$HOME/.local/bin:$PATH"'
  exit 1
fi
echo "[ok] $(rtk --version)"

# 3. Wire into Claude Code
if [ "$LOCAL_SCOPE" -eq 1 ]; then
  echo "==> Injecting RTK into ./CLAUDE.md (project scope)"
  rtk init --auto-patch || rtk init
else
  echo "==> Installing global Claude Code hook + RTK.md"
  rtk init -g --auto-patch || rtk init -g
fi

# 4. Show status
echo "==> Status"
rtk init --show || true

echo ""
echo "Done. Restart Claude Code so the hook loads."
echo "Test:  rtk gain        (token savings)   |   rtk git status   (filtered)"
