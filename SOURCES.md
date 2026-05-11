# Sources & GitHub Links

All repositories and resources referenced in building this skills package.

## Token Optimization Tools

| Tool | Description | Link |
|---|---|---|
| caveman | Output compression skill (~75% token reduction) | https://github.com/JuliusBrussee/caveman |
| token-optimizer-mcp | MCP-level caching, 95%+ token reduction | https://github.com/ooples/token-optimizer-mcp |
| claude-token-efficient | Single CLAUDE.md for terse output (~63% reduction) | https://github.com/drona23/claude-token-efficient |
| claude-token-optimizer | Reusable setup prompts, 90% savings | https://github.com/nadimtuhin/claude-token-optimizer |
| token-optimizer (hooks) | Find ghost tokens, survive compaction | https://github.com/alexgreensh/token-optimizer |
| context-optimizer-mcp-server | Targeted extraction for AI assistants | https://github.com/malaksedarous/context-optimizer-mcp-server |
| mcp-code-execution-enhanced | Skills framework, 99.6% token reduction | https://github.com/yoloshii/mcp-code-execution-enhanced |
| RTK | CLI proxy, 60-90% bash output compression (Rust) | https://github.com/rtk-ai/rtk |
| Context Mode | MCP output sandboxing, 98% reduction, 15 platforms | https://github.com/mksglu/context-mode |
| CodeGraph | Pre-indexed knowledge graph, 92% fewer tool calls | https://github.com/colbymchenry/codegraph |
| Claude-Mem | Persistent memory across sessions, auto-compression | https://github.com/thedotmack/claude-mem |
| Claude Memory Setup (Graphify) | Obsidian + knowledge graph, 71.5x fewer tokens | https://github.com/lucasrosati/claude-code-memory-setup |
| Claude Router | Auto model routing (Haiku/Sonnet/Opus) by complexity | https://github.com/0xrdan/claude-router |

## Hooks & Automation

| Resource | Description | Link |
|---|---|---|
| 3 Hooks to Reduce Token Waste | PreToolUse hooks (2,100+ reactions) | https://gist.github.com/yurukusa/0648214b9ec0af93706a899169791fcd |
| 4-Layer Hook Workflow | PostToolUse, PreToolUse, PreCompact patterns | https://ceaksan.com/en/claude-code-hooks-workflow-automation/ |
| Anthropic: Hooks Guide | Official hooks documentation | https://docs.anthropic.com/en/docs/claude-code/hooks-guide |
| Anthropic: Hooks Reference | Hook lifecycle and configuration | https://code.claude.com/docs/en/hooks |
| RTK Hook Integration | How RTK uses PreToolUse to intercept bash | https://shipyard.build/blog/reduce-claude-code-token-usage/ |

## Knowledge & Guides

| Resource | Description | Link |
|---|---|---|
| Token Saving Guide (Gist) | Compacting strategies, CLAUDE.md structure | https://gist.github.com/artemgetmann/74f28d2958b53baf50597b669d4bce43 |
| Everything Claude Code | Token optimization docs | https://github.com/affaan-m/everything-claude-code/blob/main/docs/token-optimization.md |
| Claude Code Best Practice (MCP) | MCP best practices | https://github.com/shanraisshan/claude-code-best-practice/blob/main/best-practice/claude-mcp.md |
| 55 Claude Code Tips | Power user tips and tricks | https://developersdigest.tech/blog/claude-code-tips-tricks |
| Claude Code Features Q2 2026 | Feature surface analysis | https://www.wal.sh/research/2026-q2-claude-code-features |
| Agent Memory Best Practices | Cross-session memory strategies | https://orchestrator.dev/blog/2026-04-06--claude-code-agent-memory-2026 |
| Subagents Practical Guide | Parallel task dispatch patterns | https://timewell.jp/en/columns/claude-code-subagents-practical-guide |

## Figma MCP

