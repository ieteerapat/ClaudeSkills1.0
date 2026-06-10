# CI adapter — provider-agnostic smoke on every migration commit

Purpose: catch shared-component regressions within one page of causing them.
Every push to the migration branch runs: install → build → fast smoke
(all manifest routes exist in export output + return 200, internal links
resolve). Full smoke (Lighthouse, redirects) stays local/Phase 4 — too slow
per-commit.

Provider chosen at intake from `git remote -v`. Emit the matching file,
commit it, then guide the user through any provider-side setup (below).
No remote → skip; the loop runs `smoke.mjs --fast` locally after each page.

## GitHub → .github/workflows/migration-smoke.yml

```yaml
name: migration-smoke
on: { push: { branches: [migration] } }
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: node .migration/smoke.mjs --fast --ci
```
Setup guidance: Actions are on by default for private repos; check
Settings → Actions if runs don't appear. No secrets needed (smoke is local
to the build output).

## Bitbucket → bitbucket-pipelines.yml

```yaml
image: node:22
pipelines:
  branches:
    migration:
      - step:
          name: migration-smoke
          caches: [node]
          script:
            - npm ci
            - npm run build
            - node .migration/smoke.mjs --fast --ci
```
Setup guidance: Repository settings → Pipelines → Enable (off by default).
Free-tier build minutes apply; the fast smoke is minutes, not hours.

## GitLab → .gitlab-ci.yml

```yaml
migration-smoke:
  image: node:22
  rules: [{ if: '$CI_COMMIT_BRANCH == "migration"' }]
  cache: { paths: [node_modules/] }
  script:
    - npm ci
    - npm run build
    - node .migration/smoke.mjs --fast --ci
```

## Notes

- `.migration/smoke.mjs` is a copy of the skill's smoke script placed in the
  repo at intake (CI runners can't see `~/.claude`); intake keeps it in sync.
- `--fast` = routes + links only. `--ci` = machine-readable output + nonzero
  exit fails the pipeline.
- Adjust build command if the target isn't npm-scripted (record in config).
