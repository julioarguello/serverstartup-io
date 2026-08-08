# serverstartup.io

The website of [Server Startup](https://serverstartup.io) — three senior
engineers in Getxo doing backend architecture, systems integration, data
platforms and edge security. One team. Four verticals. Zero handoffs.

This repository is the site itself, open on purpose: we explain how it is
built at [/deconstruyendo](https://serverstartup.io/deconstruyendo)
([EN](https://serverstartup.io/en/deconstructing)), and the explanation is
verifiable here — the copy, the templates, the design tokens, the CI that
keeps us honest.

> **Status: pre-launch.** The domain still serves our previous site; what
> this repository builds goes live with the DNS cutover. Until then, links
> into `serverstartup.io` describe the incoming site, not what the domain
> answers today.

## How it works

- **Astro SSR on Cloudflare Workers** — no servers to babysit; every page
  renders on Cloudflare's edge, in the datacenter closest to the reader.
- **EmDash CMS on D1 + R2** — content management running inside the same
  Worker.
- **Seeds carry the complete launch corpus** — every text of this first
  version lives in [`seed/`](seed/), versioned; a clean rebuild reproduces
  the site word for word. Once the site is live, content moves under the
  CMS's care — that is what a CMS is for — and the seeds remain the
  bootstrap and the local fixture.
- **Agent-drafted, human-signed** — first drafts are written by an agent
  carrying a copywriting skill (house voice, a blacklist, an AI-tell detector
  with a score). A human reviews, corrects and signs every text. The review
  step is not optional.
- **Standards as the hallmark** — Lighthouse 100 on accessibility, best
  practices and SEO in the audits, W3C validation at zero errors, and
  performance measured where it counts: CI asserts ≥ 95 on the production
  build (3-run median) plus those hard 100s, on every pull request. The
  receipts live in [`docs/audits/`](docs/audits/).

## The map

| Path | What lives there |
| :--- | :--- |
| [`seed/`](seed/) | The complete text corpus: schema, content, settings, menus, widgets |
| [`src/pages/`](src/pages/) | Route templates, Spanish at the root and English under `en/` |
| [`src/components/`](src/components/) | Layout shell, service "instruments", assembly manual |
| [`src/styles/`](src/styles/) | Shared CSS and design tokens (documented in [`docs/design-system.md`](docs/design-system.md)) |
| [`src/middleware.ts`](src/middleware.ts) | Security headers on every response, CSP included |
| [`scripts/`](scripts/) | CI helpers (local stack, headers, deploy verification, remote seeding), environment wrappers, content loader, mirror sync |
| [`.github/workflows/`](.github/workflows/) | Quality gates, preview and production deploys, mirror sync |
| [`docs/`](docs/) | Architecture, design system, audit receipts |

## Running it

```bash
npm install
npx emdash dev          # dev server + admin at /_emdash/admin
```

The dev server creates its local database on first boot. To load the real
content, seed it from `seed/seed.json` — the exact recipe (including why the
server must be down while seeding) is in
[`docs/architecture.md`](docs/architecture.md). Local checks and the full
quality bar: [CONTRIBUTING.md](CONTRIBUTING.md).

## From merge to production

```
pull request → quality gates → merge to main
                                   │  automatic
                                   ▼
                     preview deploy + content refresh
                     + 20-route verification battery
                                   │  a human looks at it
                                   ▼
                     production, by manual dispatch only
```

Every PR passes secret scanning, type checking at zero errors and warnings,
schema validation, a full build booted from seeds alone, HTML validation on
15 rendered routes, a security-header suite and Lighthouse assertions —
before a human reads a single line. Merges deploy nothing to production by
themselves; production only ever moves when a maintainer dispatches it. The whole ritual
is documented in [`docs/architecture.md`](docs/architecture.md) §10.2.

## Two homes

Development happens in a private working repository; this public repository
is its mirror, receiving `main` and release tags automatically on every push.
That has one honest consequence: we cannot merge pull requests here. If you
spot a bug, a broken standard, or something you would build better — open an
issue, or write to [ventas@serverstartup.io](mailto:ventas@serverstartup.io).
Both get read by the people who wrote the code.

## Security

Found a vulnerability? [SECURITY.md](SECURITY.md) has the short version;
[`/.well-known/security.txt`](https://serverstartup.io/.well-known/security.txt)
is the canonical contact. Please report privately before publishing.

## A note on what you won't find here

The `.agent/` submodule (internal team skills and rules) points to a private
repository — clones work fine without it. Company knowledge, client details
and anything not ours to publish stay out of this repository and its history,
by design.

## Rights

© Server Startup S.L. The code and content are published so you can read,
learn from and verify them, not to be reused as your own website. If you want
to use something beyond that, ask — we are reasonable people.

If you would do something better, tell us — that is how good conversations
start: [ventas@serverstartup.io](mailto:ventas@serverstartup.io)
