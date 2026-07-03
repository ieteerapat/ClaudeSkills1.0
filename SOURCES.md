# Sources

Repositories, tools, and docs **actually used** by this repo. Pruned to what the skills, installers, and docs reference — not a general research dump.

## Skills

### figma-accuracy
| Resource | Used for | Link |
|---|---|---|
| Figma MCP Tools & Prompts | All 16 official tools the skill documents | https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/ |
| Figma Implement Design (official skill) | Pixel-perfect workflow basis | https://developers.figma.com/docs/figma-mcp-server/skill-figma-implement-design/ |
| Figma Create Design System Rules | Layer 1 of the accuracy stack | https://developers.figma.com/docs/figma-mcp-server/skill-figma-create-design-system-rules/ |
| Figma Code Connect Setup | Layer 2 (component mapping) | https://developers.figma.com/docs/code-connect/code-connect-ui-setup |
| Figma MCP Known Issues | 25K-token limit fix (`MAX_MCP_OUTPUT_TOKENS`) | https://developers.figma.com/docs/figma-mcp-server/mcp-clients-issues/ |
| Figma Code to Canvas | Bidirectional workflow section | https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/ |
| Figma MCP Server Guide (repo) | Official skill files referenced | https://github.com/figma/mcp-server-guide |
| Framelink MCP (GLips) | Alternative server in `references/mcp-servers.md` | https://github.com/GLips/Figma-Context-MCP |
| Smart Position fork (tianmuji) | Non-AutoLayout server option | https://github.com/tianmuji/Figma-Context-MCP |

### hyperframes-video
| Resource | Used for | Link |
|---|---|---|
| HyperFrames (repo) | Source framework (Apache 2.0, v0.7.6) | https://github.com/heygen-com/hyperframes |
| HyperFrames Quickstart | Composition rules + CLI workflow | https://hyperframes.heygen.com/quickstart |
| HyperFrames Docs | Adapter runtimes, pipeline | https://hyperframes.heygen.com/introduction |
| HyperFrames Catalog | Reusable blocks (`npx hyperframes add`) | https://hyperframes.heygen.com/catalog/blocks/data-chart |

### site-migrate
| Resource | Used for | Link |
|---|---|---|
| site-migrate-skill v1.8.0 | Vendored migration engine (SKILL.md, scripts, references) | local package: site-migrate-skill-v1.8.0 |
| Playwright | Golden-fixture capture + visual parity in the skill's scripts | https://playwright.dev |

### hallmark
| Resource | Used for | Link |
|---|---|---|
| nutlope/hallmark v1.1.0 | Vendored anti-AI-slop design skill (MIT, Together AI) | https://github.com/nutlope/hallmark |
| usehallmark.com | Live demo + theme gallery | https://www.usehallmark.com |

### session-memory
| Resource | Used for | Link |
|---|---|---|
| Obsidian | Vault app the memory store runs in | https://obsidian.md |

### api-token-optimization
| Resource | Used for | Link |
|---|---|---|
| amunozdev/token-optimizer | Source of the API caching/batch/effort patterns (MIT) | https://github.com/amunozdev/token-optimizer |
| Anthropic prompt caching docs | Cache breakpoint rules + gotchas | https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching |

## Installers

### RTK (installers/install-rtk.*)
| Resource | Used for | Link |
|---|---|---|
| RTK (rtk-ai/rtk) | Token-saver CLI the installer sets up | https://github.com/rtk-ai/rtk |

### Obsidian MCP (installers/setup-obsidian-mcp.sh)
| Resource | Used for | Link |
|---|---|---|
| mcp-obsidian (MarkusPfundstein) | The MCP server registered with Claude Code | https://github.com/MarkusPfundstein/mcp-obsidian |
| Obsidian Local REST API (coddingtonbear) | Plugin the MCP server talks to | https://github.com/coddingtonbear/obsidian-local-rest-api |
| uv / uvx (astral) | Runs the mcp-obsidian server | https://docs.astral.sh/uv/ |

## Companion Tools (referenced in README)
| Tool | Used for | Link |
|---|---|---|
| Context Mode | MCP output sandboxing option | https://github.com/mksglu/context-mode |
| CodeGraph | Codebase knowledge graph option | https://github.com/colbymchenry/codegraph |
| Claude-Mem | Cross-session memory option | https://github.com/thedotmack/claude-mem |
| Caveman | Output compression option | https://github.com/JuliusBrussee/caveman |

## Standards & Official Docs
| Resource | Used for | Link |
|---|---|---|
| Agent Skills Specification | Skills validated against this | https://agentskills.io/specification |
| Agent Skills: Best Practices | Skill design + "would the agent get this wrong" test | https://agentskills.io/skill-creation/best-practices.md |
| Agent Skills: Evaluating Quality | Skill evaluation methodology | https://agentskills.io/skill-creation/evaluating-skills.md |
| Anthropic: How to Create Custom Skills | SKILL.md frontmatter rules | https://support.claude.com/en/articles/12512198-how-to-create-custom-skills |
| Anthropic: Hooks Reference | `.claude/hooks/` JSON format | https://code.claude.com/docs/en/hooks |
| Anthropic: Status Line | `.claude/settings.json` statusline | https://docs.anthropic.com/en/docs/claude-code/statusline |
| Figma plugin for Claude Code | `claude plugin install figma@claude-plugins-official` | https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server |

---

_Removed 2026-06: ~30 research-only links (early token-tool survey, hook articles, model-routing, and design-to-code blog posts) that no skill, installer, or doc in this repo references. See git history if you need them._

