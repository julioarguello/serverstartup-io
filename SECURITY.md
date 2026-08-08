# Security Policy

## Reporting a vulnerability

Write to **[ventas@serverstartup.io](mailto:ventas@serverstartup.io)**
(Spanish or English). The canonical, machine-readable contact is
[`https://serverstartup.io/.well-known/security.txt`](https://serverstartup.io/.well-known/security.txt).

- Report privately before publishing anything.
- Please do not open public issues containing working exploits.
- Include what you found, where, and how to reproduce it — a curl command
  beats a paragraph.

You will get an answer from one of the three people who wrote the code, not
a ticket queue.

## Scope

- The code in this repository (templates, middleware, CI workflows,
  scripts) and the Cloudflare Workers infrastructure it deploys to.
- The `serverstartup.io` site **once this code is live there** — the domain
  serves our previous site until the DNS cutover, and that site is not this
  codebase.

Out of scope: denial-of-service traffic and automated scanner noise without
a demonstrated impact.

## What we already watch

Every pull request runs secret scanning over the full history, asserts a
strict Content-Security-Policy suite on live rendered responses, and
installs dependencies from a lockfile. The header battery is reproducible
from this repository: `scripts/ci-check-headers.sh <base-url>`.
