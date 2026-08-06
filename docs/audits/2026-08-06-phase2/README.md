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
