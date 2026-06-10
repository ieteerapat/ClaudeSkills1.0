# Build contract — the rails the orchestrator lays for build subagents

Problem this solves: a fresh build subagent has no memory of how earlier pages
were built. Left to a generic target reference, it invents component names,
file paths, and class conventions → inconsistent pages, shared-file churn,
drift from the path. The contract removes the improvisation: the subagent
COMPOSES from a known kit, it does not design.

The orchestrator WRITES `PROJECT_ROOT/migration/build-contract.md` in Phase 1.5
(after the design system + shared chrome + per-type templates exist), keeps it
current, and includes it verbatim in every build subagent's scoped packet.
Subagents treat it as read-only law.

## Required sections (project-specific, derived from THIS site — never generic)

1. **File & directory layout** — exact paths: where pages, layouts, components,
   content, styles, assets live. Where a new PAGE file goes (the only kind of
   file a build subagent creates).
2. **Component inventory** — every shared/reusable component that already
   exists, with its import path, props, and a one-line "use it for X". This is
   the kit. Subagents reuse these by name; they do not recreate them.
3. **Per-type template skeletons** — for each manifest `type` (article,
   landing, policy…), the canonical page skeleton: which layout, which slots,
   which components in what order. The build subagent fills the skeleton with
   the page's extracted content; it does not redesign the skeleton.
4. **Naming & code conventions** — component/file naming, the styling system in
   concrete terms (e.g. Tailwind token classes only, pull from theme — no
   arbitrary hex, no inline styles, no new CSS files), import ordering, server
   vs client component default.
5. **Design tokens** — the resolved palette/type/spacing/breakpoints and HOW to
   reference them (theme keys, not raw values). C.I. fidelity = use the exact
   tokens, never approximate.
6. **Island / interactivity rules** — what may be a client component and what
   must stay static; the approved pattern for forms/slider/locale-switcher
   (from config form_policy + the prebuilt chrome).
6b. **Direction (RTL)** — if config `rtl_locales` is non-empty, the rule for
   building those locales: `dir="rtl"` on `<html>`, logical CSS properties /
   Tailwind `rtl:` + inline-start/end utilities, never hardcoded left/right.
   One template serves both directions via logical properties — do NOT fork a
   separate RTL template.
7. **Hard "do NOT" list** — do not create or modify shared components; do not
   rename or move existing files; do not introduce a new styling approach,
   state library, or dependency; do not invent URLs (use the url-map); do not
   translate content. Anything requiring one of these → STOP and flag the
   orchestrator.

## Escalation (the safety valve)

A page that genuinely cannot be built by composing the existing kit (needs a
new shared component, a new template type, a new dependency) is NOT a license
to improvise. The subagent stops, returns a flag describing what's missing, and
the orchestrator decides: extend the kit + update this contract (so all later
pages benefit consistently), or route the page to needs_human. New shared
components are born in the orchestrator's hands, once, not scattered across
per-page subagents.

## Why this lives in a file, not just the subagent prompt

The contract is large and stable; passing it as a file path the subagent reads
keeps the scoped packet light and guarantees every subagent reads the SAME
current rules. When the orchestrator extends the kit, it updates one file and
every subsequent subagent is bound by it — no prompt drift.
