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

- The production site `serverstartup.io` and its Workers infrastructure.
- The code in this repository (templates, middleware, CI workflows,
  scripts).

Out of scope: denial-of-service traffic and automated scanner noise without
a demonstrated impact.

## What we already watch

Every pull request runs secret scanning (full history), a strict
Content-Security-Policy suite asserted on live responses, and dependency
installs from a lockfile. The security headers you can verify yourself:
`curl -sI https://serverstartup.io/`.
