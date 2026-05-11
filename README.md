# Claude Code MCP Optimizer

A drop-in skills package for Claude Code that reduces token drain when working with MCP servers (especially Figma MCP), enforces token-efficient communication, and provides hooks for automated waste prevention.

## What's Included

```
claude-code-mcp-optimizer/
├── CLAUDE.md                              # Project-level rules (terse output, MCP discipline, model routing)
├── .claude/
│   ├── settings.json                      # Token caps + context statusline
│   ├── commands/
│   │   ├── compact-now.md                 # /compact-now — smart context compaction
│   │   ├── figma-extract.md              # /figma-extract — token-efficient Figma data pull
│   │   ├── token-audit.md                # /token-audit — check session token health
│   │   ├── save-state.md                 # /save-state — persist context before compaction
│   │   └── restore-state.md             # /restore-state — resume from saved state
│   ├── hooks/
│   │   ├── prevent-large-reads.json      # Warns before cat-ing files >100KB
│   │   ├── context-budget-alert.json     # Alerts at 500K+ tokens
│   │   └── read-before-edit.json         # Prevents editing unread files
│   └── skills/
│       ├── mcp-token-optimizer/          # Core MCP optimization skill
│       │   ├── SKILL.md
│       │   └── references/
│       │       ├── figma-workflow.md      # Optimal Figma MCP call sequences
│       │       ├── token-budget-rules.md  # Token drain analysis & mitigation
│       │       └── companion-tools.md    # Setup guide for RTK, CodeGraph, etc.
│       ├── figma-design-to-code/         # Figma → Code with minimal tokens
│       │   └── SKILL.md
│       ├── token-saver/                  # Output compression (always active)
│       │   └── SKILL.md
│       ├── output-filter/                # Command output compression
│       │   └── SKILL.md
│       ├── session-memory/               # Cross-session context preservation
│       │   └── SKILL.md
│       └── model-routing/                # Opus/Sonnet/Haiku cost optimization
│           └── SKILL.md
├── README.md
└── SOURCES.md                            # All GitHub repos & research links
```

## Installation

### Option A: Per-Project (recommended)

```bash
git clone https://github.com/ieteerapat/ClaudeSkills1.0.git
cp -r ClaudeSkills1.0/.claude/ /path/to/your/project/
cp ClaudeSkills1.0/CLAUDE.md /path/to/your/project/
```

### Option B: Global (applies to all projects)

```bash
git clone https://github.com/ieteerapat/ClaudeSkills1.0.git
cp -r ClaudeSkills1.0/.claude/skills/* ~/.claude/skills/
```

### Option C: Cherry-pick

| Want | Copy |
|---|---|
| Just token savings | `.claude/skills/token-saver/` + `CLAUDE.md` |
| Just Figma optimization | `.claude/skills/figma-design-to-code/` + `.claude/skills/mcp-token-optimizer/` |
| Just hooks | `.claude/hooks/` |
| Just slash commands | `.claude/commands/` |
| Just model routing advice | `.claude/skills/model-routing/` |
| Session memory | `.claude/skills/session-memory/` + `.claude/commands/save-state.md` + `.claude/commands/restore-state.md` |

## Skills Overview

| Skill | Purpose | Activation |
|---|---|---|
| `token-saver` | Enforces terse responses, 60-75% output reduction | Always active |
| `mcp-token-optimizer` | Progressive disclosure, MCP caching strategy | When using MCP tools |
| `figma-design-to-code` | Token-efficient Figma → code workflow | When working with Figma |
| `output-filter` | Compresses test/build/git output | When running shell commands |
| `session-memory` | Preserves context across compactions | Before compaction or new sessions |
| `model-routing` | Routes tasks to cheapest capable model | When starting tasks |

## Hooks

| Hook | Trigger | Action |
|---|---|---|
| `prevent-large-reads` | Before shell commands | Warns if cat-ing files >100KB |
| `context-budget-alert` | After any tool use | Alerts when session exceeds 500K tokens |
| `read-before-edit` | Before file writes | Ensures files are read before editing |

