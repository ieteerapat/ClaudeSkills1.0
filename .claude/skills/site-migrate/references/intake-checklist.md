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
- Integrations & keys (probe HAR + DOM): GTM `GTM-XXXX`, GA4 `G-XXXX`/`UA-`,
  Facebook Pixel, Maps API key (`key=AIza…`), reCAPTCHA, other third-party
  hosts. Classify per references/integrations.md (Tier 1 public-portable /
  Tier 2 domain-restricted / Tier 3 server-secret). The scrape recovers Tier 1
  and Tier-2 site keys; Tier 3 is NEVER in the output.
- Animation surface: CSS animation/transition density, slider/carousel libs
- Search present? (search form/`?s=` endpoint/results template) → static needs
  a build-time index (Pagefind). If absent, nothing to do.
- Cookie/consent banner present (capture must auto-dismiss or mask it) — note:
  masking is for CAPTURE only; the banner must still FUNCTION on the new site
  (see references/integrations.md, PDPA/GDPR gating of GTM/Pixel)
- CI provider: `git remote -v` → github.com | bitbucket.org | gitlab | none

## 2. Ask the user (one AskUserQuestion round; answers → migration.config.json)

1. **Target stack**: FE framework, CSS approach, rendering (static export / SSG /
   SSR), hosting target (determines redirect emission format).
2. **CMS**: none (fully static) or which.
3. **Form policy** (MANDATORY if probe found forms): third-party form backend /
   serverless endpoint / mailto degradation — per form if they differ. Any
   booking/app-shaped widget: migrate, drop, or flag? An interactive element
   discovered later that this policy doesn't cover → needs_human.
3b. **Integrations** (if probe found any): for each detected integration,
   confirm handling per references/integrations.md — keep same analytics
   property or new (Tier 1); will the owner re-key/allow-list domain-restricted
   keys like Maps/reCAPTCHA (Tier 2); which server-side secrets must be
   provisioned (Tier 3). Writes `migration/integrations.json` + `.env.example`.
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
  "rtl_locales": [],
  "_rtl_note": "derive at intake: any of ar/he/fa/ur/ps/sd in locales → RTL; build sets dir=rtl + logical CSS for these (see build-contract). Parity needs NO change — each locale compares against its own fixture.",
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
  "staging_noindex": true,
  "search": "none | pagefind",
  "pilot_pages": []
}
```

## 4. After writing config

- Copy `config/*.default.json` from the skill → `PROJECT_ROOT/migration/`
  (drop the `.default`). These are per-project and will be edited during
  calibration; the skill's copies are pristine templates.
- Ensure `.gitignore` covers `fixtures/`, `reports/**/diff-images/`,
  `.env.local`, and `.env*.local` (secrets never get committed).
- If integrations were detected: write `migration/integrations.json` + a
  committed `.env.example` (Tier-1 public values, placeholders for Tier-2/3).
  Per references/integrations.md.
- git commit the config (ask before committing if repo conventions unknown).
- Create the vault project note (see references/logging.md).
- Scaffold the PROJECT's `.claude/settings.json` permissions allowlist so the
  unattended loop never stalls on approval prompts. Allow ONLY the loop's
  command surface:
  - Core: `Bash(node:*)`, `Bash(npm ci:*)`, `Bash(npm install:*)`,
    `Bash(npm run build:*)`, `Bash(npx playwright:*)`, `Bash(npx vitest:*)`,
    `Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git status:*)`,
    `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git branch:*)`,
    `Bash(git checkout:*)`, `Bash(git fetch:*)`, `Bash(git merge:*)`,
    `Bash(mkdir:*)`, `Bash(cp:*)`, `Bash(sleep:*)`, `Bash(curl:*)`,
    `Bash(python3 -m http.server:*)` (compare/smoke serve the export
    locally), `Edit`/`Write` within the repo,
    `WebFetch(domain:<source site>)`, `mcp__playwright__*`.
  - DUAL SYNTAX: emit every Bash rule in BOTH `Bash(cmd:*)` and `Bash(cmd *)`
    forms — harness versions differ on which they match, and a non-matching
    form silently prompts.
  - COMMAND-REWRITING HOOKS: if the user runs a Bash-rewriting hook (e.g. rtk
    proxying `git status` → `rtk git status`), the REWRITTEN form is what the
    matcher sees — detect it at intake (run `which rtk` / inspect hooks) and
    add the wrapped forms too (`Bash(rtk:*)` + `Bash(rtk *)` or per-command
    `Bash(rtk git add:*)` etc.).
  - SKILL-DIR access: harness scripts live outside the repo; add the skill dir
    to `permissions.additionalDirectories` and (if harness fixes are expected)
    `Edit(//<skill-dir>/**)` + `Write(//<skill-dir>/**)`.
  - `git push`: ask the user ONCE at intake whether unattended pushes are
    allowed (they usually are for a feature branch); if yes add
    `Bash(git push:*)`/`Bash(git push *)`. Keep `rm`, force-push,
    `git reset --hard`, and deploys in the `ask` list — never silently allowed.
  - RELOAD CAVEAT: if `.claude/settings.json` is created mid-session, the
    watcher may not pick it up — tell the user to run `/permissions` once or
    restart the session.
  Ask the user to review the list once at intake; after the pilot,
  /fewer-permission-prompts can catch stragglers from real transcripts.
- Create/update the PROJECT's CLAUDE.md with: the durable rules (target stack,
  done = parity-passed, URL map is sacred, never invent/translate content,
  manifest via CLI only) and a **Compact Instructions** section telling
  compaction to preserve: current page id, current phase, open diff hypothesis,
  and the pointer to migration.config.json + manifest. This is what makes long
  attended sessions (calibration, pilot) survive compaction.
