# Third-party integrations & secrets — the missing-key gap

Scraping rendered output recovers some integration values and CANNOT recover
others. Treating them all the same either leaks/hardcodes keys or ships a site
with broken maps/analytics. Classify every detected integration into one of
three tiers; each is handled differently. NEVER hardcode any value into source
or commit a secret.

## Tier 1 — Public IDs, domain-portable (copy, but via env var + owner confirm)

Public identifiers embedded in the page that work on ANY domain:
- Google Tag Manager container (`GTM-XXXX`), GA4 measurement ID (`G-XXXX`,
  legacy `UA-…`), Facebook Pixel ID, Hotjar/Clarity IDs.

Handling: extract the value, but reference it through a PUBLIC env var
(`NEXT_PUBLIC_GTM_ID`, etc.) — never inline the literal in a component.
Record it in `.env.example` (committed, real value OK since it's public) and
in `migration/integrations.json`. FLAG for owner confirmation: "keep the same
analytics property, or point at a new one?" — the migrated site sending data
to the old GA property is a decision, not an assumption.

## Tier 2 — Domain-RESTRICTED keys (preserved but WILL break → owner action)

Keys present in the page but bound to the source domain, so copying verbatim
FAILS on the new domain:
- Google Maps JS/Embed API key (HTTP-referrer restricted to the old host),
  reCAPTCHA site keys (domain allowlist), any key with a referrer restriction.

Handling: preserve the embed/markup, but the KEY goes in `.env.local`
(gitignored) referenced via env var — and the integration is recorded in
`integrations.json` with `status: "needs_owner"` and the required action:
either add the new domain to the key's allowed-referrers in the provider
console, or issue a new key. This is a HUMAN GATE surfaced in the recon
summary and at cutover — the build proceeds (markup + env var wired) but the
integration is flagged non-functional until the owner acts. A keyless Maps
embed (`/maps/embed?pb=…`) is Tier-portable and needs no key.

## Tier 3 — Server-side secrets, NEVER in the scrape (must be provisioned)

Values that lived in WP server config / plugin settings and were never in
rendered output, so they are UNRECOVERABLE by any capture:
- Form backend secret keys, SMTP credentials, payment/booking API secrets,
  reCAPTCHA SECRET key (the server half), any private API token.

Handling: the skill cannot and must not invent these. They are recorded in
`integrations.json` as `status: "must_provision"`, wired as env vars in
`.env.local` (gitignored, owner fills), with a one-line note on what each is
for. These ride the existing form_policy / app-shaped flags — a form whose
backend secret is unprovisioned routes to needs_human, never silently ships
a dead form.

## Consent banner (functional, not just visual)

The cookie/consent banner is MASKED during capture (so screenshots are stable)
— but it is a functional requirement on the new site, not décor. Under PDPA
(Thailand) / GDPR it must actually gate the Tier-1 analytics tags: GTM/GA/Pixel
fire only AFTER consent. So: rebuild a working consent mechanism (e.g. Consent
Mode v2 wired to the banner), load tags conditionally, and record it as an
integration with `status: needs_build`. Masking it for parity does NOT mean it
can be omitted — a site that fires analytics pre-consent is a compliance
failure, not a parity pass.

## Artifacts

- `migration/integrations.json` — inventory: `{ name, tier, type, found_value
  (Tier-1 only), env_var, status: ok|needs_owner|must_provision, action }`.
  Surfaced in report.mjs and at the URL-map/recon gate.
- `.env.example` — committed; documents every env var, real values only for
  Tier-1 public IDs, placeholders for Tier-2/3.
- `.env.local` — gitignored; owner fills the restricted/secret values.
- `.gitignore` MUST cover `.env.local` and `.env*.local`.

## Hard rules

- Never hardcode a key/ID in a component or commit a secret. Everything is an
  env var; secrets live only in gitignored `.env.local`.
- Never fabricate a missing key to make something "work" — Tier-2/3 gaps are
  surfaced as owner actions, not papered over.
- Detection happens at intake (probe HAR + DOM for known ID patterns and
  third-party hosts); the owner confirms/extends the inventory once.
