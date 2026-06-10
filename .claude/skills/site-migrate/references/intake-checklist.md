# Intake checklist — Phase 0

Goal: every blocker cleared BEFORE anything is built. One probe, one question
round, one config file. Never ask what the probe can detect.

## 1. Auto-detect (intake.mjs probe — never ask these)

- Generator (meta tag, /wp-json reachability, wp-content paths → WordPress?)
- sitemap.xml / robots.txt presence and URL count
- Locales: hreflang tags, locale path patterns (/en/, /th/), html lang
- **Locale MECHANISM** (load-bearing for extraction): how does the site switch
  language? (a) distinct URLs per locale (path prefix/subdomain — extract by
  fetching that URL), (b) cookie/JS switcher with same URL (extract by driving
  the switcher in Playwright, then capturing), (c) browser Accept-Language
  (capture with the header set per locale). Record in config as
  `locale_mechanism` — content is ALWAYS copied per locale, never translated.
- Forms: `<form>` elements on home + contact-like pages; their action targets
- Embeds: iframes (maps, video platforms), third-party script domains
- Animation surface: CSS animation/transition density, slider/carousel libs
- Cookie/consent banner present (capture must auto-dismiss or mask it)
- CI provider: `git remote -v` → github.com | bitbucket.org | gitlab | none

## 2. Ask the user (one AskUserQuestion round; answers → migration.config.json)

1. **Target stack**: FE framework, CSS approach, rendering (static export / SSG /
   SSR), hosting target (determines redirect emission format).
2. **CMS**: none (fully static) or which.
3. **Form policy** (MANDATORY if probe found forms): third-party form backend /
   serverless endpoint / mailto degradation — per form if they differ. Any
   booking/app-shaped widget: migrate, drop, or flag? An interactive element
   discovered later that this policy doesn't cover → needs_human.
4. **Fidelity criteria**: which dimensions must match (layout, fonts, ci-colors,
   texts, links, media, forms, map, animations, responsive, i18n, policy pages).
5. **SEO bar**: preserve vs equal_or_better (adds Lighthouse/CWV gate to parity).
6. **Locales** to migrate (confirm probe findings; partial translations OK?).
7. **Exclusions**: pages/sections NOT to migrate — AND what internal links
   pointing at them should do (keep-to-old-domain / drop / redirect target).
   Also: any source subdomains (blog., shop.) in-scope or external?
8. **Attempt cap N** (default 2) and `auto_approve_urlmap` (default false).

## 3. migration.config.json schema

```json
{
  "version": 1,
  "source": { "url": "", "adapter": "wordpress | generic-crawl" },
  "target": { "framework": "", "css": "", "rendering": "static-export",
              "hosting": "", "cms": "none" },
  "locales": ["th", "en"],
  "default_locale": "th",
  "locale_mechanism": "url-path | subdomain | js-switcher | accept-language",
  "seo_bar": "equal_or_better | preserve",
  "fidelity": ["layout", "fonts", "ci-colors", "texts", "links", "media",
               "forms", "map", "animations", "responsive", "i18n"],
  "form_policy": { "default": "", "per_form": {} },
  "media_policy": "self-host source-domain assets; keep third-party embeds",
  "exclusions": [],
  "attempt_cap": 2,
  "urlmap_approved": false,
  "auto_approve_urlmap": false,
  "ci": { "provider": "github | bitbucket | gitlab | none" },
  "vault_note": null,
  "pilot_pages": []
}
```

## 4. After writing config

- Copy `config/*.default.json` from the skill → `PROJECT_ROOT/migration/`
  (drop the `.default`). These are per-project and will be edited during
  calibration; the skill's copies are pristine templates.
- Ensure `.gitignore` covers `fixtures/` and `reports/**/diff-images/`.
- git commit the config (ask before committing if repo conventions unknown).
- Create the vault project note (see references/logging.md).
- Scaffold the PROJECT's `.claude/settings.json` permissions allowlist so the
  unattended loop never stalls on approval prompts. Allow ONLY the loop's
  command surface, e.g.:
  `Bash(node:*)`, `Bash(npm ci:*)`, `Bash(npm run build:*)`,
  `Bash(npx playwright:*)`, `Bash(npx vitest:*)`, `Bash(git add:*)`,
  `Bash(git commit:*)`, `Bash(git status:*)`, `Bash(git diff:*)`,
  `Bash(git log:*)`, `Edit`/`Write` within the repo, `WebFetch(domain:<source
  site>)`, and the Playwright MCP tools (`mcp__playwright__*`).
  Deliberately NOT allowed (must always prompt): deploys, `git push`,
  `rm`, anything outside the repo. Ask the user to review the list once at
  intake; after the pilot, /fewer-permission-prompts can catch stragglers
  from real transcripts.
- Create/update the PROJECT's CLAUDE.md with: the durable rules (target stack,
  done = parity-passed, URL map is sacred, never invent/translate content,
  manifest via CLI only) and a **Compact Instructions** section telling
  compaction to preserve: current page id, current phase, open diff hypothesis,
  and the pointer to migration.config.json + manifest. This is what makes long
  attended sessions (calibration, pilot) survive compaction.