## Slash Commands

| Command | Purpose |
|---|---|
| `/figma-extract` | One-shot targeted Figma data extraction |
| `/token-audit` | Check current session token health |
| `/compact-now` | Smart manual compaction preserving key context |
| `/save-state` | Persist session state before compaction |
| `/restore-state` | Resume from saved state in new session |

## Expected Savings

| Scenario | Without | With | Reduction |
|---|---|---|---|
| Figma component extraction | ~15,000 tokens | ~3,000 tokens | 80% |
| MCP server startup (5 servers) | ~55,000 tokens | ~5,000 tokens (skills) | 91% |
| Code generation response | ~500 tokens | ~150 tokens | 70% |
| Test output (100 tests) | ~5,000 tokens | ~200 tokens | 96% |
| Long session (before compaction) | 200K+ (auto-compact) | ~120K (manual) | 40% |
| Cross-session re-discovery | ~50,000 tokens | ~2,000 tokens (cached) | 96% |

## Companion Tools (Stack for Maximum Savings)

These tools work alongside this skills package. See `references/companion-tools.md` for full setup guide.

| Tool | What It Does | Impact | Install |
|---|---|---|---|
| [RTK](https://github.com/rtk-ai/rtk) | Compresses bash output before context | 60-90% on shell output | `cargo install rtk-lite-cc` |
| [Context Mode](https://github.com/mksglu/context-mode) | Sandboxes MCP tool output | 98% on large outputs | `/plugin marketplace add mksglu/context-mode` |
| [CodeGraph](https://github.com/colbymchenry/codegraph) | Knowledge graph for code exploration | 92% fewer tool calls | `npx @colbymchenry/codegraph` |
| [Claude-Mem](https://github.com/thedotmack/claude-mem) | Persistent memory across sessions | Eliminates re-discovery | `npx claude-mem install` |
| [Caveman](https://github.com/JuliusBrussee/caveman) | Extreme output compression | 75% output reduction | `curl -fsSL .../install.sh \| bash` |
| [Claude Router](https://github.com/0xrdan/claude-router) | Auto model routing by complexity | 60-95% cost reduction | See repo |

### Recommended Stacks

**Budget-conscious**: This package + RTK + Caveman → 70-85% savings

**Large codebase**: This package + CodeGraph + Claude-Mem + RTK → 80-95% savings

**Figma-heavy**: This package + Context Mode + Claude-Mem → 85-95% savings

**Maximum**: All of the above → 90-98% savings

## How It Works

### The Problem
- MCP servers load ALL tool definitions at startup (5,000-80,000+ tokens)
- Auto-compaction fires at 93% context, costs 100-200K tokens each time
- Verbose responses waste 60-75% of output tokens on fluff
- Command outputs (tests, builds, git) dump raw data into context
- Each new session re-discovers the same codebase from scratch

### This Package Solves It By
1. **Progressive disclosure** — Skills load on-demand (~50 tokens idle vs 5,000+ for MCP)
2. **Caching** — Extract data once, save to files, reference thereafter
3. **Targeted fetching** — Specific node IDs and filters, never bulk operations
4. **Output compression** — 60-75% reduction in response verbosity
5. **Proactive compaction** — Compact at 60% instead of waiting for 93%
6. **Session memory** — Persist state to files, restore without re-fetching
7. **Model routing** — Use cheapest model that can handle each task
8. **Hooks** — Automated guards against common token waste patterns

## Customization

- Edit `CLAUDE.md` to add your project's framework and conventions
- Adjust thinking token cap in `.claude/settings.json`
- Modify hook thresholds (file size, token budget) in `.claude/hooks/`
- Add project-specific design tokens to the Figma skill references
- Remove skills you don't need — they're independent

## Contributing

Found a new tool or technique? Open a PR adding it to `SOURCES.md` and optionally create a new skill or reference file.

## Research Sources

See [SOURCES.md](./SOURCES.md) for the complete list of 50+ GitHub repos, articles, and official documentation used to build this package.
