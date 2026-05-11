# Claude Code MCP Optimizer

A drop-in skills package for Claude Code that reduces token drain when working with MCP servers (especially Figma MCP) and enforces token-efficient communication patterns.

## What's Included

```
claude-code-mcp-optimizer/
├── CLAUDE.md                          # Project-level rules (terse output, MCP discipline)
├── .claude/
│   ├── settings.json                  # Token caps + context statusline
│   ├── commands/
│   │   ├── compact-now.md             # /compact-now — smart context compaction
│   │   ├── figma-extract.md           # /figma-extract — token-efficient Figma data pull
│   │   └── token-audit.md             # /token-audit — check session token health
│   └── skills/
│       ├── mcp-token-optimizer/       # Core MCP optimization skill
│       │   ├── SKILL.md
│       │   └── references/
│       │       ├── figma-workflow.md   # Optimal Figma MCP call sequences
│       │       └── token-budget-rules.md
│       ├── figma-design-to-code/      # Figma → Code with minimal tokens
│       │   └── SKILL.md
│       └── token-saver/               # Output compression (always active)
│           └── SKILL.md
└── README.md
```

## Installation

### Option A: Per-Project (recommended)

Copy the `.claude/` folder and `CLAUDE.md` into your project root:

```bash
# Clone or download this repo
git clone <this-repo-url> /tmp/claude-mcp-optimizer

# Copy into your project
cp -r /tmp/claude-mcp-optimizer/.claude/ /path/to/your/project/.claude/
cp /tmp/claude-mcp-optimizer/CLAUDE.md /path/to/your/project/CLAUDE.md
```

### Option B: Global (applies to all projects)

Copy skills to your user-level Claude directory:

```bash
# Copy skills globally
cp -r .claude/skills/* ~/.claude/skills/

# Merge settings (don't overwrite if you have existing settings)
# Manually add the preferences from .claude/settings.json to ~/.claude/settings.json
```

### Option C: Cherry-pick what you need

- **Just token savings?** Copy only `.claude/skills/token-saver/` and `CLAUDE.md`
- **Just Figma optimization?** Copy `.claude/skills/figma-design-to-code/` and `.claude/skills/mcp-token-optimizer/`
- **Just slash commands?** Copy `.claude/commands/`

## Usage

### Automatic (Skills)

Skills activate automatically when Claude detects relevant context:
- Working with MCP → `mcp-token-optimizer` activates
- Figma design work → `figma-design-to-code` activates
- All interactions → `token-saver` provides baseline compression

### Manual (Slash Commands)

```
/figma-extract file_key=abc123 node_id=456:789 framework=react
/token-audit
/compact-now
```

## Expected Savings

| Scenario | Without Optimizer | With Optimizer | Reduction |
|---|---|---|---|
| Figma component extraction | ~15,000 tokens | ~3,000 tokens | 80% |
| General MCP workflow | ~57,000 tokens startup | ~5,000 tokens | 91% |
| Code generation response | ~500 tokens | ~150 tokens | 70% |
| Long session (before compaction) | 200K+ (auto-compact) | ~120K (manual compact) | 40% |

## How It Works

### The MCP Token Tax Problem

Every connected MCP server loads ALL tool definitions into context at startup. 5 servers with 60 tools = ~55,000 tokens burned before you do anything.

### This Package Solves It By:

1. **Progressive disclosure** — Skills load only when needed (~50 tokens idle vs 5,000+ for MCP tools)
2. **Caching strategy** — Extract data once from MCP, save to files, reference files thereafter
3. **Targeted fetching** — Never bulk-fetch; always use specific node IDs and filters
4. **Output compression** — 60-75% reduction in Claude's response verbosity
5. **Proactive compaction** — Compact at 60% context instead of waiting for 93% auto-compaction

### Figma-Specific Optimizations

- Cache design tokens locally after first extraction
- Use node IDs instead of fetching entire files
- Generate components incrementally (structure → tokens → layout)
- Batch related component fetches

## Complementary Tools

These work well alongside this skills package:

| Tool | What It Does | Install |
|---|---|---|
| [caveman](https://github.com/JuliusBrussee/caveman) | Extreme output compression (75% reduction) | `curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh \| bash` |
| [token-optimizer-mcp](https://github.com/ooples/token-optimizer-mcp) | MCP-level caching and compression | Add as MCP server |
| [claude-token-efficient](https://github.com/drona23/claude-token-efficient) | Single CLAUDE.md for terse output | Drop-in file |

## Customization

### Adjust verbosity level

Edit `.claude/skills/token-saver/SKILL.md` — the "Override" section defines when Claude should be verbose.

### Add project-specific tokens

After first Figma extraction, your cached tokens file becomes the source of truth. Update it when designs change rather than re-fetching everything.

### Disable specific skills

Remove or rename the skill directory to disable it. Skills are independent — removing one doesn't affect others.

## Research Sources

- [The Hidden Token Tax of MCP Servers](https://smithhorngroup.substack.com/p/the-hidden-token-tax-of-mcp-servers) — MCP vs Skills token comparison
- [Claude Code Skills: 98% Token Savings Architecture](https://codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide) — Progressive disclosure explained
- [Figma MCP Skills Documentation](https://developers.figma.com/docs/figma-mcp-server/create-skills/) — Official Figma skill creation guide
- [Reduce Claude Code Tokens: 10 Tested Tools](https://computingforgeeks.com/reduce-claude-code-token-usage-tools/) — Benchmarked comparison of optimization tools
- [A Practical Guide to Cutting Token Usage by 50%+](https://aleksandar.xyz/blog/2026-04-13-a-practical-guide-to-cutting-claude-code-token-usage-by-50-plus/) — Four token drain categories and mitigations
