# parity-report.json contract

Written by compare.mjs to `reports/<page-id>/parity-report.json`.
Heavy artifacts (diff images, DOM diffs) are siblings on disk — agents read
ONLY the `summary` block.

## Exit codes (the verdict belongs to the script, never the agent)

- `0` — pass. Every enabled fidelity dimension within thresholds.
- `1` — fail. At least one dimension out of tolerance; report localizes it.
- `2` — needs_human. Timing-dependent or non-deterministic behavior detected
  (two source captures disagree with each other; JS-driven animation; websocket
  traffic; an interactive element not covered by form_policy).
- `3` — not implemented / harness error (never a page verdict).

## Schema

```json
{
  "page_id": "post-142",
  "locale": "th",
  "captured_at": "ISO8601 (fixture timestamp — atomic with extraction)",
  "compared_at": "ISO8601",
  "attempt": 1,
  "verdict": "pass | fail | needs_human",
  "summary": {
    "one_line": "FAIL: hero slider region differs at desktop viewport",
    "dimensions": {
      "layout":   { "pass": false, "worst_region": ".hero-slider",
                    "selector": "section.hero > .slider", "viewport": "1440",
                    "pixel_diff_pct": 4.2, "threshold": 1.0 },
      "fonts":    { "pass": true },
      "texts":    { "pass": true },
      "seo_meta": { "pass": true },
      "links":    { "pass": true },
      "media":    { "pass": true },
      "animations": { "pass": true, "keyframes_checked": 6, "motions_checked": 20,
                      "missing_keyframes": [], "missing_motion": [] },
      "perf":     { "pass": true, "source_lcp_ms": 2400, "candidate_lcp_ms": 900 }
    },
    "next_action_hint": "inspect .hero-slider computed styles on both sides"
  },
  "artifacts": {
    "diff_images": "reports/post-142/diff-*.png",
    "dom_diff": "reports/post-142/dom-diff.txt",
    "lighthouse": "reports/post-142/lighthouse.json"
  }
}
```

## Rules

- `summary` MUST localize every failure: selector + region + viewport. "Pages
  differ" is a harness bug. This is what makes cheap targeted diagnosis
  (browser_evaluate on one selector) possible instead of full snapshots.
- `summary` is ≤ 40 lines serialized. Everything bigger goes to artifacts.
- The same normalize.mjs masking is applied to BOTH sides before every diff.
- A dimension only appears if enabled in config `fidelity`.
- perf appears only when `seo_bar` = equal_or_better; pass = candidate ≥ source
  on the budgeted metrics (LCP, CLS, TBT, Lighthouse SEO/Perf scores).
- animations compares authored-css.json DEFINITIONS (screenshots freeze motion):
  every source @keyframes must exist in the candidate with an identical step
  body, and every animation/transition signature (selector-independent set)
  must be reproduced. Verifies CSS-defined motion only; JS-driven motion
  (GSAP/sliders/scroll-triggers) leaves no CSS here and is routed to
  needs_human by the animation-surface policy, not this dimension.