| Resource | Description | Link |
|---|---|---|
| Figma MCP Skills Docs | Official guide to creating Figma MCP skills | https://developers.figma.com/docs/figma-mcp-server/create-skills/ |
| Figma MCP Tools & Prompts | All official tools with usage docs | https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/ |
| Figma Implement Design Skill | Official pixel-perfect workflow | https://developers.figma.com/docs/figma-mcp-server/skill-figma-implement-design/ |
| Figma Create Design System Rules | Generate project-specific rules for accuracy | https://developers.figma.com/docs/figma-mcp-server/skill-figma-create-design-system-rules/ |
| Figma Code Connect Setup | Map Figma components to code components | https://developers.figma.com/docs/code-connect/code-connect-ui-setup |
| Figma Add Custom Rules | Project-level instructions for AI | https://developers.figma.com/docs/figma-mcp-server/add-custom-rules |
| Figma MCP Known Issues | Token limit errors and fixes | https://developers.figma.com/docs/figma-mcp-server/mcp-clients-issues/ |
| Figma MCP Server Guide (GitHub) | Official skills repo with SKILL.md files | https://github.com/figma/mcp-server-guide |
| Framelink MCP (GLips) | Simplified layout data, 11.6K+ users | https://github.com/GLips/Figma-Context-MCP |
| Smart Position Fork (tianmuji) | Adds x/y/width/height for non-AutoLayout | https://github.com/tianmuji/Figma-Context-MCP |
| Figma MCP + Claude Code | Builder.io integration guide | https://www.builder.io/blog/claude-code-figma-mcp-server |
| Figma Implementation Accuracy | Claude Code rules for consistent output | https://devtools.shingoirie.com/blog/en/claude-code-rules-figma-implementation/ |
| Pixel-Perfect with Playwright | Visual verification loop (65-80% baseline) | https://vadim.blog/pixel-perfect-playwright-figma-mcp |
| Figma Design-to-Code Workflow | End-to-end workflow guide | https://sergeichyrkov.com/blog/claude-code-figma-mcp-design-to-code-workflow |
| Structure Figma Files for MCP | How designers can improve AI accuracy | https://blog.logrocket.com/ux-design/design-to-code-with-figma-mcp/ |
| Figma MCP Accurate Front-End Code | Urban Insight real-project workflow | https://www.urbaninsight.com/article/figma-mcp-how-generate-design-accurate-front-end-code-ai |
| monday.com Figma-to-Code | Production pipeline case study | https://engineering.monday.com/how-we-use-ai-to-turn-figma-designs-into-production-code/ |
| Figma Code Connect (React) | Connecting React components to Figma | https://developers.figma.com/docs/code-connect/react/ |
| Visual Pixel-Perfect Skill | Playwright implement→render→compare loop | https://playbooks.com/skills/nguyenthienthanh/aura-frog/visual-pixel-perfect |

## Articles & Analysis

| Article | Key Insight | Link |
|---|---|---|
| Hidden Token Tax of MCP Servers | MCP = 10-100x more tokens than Skills | https://smithhorngroup.substack.com/p/the-hidden-token-tax-of-mcp-servers |
| Claude Code Skills: 98% Token Savings | Progressive disclosure architecture | https://codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide |
| Reduce Claude Code Tokens: 10 Tested Tools | Benchmarked comparison (April 2026) | https://computingforgeeks.com/reduce-claude-code-token-usage-tools/ |
| Cutting Token Usage by 50%+ | Four token drain categories + Graphify/claude-mem/Caveman | https://aleksandar.xyz/blog/2026-04-13-a-practical-guide-to-cutting-claude-code-token-usage-by-50-plus/ |
| Reduce Claude Code Costs 60% | Four habits: thinking cap, Sonnet default, compact early | https://systemprompt.io/guides/claude-code-cost-optimisation |
| MCP Token Optimization: 4 Approaches | Schema compression techniques | https://www.stackone.com/blog/mcp-token-optimization/ |
| How to Reduce MCP Token Costs at Scale | Bifrost gateway approach | https://www.getmaxim.ai/articles/how-to-reduce-mcp-token-costs-for-claude-code-at-scale/ |
| Optimize MCP Server Token Usage | TOON encoding, 98% reduction techniques | https://www.mindstudio.ai/blog/optimize-mcp-server-token-usage |
| Claude Code Token Optimization | Stop the $1,600 bill guide | https://buildtolaunch.substack.com/p/claude-code-token-optimization |
| 10 Techniques That Actually Work | Concrete token management techniques | https://www.mindstudio.ai/blog/how-to-manage-claude-code-token-usage |
| Claude Code Rate Limits 2026 | Peak hours drain faster (5am-11am Pacific) | https://www.ayautomate.com/blog/claude-code-rate-limits-2026 |
| Usage Limit Issues 2026 | Cache bugs inflating tokens 10-20x | https://www.aifreeapi.com/en/posts/claude-code-usage-limit-issues |
| Advisor Strategy (Opus + Sonnet) | 11% cost reduction with quality improvement | https://www.mindstudio.ai/blog/claude-code-advisor-strategy-opus-sonnet-haiku/ |
| Best AI Model Routing Guide 2026 | Opus for coordination, Sonnet for implementation | https://www.augmentcode.com/guides/ai-model-routing-guide |
| Token-Efficient Agents with MCP | Dynamic tool discovery vs front-loading | https://www.createwith.com/tool/claude/updates/claude-releases-engineering-guide-for-building-token-efficient-ai-agents-with-mc |

## Official Documentation

| Resource | Link |
|---|---|
| Anthropic: Claude Code Skills | https://docs.anthropic.com/en/docs/claude-code/slash-commands |
| Anthropic: How to Create Custom Skills | https://support.claude.com/en/articles/12512198-how-to-create-custom-skills |
| Anthropic: Best Practices for Claude Code | https://www.anthropic.com/engineering/claude-code-best-practices |
| Anthropic: Status Line Customization | https://docs.anthropic.com/en/docs/claude-code/statusline |
| Anthropic: Context Editing | https://platform.claude.com/docs/en/build-with-claude/context-editing |
| Anthropic: Automatic Context Compaction | https://platform.claude.com/cookbook/tool-use-automatic-context-compaction |
| Claude: Complete Guide to Building Skills | https://claude.com/blog/complete-guide-to-building-skills-for-claude |
| CData: Build Skills from MCP Queries | https://www.cdata.com/blog/mcp-skills-part-2-building-skills |
| Agent Skills Specification (open standard) | https://agentskills.io |
| MCP Directory: Best Practices | https://mcp.directory/blog/claude-code-best-practices |
