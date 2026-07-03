---
name: security-review
description: Run a high-confidence, diff-aware security review of code changes to find real, exploitable vulnerabilities. Use when the user asks to review code/a PR/a diff for security, mentions vulnerabilities, injection, auth bypass, secrets, or before merging. Focuses ONLY on security implications newly introduced by the change — not general code review.
metadata:
  version: "1.0.0"
  last-updated: "2026-06-08"
  author: ieteerapat
  based-on: anthropics/claude-code-security-review (methodology)
---

# Security Review

Structured, high-confidence security review of code changes. Based on Anthropic's official claude-code-security-review methodology. The point is **precision over noise** — flag only vulnerabilities you're >80% sure are actually exploitable, introduced by *this* change.

## When to use

- Reviewing a PR, diff, or specific files for security
- Before merging code that touches input handling, auth, crypto, file ops, or subprocess calls
- User mentions vulnerabilities, injection, auth bypass, SSRF, XSS, secrets, etc.

## Core Principles

1. **Minimize false positives** — only flag issues you're >80% confident are actually exploitable. A wrong flag wastes more trust than a missed nitpick.
2. **Diff-aware** — review ONLY security implications *newly added* by this change. Do not comment on pre-existing concerns.
3. **Impact-first** — prioritize vulnerabilities leading to unauthorized access, data breach, or system compromise.
4. **Not a general review** — no style, perf, or theoretical issues. Security only.

## Exclusions (do NOT report)

- Denial of Service (DoS) / resource exhaustion / rate limiting
- Secrets stored on disk (handled by other processes)
- Purely theoretical issues with no realistic exploit path

## Workflow

### 1. Scope the diff
Identify exactly what changed. Get the diff (`git diff`, PR files). Review only changed/added lines and the code paths they touch.

### 2. Trace data flow
Follow untrusted input (request params, headers, body, file uploads, env, external API responses) → to sensitive sinks (SQL, shell, file paths, templates, deserializers, `eval`, HTML output). A vulnerability exists where untrusted data reaches a dangerous sink without proper validation/escaping.

### 3. Check each category

**Input Validation / Injection**
- SQL injection (unsanitized input in queries) → use parameterized queries
- Command injection (shell/subprocess with user input)
- Path traversal in file operations (`../`)
- XXE in XML parsing
- Template injection in templating engines
- NoSQL injection

**Authentication & Authorization**
- Authentication bypass logic
- Authorization/access-control bypass (IDOR — can user A access user B's resource?)
- JWT vulnerabilities (alg:none, weak secret, missing verification)

**Injection & Code Execution**
- `eval`/dynamic code execution on user input
- Unsafe deserialization (Python pickle, YAML `load`, Java deserialize)
- XSS — reflected, stored, DOM-based (unescaped output in HTML)
- SSRF (server fetches a user-controlled URL)

**Crypto & Secrets**
- Weak/broken crypto algorithms or implementations
- Insecure randomness for security-sensitive values (use CSPRNG)
- Hardcoded secrets/API keys newly introduced in the diff

### 4. Report findings

For each confirmed finding, output:
```
[SEVERITY] category — file:line
What: <one line>
Why exploitable: <the data path from input to sink>
Exploit scenario: <concrete attacker example>
Fix: <specific remediation>
```

### Severity
- **HIGH** — directly exploitable → RCE, data breach, auth bypass (even if only from local network)
- **MEDIUM** — needs specific conditions but significant impact
- **LOW** — limited impact / hard to exploit

## Output Format

```
Security Review — <N> files, <M> findings

HIGH: <count>  MEDIUM: <count>  LOW: <count>

[HIGH] sql_injection — api/search.py:42
What: user `q` param concatenated into SQL string
Why: request.args['q'] → cursor.execute(f"... {q}") with no parameterization
Exploit: q = "1; DROP TABLE users--"
Fix: use parameterized query cursor.execute("... %s", [q])

[No further issues found] / [next finding...]
```

If nothing is found: say so plainly — do not invent findings to look thorough.

## CI Integration (optional)

For automated PR scanning, use the official GitHub Action instead of running this manually every time:
```yaml
# .github/workflows/security.yml
- uses: anthropics/claude-code-security-review@main
  with:
    comment-pr: true
    claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

## Source

Methodology from Anthropic's [claude-code-security-review](https://github.com/anthropics/claude-code-security-review) (official). That repo is a GitHub Action + `/security-review` slash command; this skill captures its review procedure for use inside any Claude Code session.
