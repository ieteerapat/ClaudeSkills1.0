# install-rtk.ps1 — install RTK (Rust Token Killer) on native Windows and wire it into Claude Code.
# RTK compresses command output before it reaches the LLM context (60-90% token savings).
# Repo: https://github.com/rtk-ai/rtk  |  License: Apache 2.0
#
# Usage (PowerShell):
#   ./installers/install-rtk.ps1
#   ./installers/install-rtk.ps1 -Local    # inject RTK into ./CLAUDE.md for this project
#
# Note: On native Windows the auto-rewrite hook is not supported — RTK falls back
# to CLAUDE.md injection (the agent gets RTK instructions but commands are not
# auto-rewritten). For full hook support, use WSL or Git Bash with install-rtk.sh.

param([switch]$Local)

$ErrorActionPreference = "Stop"
Write-Host "==> RTK installer (Windows)"

function Test-Cmd($name) {
  $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# 1. Install if missing
if (Test-Cmd "rtk") {
  Write-Host "[ok] rtk already installed: $(rtk --version)"
} else {
  Write-Host "[..] rtk not found — installing"
  if (Test-Cmd "cargo") {
    Write-Host "    using cargo"
    cargo install --git https://github.com/rtk-ai/rtk
  } else {
    Write-Host "[..] Downloading prebuilt Windows binary from latest release"
    $bin = "$env:USERPROFILE\.local\bin"
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    $zip = "$env:TEMP\rtk-win.zip"
    $url = "https://github.com/rtk-ai/rtk/releases/latest/download/rtk-x86_64-pc-windows-msvc.zip"
    Invoke-WebRequest -Uri $url -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $bin -Force
    Remove-Item $zip
    # Add ~/.local/bin to user PATH if not present
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$bin*") {
      [Environment]::SetEnvironmentVariable("Path", "$userPath;$bin", "User")
      Write-Host "    added $bin to user PATH (restart terminal to take effect)"
    }
    $env:Path = "$env:Path;$bin"
  }
}

# 2. Verify
if (-not (Test-Cmd "rtk")) {
  Write-Host "[!!] rtk not on PATH yet. Restart PowerShell and re-run, or add"
  Write-Host "     $env:USERPROFILE\.local\bin to PATH manually."
  exit 1
}
Write-Host "[ok] $(rtk --version)"

# 3. Wire into Claude Code (CLAUDE.md injection on native Windows)
if ($Local) {
  Write-Host "==> Injecting RTK into ./CLAUDE.md (project scope)"
  rtk init --auto-patch
} else {
  Write-Host "==> Configuring global RTK (CLAUDE.md fallback on native Windows)"
  rtk init -g --auto-patch
}

# 4. Status
Write-Host "==> Status"
rtk init --show

Write-Host ""
Write-Host "Done. Restart Claude Code."
Write-Host "Tip: for full auto-rewrite hook support, use WSL or Git Bash + install-rtk.sh"
