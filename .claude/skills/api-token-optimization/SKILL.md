---
name: api-token-optimization
description: Reduce cost and token usage when calling the Anthropic API directly (SDK, custom agents, production apps) via prompt caching, Batch API, effort tuning, prefill, and token-efficient tools. Use when building apps with the Anthropic SDK, when the user mentions prompt caching, cache_control, Batch API, API costs, thinking budget, budget_tokens, or "why is my cache hit rate low". NOT for Claude Code session tuning (that's CLAUDE.md) — this is for code that calls the API.
metadata:
  version: "1.0.0"
  last-updated: "2026-06-08"
  author: ieteerapat
  based-on: amunozdev/token-optimizer v1.4.0 (MIT)
---

# API Token Optimization

Cut cost when your **code calls the Anthropic API directly** (SDK, agents, production). These levers are mostly absent in Claude Code because the harness handles them — they only apply to your own API calls. Biggest wins: prompt caching (90% off cached reads) and Batch API (50% off), and they stack.

## When to use

- Building with `anthropic` / `@anthropic-ai/sdk` / other official SDK or raw HTTP
- Optimizing prompt caching, debugging low cache hit rate
- Adding Batch API for non-latency-sensitive work
- Tuning thinking/effort budgets to cut reasoning cost
- NOT for tuning a Claude Code session — those rules live in CLAUDE.md

## The Levers (by impact)

| Lever | Savings | Notes |
|---|---|---|
| Prompt caching | 90% on cached reads | Write costs 1.25x, read 0.1x. Pays off on the 2nd call. |
| Batch API | 50% on all tokens | <24h latency. Stacks with caching → up to 95% total. |
| `effort: low` | Large | Skip deep reasoning for classification/extraction. |
| `budget_tokens` cap | Proportional | 8K–16K is plenty for most tasks; don't use 100K to format a date. |
| Prefill assistant turn | Removes preamble | `{"role":"assistant","content":"{"}` skips "Sure! Here's…" |
| Token-efficient tools | ~14% output avg | Default in Claude 4; add `token-efficient-tools-2025-02-19` header for 3.7. |
| Dynamic tool loading | Scales w/ tool count | Every tool schema ships in every request — include only what's needed. |
| Token counting endpoint | Debugging | Get exact cost before running inference. |

## Prompt Caching — the #1 lever

Add `cache_control` breakpoints to mark stable prefixes. Render order is `tools` → `system` → `messages`. Keep stable content first, volatile content last.

```python
client.messages.create(
    model="claude-sonnet-4-6",
    system=[
        {"type": "text", "text": LARGE_STABLE_SYSTEM_PROMPT,
         "cache_control": {"type": "ephemeral"}},   # cached
    ],
    messages=[{"role": "user", "content": user_question}],  # volatile, after breakpoint
)
```

### Cache gotchas (the agent WILL get these wrong without them)

- **Images break the cache.** Adding/removing an image anywhere invalidates it. If a flow sometimes sends images, treat it as a separate request pattern.
- **Anything before the breakpoint must be stable.** A timestamp, session ID, or the user message placed before the breakpoint defeats caching — you pay the 1.25x write surcharge every time with zero reads.
- **Concurrency pitfall.** Cache entries exist only after the first response starts streaming. Fire 10 parallel requests cold → 9 misses. Fire one, wait for the stream to start, then fan out.
- **Minimum token threshold per breakpoint.** 2,048 for Sonnet 4.6; 4,096 for Opus 4.6 / Haiku 4.5. Below it, nothing caches and **no error is raised**.
- **Verify it works:** check `usage.cache_read_input_tokens` (should be >0 on repeats) and `cache_creation_input_tokens`. If reads stay 0, a silent invalidator is at work.

## Batch API — 50% off, stacks with caching

For non-latency-sensitive work (evals, bulk classification, data processing), use the Batch API: `POST /v1/messages/batches`. <24h latency, 50% off all tokens. Combine with prompt caching for up to 95% total savings.

## Thinking / Effort tuning

- Cap `budget_tokens` at 8K–16K for most tasks. Don't leave it at the default tens of thousands.
- Use `effort: low` (via `output_config`) for classification/extraction that doesn't need deep reasoning.
- Disable thinking entirely for formatting/lookup tasks.
- On adaptive-thinking models (Opus 4.6+/Sonnet 4.6), use `thinking: {type: "adaptive"}` instead of fixed budgets.

## Prefill & token-efficient tools

- **Prefill** the assistant turn to skip preamble: start the response with `{` for JSON, removing "Sure! Here's the JSON:". (Note: prefill is removed on the 4.6/4.7 family — use structured outputs / `output_config.format` there instead.)
- **Token-efficient tools** are default in Claude 4; for 3.7 add the `token-efficient-tools-2025-02-19` beta header (~14% output reduction).

## Dynamic tool loading

Every tool's full schema ships in **every** request. With 50+ tools that's 5-7% of context before the user message. Only include tools the current task needs; load others on demand.

## Diagnostic Workflow

1. **Measure first** — use the token counting endpoint or log `usage` from a real call. No baseline = can't prove improvement.
2. **Identify** the biggest drain: uncached large system prompt? verbose tool schemas? oversized thinking budget? latency-tolerant work paying full price?
3. **Apply** the highest-impact lever (usually caching, then batch).
4. **Verify** — re-check `usage.cache_read_input_tokens`, total tokens, and cost. Confirm the lever actually fired.

## Verification Checklist

- [ ] `cache_read_input_tokens` > 0 on repeated calls (caching works)
- [ ] Volatile content (timestamps, IDs, user msg) is AFTER the last breakpoint
- [ ] Cached prefix meets the per-model minimum token threshold
- [ ] Latency-tolerant workloads routed through Batch API
- [ ] `budget_tokens` capped (8K–16K) or `effort: low` for simple tasks
- [ ] Tool list trimmed to what the task needs

## Common Failures

| Symptom | Cause | Fix |
|---|---|---|
| Cache writes every call, never reads | Volatile content before breakpoint, or below min tokens, or image added/removed | Move volatile content after breakpoint; meet per-model minimum; verify `cache_creation_input_tokens` |
| Parallel requests all miss cache | Cache entry only exists after first response streams | Fire one request, wait for stream start, then fan out |
| Thinking makes requests expensive | Default `budget_tokens` is tens of thousands | Cap at 8K–16K, or `effort: low`, or disable thinking for lookup/format tasks |
| No savings after "enabling" caching | Prefix not actually stable | Audit for `datetime.now()`, unsorted JSON, varying tool set in the prefix |

## Source

Adapted from [amunozdev/token-optimizer](https://github.com/amunozdev/token-optimizer) (MIT) and Anthropic's prompt-caching / Batch API docs. For Claude Code session tuning (file org, /context, /compact, model routing), see this repo's CLAUDE.md instead.
