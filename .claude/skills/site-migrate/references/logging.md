# Logging — repo logs (the WHY) + vault current-truth

Two layers, opposite access patterns. The manifest is the WHAT (machine,
transactional); logs are the WHY (humans + later context). Anything an agent
must ACT on belongs in the manifest, never only in prose.

## Repo logs — `PROJECT_ROOT/CC-Session-Logs/`

- `pages/<page-id>.md` — append-only, one file per page, owned by whichever
  agent works that page (sequential loop = no contention; if ever parallel,
  per-agent suffixes). Append an entry per attempt/decision AT THE MOMENT it
  happens, not at session end.
- `decisions.md` — append-only project-level decisions (template choices, mask
  rules added + reason, threshold changes, form-policy applications).

Every log file gets Obsidian frontmatter (Dataview-queryable):

```yaml
---
type: migration-log
project: <repo-name>
page_id: <id or "project">
date: <YYYY-MM-DD of file creation>
status: <current manifest status at last append>
tags: [migration, <source-adapter>, <target>]
---
```

Entry format (append):

```md
## <ISO timestamp> — <phase or attempt-N>
- what happened / what was decided
- why (one line)
- refs: report path, commit hash, mask rule key
```

## Current-truth note (curated canonical read)

- One curated note per migration project. Location: config `vault_note` path
  if set (e.g. an Obsidian vault:
  `<vault>/Areas/Work/Projects/<project>/Migration-Current-Truth.md`);
  otherwise default to `PROJECT_ROOT/CC-Session-Logs/Current-Truth.md`.
  Same frontmatter block, `type: migration-truth`.
- Updated at MILESTONES only (calibration done, design system done, pilot
  done, cost gate, wrap-up) — never per page. Contents: current phase, counts
  by status, active quirks/conventions an agent must know, links to repo logs.
- This is the canonical read for "what's true now". Raw page logs are history;
  if they conflict, current-truth wins — update it when superseding a decision.
- Orchestrator hands subagents 2–3 SPECIFIC notes by path when relevant.
  Never instruct an agent to "research the vault".
