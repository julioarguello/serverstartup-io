# Phase-2 standards audit — 2026-08-06

Scope: issues #157 (WCAG 2.2 AA) and #158 (W3C validation) against the finished
instrument-system visuals (post #182/#183), on the local dev server.

## Results

| Check | Tool | Result |
| ----- | ---- | ------ |
| HTML validation (11 templates) | `html-validate` (recommended preset, [policy](validation-policy.md)) | **0 problems** |
| W3C official | Nu checker API | **0 errors on `/`**; service/contact pages show only dev-server artifacts (Vite HMR script tags) — re-run against the production build at launch (#162 checklist) |
| Accessibility | Lighthouse (axe) on home, cart, dashboard, contact | **100 / 100 / 100 / 100** |
| Best practices / SEO | Lighthouse | **100 / 100** on all four |
| Performance (lab, dev server) | Lighthouse | 78–80 — unminified dev output; the real measurement happens on the production Workers build (#159, gated on build/preview) |

## Fixes applied (this branch)

1. Real list semantics: trust logos, homepage service cards, team grid,
   Cloudflare features and contact methods converted from `div[role=list]` /
   `role=listitem` to native `ul`/`li` (with `role="list"` kept deliberately —
   Safari/VoiceOver drops semantics on `list-style: none` lists).
2. Truly redundant roles removed: `banner` on header, `contentinfo` on footer.
3. Document outline fixed: footer trust title h4→h2, footer column h5→h3
   (visual sizes preserved in their classes) — `heading-order` now passes.
4. Contrast: `#9aa0a6` fine print → `#5f6368` (2.6:1 → 7:1); dashboard ACTIVO
   chip green `#188038` → `#0d652d` on its `#e6f4ea` pill (4.4 → >6:1).
5. Accessible-name mismatch: redundant `aria-label` removed from the contact
   email card (its visible text is the name).
6. BigQuery results grid: `div[role=table]` → a real `<table>` with `thead`,
   `th scope="col"` and `tabular-nums`.

## Follow-ups (tracked)

- #158: final Nu run against the production build (dev-artifact noise excluded).
- #159: Lighthouse performance against `astro build` + Workers preview, mobile
  throttling, plus font/caching budget review.

## Production build results (same day, `astro build` + `wrangler dev` preview)

| Page | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS |
| ---- | ---- | ---- | -- | --- | --- | --- | --- | --- |
| home | **100** | 100 | 100 | 100 | 0.9 s | 1.0 s | 0 ms | 0 |
| cart (e-commerce) | **100** | 100 | 100 | 100 | 1.1 s | 1.1 s | 0 ms | 0 |
| dashboard (edge) | **100** | 100 | 100 | 100 | 1.1 s | 1.1 s | 0 ms | 0 |
| contact | **100** | 100 | 100 | 100 | 0.9 s | 1.3 s | 0 ms | 0.002 |

Mobile emulation with Lighthouse default throttling. The #159 budget
(LCP < 1.5 s · CLS < 0.05 · TBT/INP proxy < 200 ms) is met with margin.

W3C Nu on production HTML: **0 errors** on every checked page after moving the
contact decode `<script>` inside the layout slot (it was being emitted after
`</html>`).

**Open finding for launch (#162)**: the runtime logs
`cache.set() was called but caching is not enabled` — project rule §4 calls
`Astro.cache.set()` on every page but no `experimental.cache` provider is
configured, so edge caching is currently a no-op. Configure the cache provider
as part of production deployment and verify cache HITs from the edge.

## Security headers (#164, same day)

Implemented in `src/middleware.ts`, verified with `curl -I` on the Workers
preview and a full-page render check under the final policy:

- CSP: `default-src 'self'`; `script-src 'self'` (all scripts are bundled
  modules; inline JSON-LD is non-executable); `style-src 'self' 'unsafe-inline'`
  (Astro inlines component styles — documented trade-off, hash-based upgrade
  path); `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`. `upgrade-insecure-requests` deliberately omitted
  (Cloudflare Always-Use-HTTPS at the edge; the directive kills styles on the
  http-only local preview — found the hard way, render-verified).
- HSTS preload · nosniff · Referrer-Policy strict-origin-when-cross-origin ·
  Permissions-Policy (camera/mic/geo/payment off) · X-Frame-Options DENY · COOP.
- `/_emdash` admin excluded (ships its own assets). `/.well-known/security.txt`
  published.
- Pending live domain (#162): Mozilla Observatory scan on production.
