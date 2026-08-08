# Contributing

This document is the complete operating manual for working on the site:
local setup, conventions, the quality bar, and how a change travels from
branch to production. It serves two audiences — the team, and anyone reading
the public mirror who wants to understand (or challenge) how we work.

## Where development happens

Development lives in a private working repository. The public repository
([julioarguello/serverstartup-io](https://github.com/julioarguello/serverstartup-io))
is a mirror that receives `main` and release tags automatically on every
push — it only ever fast-forwards, never force-pushes.

- **You are on the team**: branch in the private repo, open a PR there.
- **You are an outside reader**: we cannot merge PRs on the mirror, but
  issues are welcome and read, and
  [ventas@serverstartup.io](mailto:ventas@serverstartup.io) reaches the
  people who wrote the code.

## Local setup

Prerequisites: Node 22 (what CI runs) and npm.

```bash
npm install
npx emdash dev          # dev server at :4321, admin at /_emdash/admin
```

The first boot creates a local D1 database (Wrangler's emulator) and runs the
CMS migrations. To load the real content, seed it — **with the dev server
down**; seeding while it runs corrupts the full-text-search tables:

```bash
D1_DB=$(find .wrangler -name "*.sqlite" -path "*/d1/*" -not -name "metadata.sqlite")
npx emdash seed seed/seed.json -d "$D1_DB"
```

Clean rebuild after schema changes, and the reasoning behind the recipe:
[`docs/architecture.md`](docs/architecture.md) §10.1.

Two local gotchas worth knowing before they cost you an hour:

- `npx wrangler dev` needs a prior `npx astro build` — the Cloudflare adapter
  generates the wrangler config during the build.
- If you have built with `CLOUDFLARE_ENV=preview` at some point, you may have
  two local sqlite files; the seed recipe above targets whichever exists, so
  after switching environments, rebuild with the default env first.

## Branches, commits, pull requests

- **Never commit to `main`.** Every change, however small, goes through a
  branch and a PR.
- Branch names: `<type>/<issue>-<slug>` — real examples:
  `feat/155-design-system`, `ci/192-quality-gates`, `docs/204-public-readme`.
- Commits: conventional style with a scope when it helps —
  `feat(design): …`, `ci: …`, `content(seo): …`. The subject says what
  changed; the body says why and what was verified.
- One issue = one branch = one PR. PRs are squash-merged (the practice since
  August 2026; older history carries true merges); the squash subject keeps
  the PR number.
- A PR is mergeable when the quality gates are green and the description
  states what was verified, not just what was edited.

## Content changes

The architecture is UI-first, content-driven: templates carry layout and CSS,
the CMS carries every word.

- **Content ownership has two phases.** Pre-release (now): seeds are the
  source of truth — any content change lands in `seed/` (`seed.json` or
  `seed/content/`), so a clean rebuild reproduces the whole site, and an
  edit made only in the admin UI will not survive one. Once live: the
  production database owns the content and the admin UI
  (`/_emdash/admin`) is the editing surface — that is what the CMS is
  for. The seeds then remain the bootstrap corpus and the fixture for
  local dev and preview; re-seeding production becomes a destructive,
  opt-in operation (see the production deploy workflow). Templates,
  schema and code keep flowing through PRs in both phases — only content
  ownership changes.
- **No text in templates.** UI strings come from CMS widgets (`t()` /
  `labels.get()`), contact data from site settings (`getSiteSettings()`),
  body copy from PortableText. If you are typing a Spanish or English word
  inside a `.astro` file, stop.
- **i18n has hard rules**: every Spanish route has an English equivalent (the
  language switcher does a clean prefix swap); internal links on English
  pages carry the `/en/` prefix; dates format with `Astro.currentLocale`,
  never a hardcoded locale. English content is a re-expression of the
  Spanish, not a translation.
- **Client confidentiality**: public copy names no customers. A CI guard
  enforces the policy; anonymous references ("a retail chain") and aggregates
  are fine. When in doubt, leave the name out.
- **Voice**: the house style is documented internally and enforced in
  review — concrete, falsifiable, no exclamation marks, no filler. First
  drafts may be agent-written; nothing publishes without a human signature.

## Code changes

- **Design tokens** live in `src/styles/` and are documented in
  [`docs/design-system.md`](docs/design-system.md). No per-page style
  duplication — ES and EN pages are thin wrappers around shared components.
- **CSP constraint (the expensive one)**: the middleware sends
  `script-src 'self'` with no hashes and no `unsafe-inline`. Vite is
  configured to never inline scripts (`assetsInlineLimit: 0` in
  `astro.config.mjs`); keep it that way, and never add inline *executable*
  scripts (JSON-LD data blocks are fine — the browser does not execute
  them, so the CSP does not apply). An inlined executable script is not an
  error you will see — the browser blocks it silently and a feature just
  stops working.
- **Type-safety patterns that D1 and Astro impose**: SQLite stores booleans
  as `0`/`1` — use `Boolean(x)`, never `=== true`; PortableText blocks need
  an `any[]` cast when iterated; no `.toSorted()` (the base tsconfig lacks
  ES2023) — use `[...arr].sort()`.
- **Caching**: every page that queries CMS content calls
  `Astro.cache.set(cacheHint)`. The cache provider is configured at launch
  (until then the call is a harmless no-op) — but the convention holds now,
  because a page missing its hint will serve stale content after a CMS
  publish the moment the provider exists.

## The quality bar

CI enforces all of this on every PR; run it locally first. Everything is
reproducible with the scripts in [`scripts/`](scripts/):

| Gate | Local command | Target |
| :--- | :--- | :--- |
| Types | `npm run typecheck` | 0 errors, 0 warnings |
| Seed schema | `npx emdash seed seed/seed.json --validate` | valid |
| CMS text | `python3 scripts/ci-check-cms-text.py` | labels resolve in both locales; 0 hardcoded copy |
| Build | `npm run build` | completes |
| Seeded boot | `scripts/ci-local-stack.sh 8787` | homepage 200 from seeds alone |
| HTML | `html-validate` over the 15 rendered routes | 0 problems |
| Headers | `scripts/ci-check-headers.sh http://localhost:8787` | full suite present |
| Lighthouse | `lighthouserc.json` assertions | perf ≥ 95; a11y, BP, SEO = 100 |
| Secrets | gitleaks (CI) | no leaks, full history |
| Post-deploy | `scripts/verify-deploy.sh <base-url>` | 20 routes + headers + W3C Nu, all green |

Two habits that keep these gates meaningful:

- TypeScript stays pinned to 5.x — `astro check` has no working API on
  TS 7 and TS 6 misreports inference errors. Do not "upgrade" it in passing.
- If you add a check, prove it can fail (run it against something broken)
  before trusting its green.

## From merge to production

```
PR → quality gates green → squash merge to main
                              │ automatic (workflow_run)
                              ▼
              deploy-preview: build → refresh preview
              content from seeds → deploy → verify-deploy
                              │ a maintainer verifies the preview
                              ▼
              deploy-production: manual dispatch ONLY
              (rebuild of the verified commit → deploy → verify-deploy)
```

Merging deploys nothing to production. The manual dispatch is the approval
gate, and the same 20-route verification battery runs after both deploys.
One nuance worth knowing: preview always rebuilds its content from seeds (a
stable fixture for verifying code and template changes); production content,
once the site is live, is CMS-managed and never overwritten by a deploy.
Details, including why preview and production cannot share a build artifact:
[`docs/architecture.md`](docs/architecture.md) §10.2.

## Security issues

Report privately first — [SECURITY.md](SECURITY.md) and
[`/.well-known/security.txt`](https://serverstartup.io/.well-known/security.txt).
Please do not open public issues with working exploits.

## Conduct

Small team, short version: argue about the work, not the person; show
evidence; assume competence. The same critical honesty we ask of our tools we
ask of each other.
