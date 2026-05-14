---
name: model-routing
description: Advises on optimal model selection (Opus/Sonnet/Haiku) based on task complexity. Helps reduce costs by routing simple tasks to cheaper models. Use when starting a new task or when the user asks about model selection.
---

# Model Routing Advisor

Route tasks to the cheapest model that can handle them well.

## When to use

- Starting a new coding task
- User asks which model to use
- Optimizing costs across a session
- Planning a multi-step workflow

## Model Tiers

| Model | Best For | Cost | Speed |
|---|---|---|---|
| Haiku 4.5 | File navigation, simple edits, formatting, linting | Cheapest (1/20 of Opus) | Fastest |
| Sonnet 4.6 | Implementation, refactoring, code generation, tests | Mid (1/5 of Opus) | Fast |
| Opus 4.6 | Architecture, complex debugging, multi-file planning | Highest | Slowest |

## Routing Rules

### Use Haiku (/fast) for:
- Renaming variables/files
- Adding imports
- Formatting code
- Simple find-and-replace patterns
- Reading and summarizing files
- Git operations (status, log, diff)
- Generating boilerplate

### Use Sonnet (default) for:
- Implementing features from clear specs
- Writing tests
- Refactoring existing code
- Bug fixes with known root cause
- Code review
- Figma-to-code generation (with cached tokens)
- 80% of daily coding tasks

### Use Opus for:
- Architecture decisions
- Complex multi-file refactoring
- Debugging with unknown root cause
- Planning large features
- Security audits
- Performance optimization analysis

## Instructions

1. **Default to Sonnet** — it handles most tasks at 1/5 the cost of Opus
2. **Use /fast (Haiku)** for mechanical tasks that don't need reasoning
3. **Escalate to Opus** only for tasks requiring deep reasoning across many files
4. **Never use Opus for**: simple edits, formatting, boilerplate, git commands

## Cost Impact

| Workflow | All-Opus | Routed | Savings |
|---|---|---|---|
| 10 simple edits | $2.00 | $0.10 (Haiku) | 95% |
| Feature implementation | $4.00 | $0.80 (Sonnet) | 80% |
| Architecture + implement | $6.00 | $2.40 (Opus plan + Sonnet code) | 60% |

## Advisor Strategy (Advanced)

For complex features, use the "Advisor" pattern:
1. **Opus plans** — creates the architecture and task breakdown
2. **Sonnet implements** — writes the actual code from the plan
3. **Haiku validates** — runs tests, checks formatting

This gives Opus-quality architecture with Sonnet-level costs for the bulk of the work.

## Common Edge Cases

- **Uncertain complexity**: Start with Sonnet, escalate to Opus if it struggles
- **Large codebase exploration**: Use Haiku for file discovery, Sonnet for understanding
- **Debugging**: Start with Sonnet; if 2 attempts fail, escalate to Opus
