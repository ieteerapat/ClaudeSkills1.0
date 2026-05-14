---
name: output-filter
description: Filters and compresses command outputs before they consume context. Prevents large test results, build logs, and git diffs from bloating the context window. Use when running shell commands that produce verbose output.
---

# Output Filter

Compress command outputs to prevent context bloat from verbose shell results.

## When to use

- Running test suites (only need pass/fail summary)
- Viewing git diffs (only need changed sections relevant to task)
- Reading build logs (only need errors and warnings)
- Any command that produces >50 lines of output

## Instructions

### Test Output Compression

When running tests, extract only:
- Total pass/fail count
- Names of failing tests
- First error message per failure
- Skip everything else (timing, stack traces of passing tests, coverage tables)

**Instead of raw output:**
```
PASS src/utils.test.ts (47 tests)
PASS src/api.test.ts (23 tests)
FAIL src/auth.test.ts
  ✕ should validate token expiry (12ms)
    Expected: true, Received: false
    at Object.<anonymous> (src/auth.test.ts:45:5)
    at ... (15 more stack frames)
```

**Compress to:**
```
Tests: 70 pass, 1 fail
FAIL: auth.test.ts > should validate token expiry
  Expected: true, got: false (line 45)
```

### Git Diff Compression

When viewing diffs:
- Show only files relevant to current task
- Collapse unchanged context lines
- Skip binary file changes
- Skip lock file changes (package-lock.json, yarn.lock)

### Build Log Compression

When viewing build output:
- Show only errors and warnings
- Skip successful compilation messages
- Skip progress indicators
- Keep file paths of failures

### General Rules

1. **Never paste raw output >50 lines** into context
2. **Summarize first**, show details only if asked
3. **Filter noise**: timestamps, progress bars, ANSI codes, blank lines
4. **Keep actionable info**: error messages, file paths, line numbers

## Output Templates

### Test results:
```
Tests: [pass] pass, [fail] fail | [time]
[FAIL: test name → error summary (one line each)]
```

### Build errors:
```
Build: [status] | [error count] errors, [warning count] warnings
[file:line — error message (one per line)]
```

### Git status:
```
[branch] | [ahead/behind] | [staged] staged, [unstaged] modified, [untracked] new
```

## Complementary Tools

For automated output filtering at the CLI level, consider:
- **RTK** (https://github.com/rtk-ai/rtk) — Rust binary that intercepts and compresses bash output before it reaches context. 60-90% reduction on test/build/git commands.
- **Context Mode** (https://github.com/mksglu/context-mode) — MCP server that sandboxes tool output. 98% reduction on large outputs.

These handle filtering automatically via hooks; this skill handles it at the response level.
