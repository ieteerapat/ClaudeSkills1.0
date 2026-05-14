# Claude Code MCP Optimizer

A lean skills package for Claude Code focused on **Figma MCP accuracy** and **token efficiency**. Validated against the [agentskills.io](https://agentskills.io) open standard.

## Philosophy

Per [agentskills.io best practices](https://agentskills.io/skill-creation/best-practices.md):
- Skills should add what the agent **wouldn't know without them**
- Rules the agent already follows (be terse, use diffs) belong in CLAUDE.md, not skills
- Skills should be **procedural workflows**, not declarative style guides

This package keeps only skills that pass the test: "Would the agent get this wrong without the skill?"

## What's Included

```
claude-code-mcp-optimizer/
├── CLAUDE.md                              # Project rules (response style, token budget, MCP discipline)
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
│   │   └── read-before-edit.json         # Ensures files are read before editing
│   └── skills/
│       ├── figma-accuracy/               # Pixel-perfect Figma MCP workflow
│       │   ├── SKILL.md
│       │   └── references/
│       │       ├── mcp-servers.md        # All Figma MCP server options + configs
│       │       ├── property-mapping.md   # Figma → CSS exact translation tables
│       │       └── tool-reference.md     # All 16 official tools documented
│       └── session-memory/               # Cross-session context preservation
│           └── SKILL.md
├── README.md
└── SOURCES.md                            # All research links
```

## Skills (2 — validated against agentskills.io)

| Skill | Why It Passes | What It Does |
|---|---|---|
| `figma-accuracy` | Agent gets Figma implementation wrong 65-80% of the time without structured workflow | Enforces correct tool sequence, handles large designs, validates against screenshots, uses Code Connect |
| `session-memory` | Agent has no built-in way to persist state across compactions | Saves/restores work state to files so you never re-discover the same codebase |

### What Was Removed (and why)

| Removed Skill | Reason | Where It Went |
|---|---|---|
| `token-saver` | Response style rules — agent follows these from CLAUDE.md | Absorbed into CLAUDE.md |
| `output-filter` | Same — formatting rules, not a procedure | Absorbed into CLAUDE.md |
| `model-routing` | Declarative info agent already knows. Claude Code has /fast built-in | Absorbed into CLAUDE.md |
| `mcp-token-optimizer` | Overlapped with figma-accuracy. General MCP rules are in CLAUDE.md | Split between CLAUDE.md and figma-accuracy |
| `figma-design-to-code` | Fully overlapped with figma-accuracy which is more thorough | Merged into figma-accuracy |

## Installation

### For Claude Code

```bash
# Clone
git clone https://github.com/ieteerapat/ClaudeSkills1.0.git

# Copy into your project
cp -r ClaudeSkills1.0/.claude/ /path/to/your/project/
cp ClaudeSkills1.0/CLAUDE.md /path/to/your/project/
```

### Global (all projects)

```bash
cp -r ClaudeSkills1.0/.claude/skills/* ~/.claude/skills/
```

## Figma MCP Setup (Quick Start)

```bash
# 1. Install official Figma plugin (includes MCP server + skills)
claude plugin install figma@claude-plugins-official

# 2. Set token limit for large designs
export MAX_MCP_OUTPUT_TOKENS=100000

# 3. Generate project-specific rules (one-time)
# In Claude Code, prompt: "create design system rules for my project"
```

## Companion Tools

| Tool | What It Does | Install |
|---|---|---|
| [RTK](https://github.com/rtk-ai/rtk) | Compresses bash output 60-90% | `cargo install rtk-lite-cc` |
| [Context Mode](https://github.com/mksglu/context-mode) | Sandboxes MCP output, 98% reduction | `/plugin marketplace add mksglu/context-mode` |
| [CodeGraph](https://github.com/colbymchenry/codegraph) | Knowledge graph, 92% fewer tool calls | `npx @colbymchenry/codegraph` |
| [Claude-Mem](https://github.com/thedotmack/claude-mem) | Persistent memory across sessions | `npx claude-mem install` |
| [Caveman](https://github.com/JuliusBrussee/caveman) | Extreme output compression 75% | `curl -fsSL .../install.sh \| bash` |

## Research Sources

See [SOURCES.md](./SOURCES.md) for 50+ GitHub repos, articles, and official documentation.

## Validation

Skills in this package follow the [Agent Skills specification](https://agentskills.io/specification.md):
- `name`: lowercase, hyphens only, matches folder name
- `description`: describes what + when to use
- Body: procedural instructions, not declarative rules
- Under 500 lines, references/ for detailed content
- Evaluated per [agentskills.io/skill-creation/evaluating-skills](https://agentskills.io/skill-creation/evaluating-skills.md)
