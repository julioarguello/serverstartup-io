# serverstartup.io

The website of [Server Startup](https://serverstartup.io) — three senior
engineers in Getxo doing backend architecture, systems integration, data
platforms and edge security. One team. Four verticals. Zero handoffs.

This repository is the site itself, open on purpose: we explain how it is
built at [/deconstruyendo](https://serverstartup.io/deconstruyendo)
([EN](https://serverstartup.io/en/deconstructing)), and the explanation is
verifiable here.

## How it works

- **Astro SSR on Cloudflare Workers** — no servers to babysit; pages render at
  the edge, under 50 ms from the reader.
- **EmDash CMS on D1 + R2** — content management running inside the same
  Worker.
- **Seeds as the single source of truth** — every text on the site lives in
  [`seed/`](seed/), versioned. A clean rebuild reproduces the whole site,
  word for word.
- **Agent-drafted, human-signed** — first drafts are written by an agent
  carrying a copywriting skill (house voice, a blacklist, an AI-tell detector
  with a score). A human reviews, corrects and signs every text. The review
  step is not optional.
- **Standards as the hallmark** — Lighthouse 100 in performance,
  accessibility, best practices and SEO on every template; W3C validation at
  zero errors. The receipts live in [`docs/audits/`](docs/audits/).

## Running it

```bash
npm install
npx emdash dev          # dev server + admin at /_emdash/admin
```

Clean rebuild from seeds and content operations: see
[`docs/architecture.md`](docs/architecture.md).

## A note on what you won't find here

The `.agent/` submodule (internal team skills and rules) points to a private
repository — clones work fine without it. Company knowledge, client details
and anything not ours to publish stay out of this repository and its history,
by design.

If you would do something better, tell us — that is how good conversations
start: [ventas@serverstartup.io](mailto:ventas@serverstartup.io)
