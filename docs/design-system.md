# Design system — serverstartup.io

> Consolidated 2026-08-05 (issue #155, master plan #165). Source of truth for
> visual tokens: [`src/styles/theme.css`](../src/styles/theme.css) `:root` block.
> Original values extracted from the WordPress Elementor Kit (see
> [migration-guide.md](migration-guide.md)); the site is **light-theme** by design.

## Principles

1. **No CSS frameworks.** Plain CSS with custom properties. Total source budget
   **< 50 KB**; current: ~31 KB across 10 files (`wc -c src/styles/*.css`).
2. **Mobile-first.** Base styles = mobile; enhancements at `min-width: 768px`
   (tablet) and `min-width: 1025px` (desktop).
3. **Tokens over literals.** Every color used more than once must be a `:root`
   custom property. As of #155 there are zero hex literals outside `theme.css`.
4. **Minimal but personal.** Personality comes from content, the per-vertical
   card colors, and targeted monospace accents, not from decoration.

## Color tokens

| Token | Value | Use |
| ----- | ----- | --- |
| `--color-primary` / `--color-text` / `--color-accent` | `#1E1E1E` | Ink |
| `--color-secondary` | `#FFFFFF` | Paper |
| `--color-card-blue/yellow/teal/pink/green` | pastels (`#B5E6F7`…) | Service cards (fed to CMS `color` field) |
| `--color-btn-hover` / `--color-btn-cta-hover` | `#CACACA` / `#E7EAED` | Button states |
| `--color-marked` | `rgba(206,212,218,.5)` | Text highlight |
| `--color-surface` / `--color-surface-soft` / `--color-surface-hover` | `#f5f5f5` / `#fafafa` / `#e8e8e8` | Neutral backgrounds (blog, code blocks) |
| `--color-ink-soft` | `#3a3a3a` | Dark soft backgrounds (about team section) |

### The two palette layers

- **UI pastels** (above): what renders on cards today; they came from the Figma
  design and live in the CMS `color` field of each service.
- **Brand vertical palette** (identity, [docs/company/01](company/01-identity.md)):
  E-commerce `#008FD3` · Greenfield `#3E7D50` · Cloudflare `#F38020` ·
  Big Data `#EA4335` · Integration `#1D4E89`.

They are related but not identical. Whether the site should adopt the brand
palette (stronger, more personal) or keep the Figma pastels is a **taste
decision pending Julio** — tracked in #155/#156, not decided by the agent.

## Typography

Fonts load through **Astro's fonts API** (`astro.config.mjs`), Google provider,
self-optimized at build:

- **Alexandria** 300–700 → `--font-sans` (body/headings; `theme.css` currently
  re-declares it as `--font-family` — candidate cleanup, needs visual check)
- **JetBrains Mono** 400–500 → `--font-mono`, mirrored as `--font-family-mono`
  in `theme.css`. This is the "monospace as accent" carrier: intended for
  equation-headlines (`WAF ≠ seguridad`), the Tomcat log line, code-ish accents.
  Adopting it site-wide in headings is a taste decision — pending Julio.

**Observed type scale (px)**: 12 · 14 · 18 · 20 · 22 · 24 · 26 · 28 · 32 · 40 ·
48 · 72. Sizes are declared per component (not tokenized) — acceptable at this
CSS size; tokenize only if the scale starts drifting.

## Layout tokens

`--container-max: 1440px` · `--section-padding: 80px` · `--card-radius: 24px` ·
`--card-shadow: 0 0 10px rgba(0,0,0,.15)` · `--widget-spacing: 20px`

## Breakpoints

Canonical: **768px** (tablet, 17 uses) and **1025px** (desktop, 4 uses),
`min-width`, mobile-first. Strays to normalize when touched: one `max-width:
600px`, one `900px`, one `1100px` (post-detail/menu) — flagged, not urgent.

## Open taste decisions (for Julio, feeding #156)

1. Brand vertical palette vs Figma pastels on service cards.
2. JetBrains Mono reach: accents only, or headings too.
3. Dark mode: the original design is light-only; offering `prefers-color-scheme`
   would be new design work, not consolidation.
