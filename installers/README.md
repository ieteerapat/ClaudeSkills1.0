# Installers

Setup scripts for companion tools that complement the skills in this repo.

## RTK (Rust Token Killer)

[RTK](https://github.com/rtk-ai/rtk) (59.9K ⭐, Apache 2.0) is a CLI proxy that filters and compresses command output **before it reaches the LLM context** — 60-90% token savings on common dev commands. It's a single Rust binary with <10ms overhead and 100+ supported commands.

### Why it's an installer, not a skill

RTK ships its own Claude Code integration. `rtk init -g` installs a `PreToolUse` hook plus an `RTK.md` instruction file that the agent loads automatically. Wrapping that in a custom skill would duplicate what RTK maintains upstream (and our agentskills.io review rejects redundant skills). So the right artifact is a thin installer that sets RTK up and gets out of the way.

### How it works

```
Claude --git status--> RTK --> git
   ^                    |        |
   |   ~200 tokens      | filter |
   +---- (filtered) ----+--------+
```

A `PreToolUse` hook transparently rewrites Bash commands (`git status` → `rtk git status`) before execution. The agent receives compact output without calling `rtk` explicitly. Four strategies: smart filtering, grouping, truncation, deduplication.

### Install

**macOS / Linux / WSL / Git Bash:**
```bash
sh installers/install-rtk.sh            # install + global hook
sh installers/install-rtk.sh --local    # also inject into ./CLAUDE.md for this project
```

**Native Windows (PowerShell):**
```powershell
./installers/install-rtk.ps1
```

The script auto-detects the best install method (Homebrew → curl → cargo → prebuilt binary), then runs `rtk init -g` to wire the Claude Code hook. Restart Claude Code afterward.

### Platform support

| Feature | macOS / Linux / WSL / Git Bash | Native Windows |
|---|---|---|
| Filters (git, cargo, npm, etc.) | Full | Full |
| Auto-rewrite hook | Yes | No (CLAUDE.md fallback) |
| `rtk gain` analytics | Full | Full |

On native Windows the auto-rewrite hook needs a Unix shell, so RTK falls back to CLAUDE.md injection — the agent gets RTK instructions but commands aren't auto-rewritten. **Use WSL or Git Bash for full hook support.**

### Verify / use

```bash
rtk --version          # confirm installed
rtk init --show        # confirm hook + RTK.md + settings.json wired
rtk gain               # token savings stats
rtk git status         # try a filtered command
rtk gain --graph       # 30-day savings graph
rtk discover           # find missed savings opportunities
```

### Token savings (per RTK's benchmarks, 30-min session)

| Command | Without | With RTK | Saved |
|---|---|---|---|
| cat / read | 40,000 | 12,000 | -70% |
| grep / rg | 16,000 | 3,200 | -80% |
| git diff | 10,000 | 2,500 | -75% |
| cargo/npm test | 25,000 | 2,500 | -90% |
| git add/commit/push | 1,600 | 120 | -92% |
| **Total** | **~118,000** | **~23,900** | **-80%** |

### Uninstall

```bash
rtk init -g --uninstall   # remove hook, RTK.md, settings.json entry
brew uninstall rtk        # or: cargo uninstall rtk
```

### Config

`~/.config/rtk/config.toml` (macOS: `~/Library/Application Support/rtk/config.toml`):
```toml
[hooks]
exclude_commands = ["curl", "playwright"]   # skip rewrite for these

[tee]
enabled = true       # save raw output on failure so the LLM can read it without re-running
mode = "failures"    # "failures" | "always" | "never"
```

### Privacy

Telemetry is **disabled by default** and requires explicit opt-in. RTK never collects source code, file paths, command arguments, secrets, or env vars. Disable permanently: `export RTK_TELEMETRY_DISABLED=1`.
