# Companion Tools Setup Guide

Tools that stack with this skills package for maximum token savings.

## Tier 1: Highest Impact (install these first)

### RTK — Command Output Compression
**What**: Rust CLI proxy that intercepts bash output and compresses it before it reaches context.
**Impact**: 60-90% reduction on test/build/git output. cargo test with 262 tests: 4,823 → 11 tokens.
**Install**:
```bash
# macOS/Linux
cargo install rtk-lite-cc

# Or via npm
npm install -g rtk
```
**How it works**: Uses a PreToolUse hook to rewrite bash commands (e.g., `cargo test` → `rtk cargo test`). The compressed output enters context instead of raw terminal dump.
**Repo**: https://github.com/rtk-ai/rtk

---

### Context Mode — MCP Output Sandboxing
**What**: MCP server that sandboxes tool output. Raw data never enters context; only summaries do.
**Impact**: 98% reduction. 315KB Playwright snapshot → 5.4KB summary.
**Install**:
```bash
# Inside Claude Code:
/plugin marketplace add mksglu/context-mode
/plugin install context-mode@context-mode
```
**Key concept**: "Think in Code" — instead of reading 50 files into context, write a script that processes them and returns only the result.
**Repo**: https://github.com/mksglu/context-mode

---

### CodeGraph — Knowledge Graph for Codebases
**What**: Pre-indexed code knowledge graph. Agents query the graph instead of scanning files.
**Impact**: 92% fewer tool calls, 71% faster exploration. Zero file reads needed.
**Install**:
```bash
npx @colbymchenry/codegraph
cd your-project
codegraph init -i
```
**Best for**: Large codebases (500+ files). The agent uses `codegraph_explore` instead of grep/glob/read.
**Repo**: https://github.com/colbymchenry/codegraph

---

## Tier 2: Session Continuity

### Claude-Mem — Persistent Memory Across Sessions
**What**: Captures everything Claude does, compresses it with AI, injects relevant context into future sessions.
**Impact**: Eliminates re-discovery costs. No more "let me re-read the codebase" at session start.
**Install**:
```bash
npx claude-mem install
```
**Features**: Progressive disclosure, semantic search, web viewer UI, privacy controls.
**Repo**: https://github.com/thedotmack/claude-mem

---

### Graphify — Knowledge Graph + Memory (Obsidian-based)
**What**: Turns code, PDFs, and markdown into a persistent knowledge graph queryable in plain English.
**Impact**: Up to 71.5x fewer tokens per session on large codebases.
**Install**:
```bash
# Inside Claude Code:
/graphify
```
**Best for**: Projects with lots of documentation, specs, and cross-file relationships.
**Repo**: https://github.com/lucasrosati/claude-code-memory-setup

---

## Tier 3: Output Compression

### Caveman — Extreme Prose Compression
**What**: Makes Claude respond in compressed "caveman speak" — same technical accuracy, 75% fewer words.
**Impact**: 65% mean output reduction (range 22-87%).
**Install**:
```bash
# Windows PowerShell:
irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex

# macOS/Linux:
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
```
**Note**: Stacks with the token-saver skill in this package. Caveman is more aggressive.
**Repo**: https://github.com/JuliusBrussee/caveman

---

## Tier 4: Model Routing

### Claude Router — Automatic Model Selection
**What**: Routes queries to optimal model (Haiku/Sonnet/Opus) based on complexity.
**Impact**: 60-95% cost reduction by using cheaper models for simple tasks.
**Repo**: https://github.com/0xrdan/claude-router

---

## Recommended Stack Combinations

### Budget-Conscious Developer
```
This skills package + RTK + Caveman
Expected savings: 70-85% total token reduction
```

### Large Codebase Team
```
This skills package + CodeGraph + Claude-Mem + RTK
Expected savings: 80-95% total token reduction
```

### Figma-Heavy Workflow
```
This skills package + Context Mode + Claude-Mem
Expected savings: 85-95% on Figma MCP operations
```

### Maximum Savings (all tools)
```
This skills package + RTK + Context Mode + CodeGraph + Claude-Mem + Caveman
Expected savings: 90-98% total token reduction
```
