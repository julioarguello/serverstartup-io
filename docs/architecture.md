# www.serverstartup.io — Architecture Guide

> Corporate site for Server Startup S.L. — Astro + EmDash CMS on Cloudflare Workers.

## 1. Technology Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Framework** | Astro 5.x (`output: "server"`) | SSR, routing, build |
| **CMS** | EmDash CMS | Content management, admin UI at `/_emdash/admin` |
| **Database** | Cloudflare D1 (SQLite) | CMS persistence |
| **Storage** | Cloudflare R2 (`MEDIA` binding) | CMS images and uploads |
| **Video** | Cloudflare Stream | Video hosting with adaptive bitrate |
| **Hosting** | Cloudflare Workers | SSR runtime |
| **Fonts** | Google Fonts (Alexandria, JetBrains Mono) | Astro font provider |
| **Sitemap** | `@astrojs/sitemap` | Automatic sitemap generation |
| **Plugins** | `@emdash-cms/plugin-forms`, `plugin-webhook-notifier` | Form handling, notifications |

## 2. Content Architecture

### 2.1 Principle: CMS-Driven Content

All editorial text lives in EmDash CMS. Templates contain only layout, CSS, and structural elements.

| Layer | Content |
|:------|:--------|
| CMS `pages` | Static pages (home, about, privacy, contact) |
| CMS `services` | Service descriptions with `cta_label`, `color`, `featured_image` |
| CMS `posts` | Blog articles with bylines, tags, categories |
| CMS `members` | Team profiles (name, role, bio, photo) |
| CMS `partners` | Partner logos and descriptions (e.g., Cloudflare) |
| CMS Widgets | UI labels (`ui_labels_es/en`), aria labels, CTA blocks |
| CMS Site Settings | Phone, email, WhatsApp, company name, default CTA |
| Template (Astro) | Layout, CSS, animations, design tokens |

### 2.2 Collections

| Collection | Key Fields | Supports |
|:-----------|:-----------|:---------|
| `pages` | `title`, `content` (Portable Text) | drafts, revisions, search |
| `services` | `title`, `excerpt`, `content` (PT), `featured_image`, `cta_label`, `color` | drafts, revisions, search |
| `posts` | `title`, `excerpt`, `content` (PT), `featured_image` | drafts, revisions, search, bylines |
| `members` | `title`, `excerpt`, `featured_image`, `content` (PT) | — |
| `partners` | `title`, `featured_image`, `content` (PT) | — |

### 2.3 Taxonomies

| Taxonomy | Collection | Purpose |
|:---------|:-----------|:--------|
| `category` | `posts` | Blog post categories |
| `tag` | `posts` | Blog post tags |

### 2.4 Seed File

`seed/seed.json` is the **source of truth** for initial content: schema, content, settings, menus, widgets, and taxonomies. After schema changes, always do a clean rebuild.

## 3. Internationalization (i18n)

### 3.1 Strategy: Everything in the CMS

A single editing surface for translators. No JSON files, no code-level dictionaries.

| Layer | Mechanism |
|:------|:----------|
| **Editorial content** | `locale` + `translationOf` on CMS entries |
| **UI labels** | Locale-scoped widget areas (`ui_labels_es`, `ui_labels_en`, `aria_labels`) |
| **Language-neutral** | Global site settings (phone, email) |
| **Aria labels** | CMS-driven via middleware `Astro.locals.t` |

### 3.2 Routing

- **Default locale**: `es` (no URL prefix — `/quienes-somos`)
- **English**: `/en/` prefix — `/en/about-us`
- **Language switcher**: `LanguageSwitcher.astro` — prefix swap between locales
- **`prefixDefaultLocale: false`** — Spanish pages at root

### 3.3 Middleware

`src/middleware.ts` loads locale-specific aria labels from CMS on every request and stores the `t()` function on `Astro.locals.t`. This eliminates prop drilling and global state race conditions.

### 3.4 Route Parity

All routes exist in both ES and EN:

| ES Route | EN Route |
|:---------|:---------|
| `/` | `/en/` |
| `/[slug]` (services/pages) | `/en/[slug]` |
| `/posts/` | `/en/posts/` |
| `/posts/[slug]` | `/en/posts/[slug]` |
| `/category/[slug]` | `/en/category/[slug]` |
| `/tag/[slug]` | `/en/tag/[slug]` |
| `/contacto` | `/en/contact` |
| `/quienes-somos` | `/en/about-us` |
| `/search` | `/en/search` |
| `/politica-de-privacidad` | `/en/privacy-policy` |
| `/rss.xml` | `/en/rss.xml` |

## 4. Component Architecture

### 4.1 Layout

`Base.astro` — Minimal shell that orchestrates:
- `SiteHeader.astro` — Sticky header (logo, LanguageSwitcher, hamburger)
- `MenuDialog.astro` — Fullscreen mobile navigation overlay
- `<slot />` — Page content
- `SiteFooter.astro` — 4-column footer (services, partners, contact, legal)

### 4.2 Shared Components

| Component | Purpose |
|:----------|:--------|
| `HomepageContent.astro` | Shared homepage layout (ES/EN wrappers are thin) |
| `CloudflarePartner.astro` | Featured partner card |
| `CtaGlobal.astro` | Locale-aware CTA block from CMS widget |
| `PostCard.astro` | Blog post card with image, tags, bylines |
| `TagList.astro` | Tag pill list |
| `LanguageSwitcher.astro` | ES ↔ EN toggle |
| `PtLink.astro` | Whitespace-safe Portable Text link mark (single-line `<a>`; EmDash's default emits spaces inside anchors, breaking lines before punctuation). Supports `blank: true` markDefs (`target="_blank" rel="noopener noreferrer"`). Pass via `components={{ mark: { link: PtLink } }}` — adopted on the About pages, candidate for site-wide use. |

### 4.3 Shared CSS

| File | Used by |
|:-----|:--------|
| `styles/theme.css` | **The only** declaration of colour, radius, shadow and spacing (design tokens), plus typography. Every other sheet consumes tokens — enforced by the `ci-check-design-tokens.py` gate. |
| `styles/homepage.css` | Homepage layout |
| `styles/service.css` | Service detail pages |
| `styles/archive.css` | Category and tag archives |
| `styles/posts.css` | Blog listing pages |
| `styles/post-detail.css` | Blog post detail (617 lines) |
| `styles/about.css` | About page |
| `styles/contact.css` | Contact page |
| `styles/search.css` | Search page |

## 5. SEO

### 5.1 Meta Tags

- **Canonical URLs** on all pages via `Base.astro`
- **Open Graph + Twitter Card** meta tags (title, description, image, URL, type)
- **hreflang** tags with absolute URLs and `x-default` — alternate URLs resolved from the CMS `translationOf` group via `src/utils/alternate.ts` (#291: slugs are translated, so the `/en` prefix swap is only valid for locale-invariant routes). The same resolved value feeds the `LanguageSwitcher`; contract verified by `scripts/hreflang-sweep.py`
- **RSS autodiscovery** `<link>` in `<head>`
- **`@astrojs/sitemap`** with i18n-aware sitemap
- **`robots.txt`** with sitemap reference
- **Article meta** — `publishedTime`, `modifiedTime` for blog posts via `getSeoMeta()`

### 5.2 JSON-LD Structured Data

Centralized in `src/utils/jsonld.ts` — typed helper functions that consume CMS data:

| Page type | Schema | Helper function |
|:----------|:-------|:----------------|
| Homepage (ES/EN) | `Organization` + `WebSite` | `homepageJsonLd()` |
| Service detail (ES/EN) | `Service` | `serviceJsonLd()` |
| About (ES/EN) | `AboutPage` + team members | `aboutJsonLd()` |
| Contact (ES/EN) | `LocalBusiness` | `contactJsonLd()` |
| Blog post (ES/EN) | `BlogPosting` | `blogPostJsonLd()` |

All schemas use CMS data — no hardcoded strings. Validate with [Google Rich Results Test](https://search.google.com/test/rich-results).

## 6. Analytics

- **Cloudflare Web Analytics** via **Zaraz** (edge-injected, zero client-side JS)
- Configured in Cloudflare Dashboard → Zaraz → Third-party tools
- No code in `Base.astro` — Zaraz auto-injects on all proxied pages
- Extensible: GA4, Meta Pixel, etc. can be added via dashboard without code changes

## 7. Media & Video Strategy

### 7.1 Images — R2 via EmDash

CMS images (featured images, inline media) are managed through the EmDash admin UI, which stores them in the R2 bucket bound as `MEDIA` in `wrangler.jsonc`. No manual R2 interaction is needed for CMS content.

### 7.2 Video — Cloudflare Stream

Videos are hosted on **Cloudflare Stream** — a managed platform with automatic transcoding (HLS/DASH), adaptive bitrate, and zero-config playback.

| Aspect | Detail |
|:-------|:-------|
| **Dashboard** | Cloudflare → Stream → Videos |
| **Account** | Server Startup (`d70cd71aecc76f94c73d7a6f3cc1265d`) |
| **Pricing** | ~$5/1000 min stored + $1/1000 min delivered |
| **Upload** | Dashboard UI or API (`CF_STREAM_TOKEN` in `.env`) |
| **Registry** | `reference/legacy/media/STREAM-VIDEOS.md` |

#### Upload via API

```bash
source .env
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream" \
  -H "Authorization: Bearer ${CF_STREAM_TOKEN}" \
  -F "file=@path/to/video.mp4" \
  -F 'meta={"name":"descriptive-name"}'
```

#### Embed in Astro

```html
<iframe
  src="https://customer-XXXX.cloudflarestream.com/{VIDEO_ID}/iframe"
  style="border: none; width: 100%; aspect-ratio: 16/9;"
  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
  allowfullscreen>
</iframe>
```

#### Why Stream over R2 for video?

- **Automatic transcoding** — no need to maintain multiple resolutions manually
- **Adaptive bitrate** — optimal quality on any device/bandwidth
- **Built-in player** — professional embed, no custom player code
- **EmDash doesn't support video natively** — no video fields or player in the CMS
- **R2 video serving** requires building your own encoding pipeline — disproportionate effort

## 8. PWA (Progressive Web App)

Basic PWA support via Web App Manifest — enables mobile home screen installation without a full service worker.

| File | Purpose |
|:-----|:--------|
| `public/site.webmanifest` | App name, icons, theme color, display mode |
| `public/assets/icon-192.png` | Home screen icon (192×192) |
| `public/assets/icon-512.png` | Splash screen icon (512×512) |

`Base.astro` includes:
- `<link rel="manifest">` → manifest file
- `<meta name="theme-color">` → `#1E1E1E` (matches `--color-primary`)
- `<link rel="apple-touch-icon">` → iOS home screen icon

## 9. Caching

Rewritten after #332/#357. The previous version of this section claimed
"Cloudflare CDN provides edge caching" — measured false: nothing was cached at
either layer, and the 27 `Astro.cache.set(cacheHint)` calls emitted no headers
because no provider was configured.

- **Edge**: Workers Cache is opted in from `wrangler.jsonc` (`"cache": { "enabled": true }`,
  all three environments). It sits **in front of** the worker: on a hit the
  code does not run.
- **Provider**: `cacheCloudflare()` from `@astrojs/cloudflare/cache`, declared in
  `astro.config.mjs`. It turns a `cacheHint` into `Cloudflare-CDN-Cache-Control`
  plus `Cache-Tag` (the hint's tags, plus an automatic per-path tag).
- **Policy — default-deny**, in `src/middleware.ts`. With Workers Cache on, a 200
  without `Cache-Control` is heuristically cacheable for ~2h under RFC 9111,
  admin pages included. So only a page that opted in — proven by the tags it
  accumulated from its own `Astro.cache.set(cacheHint)` — gets `maxAge: 3600,
  swr: 60`. Everything else gets an explicit `no-store`.
- **Where a hint may be set**: page frontmatter (`src/pages/**`) or the
  middleware, and nowhere else. A `cache.set` inside a layout or component runs
  mid-stream, after the response headers have left, and is silently dropped.
  `scripts/ci-check-cache-hints.py` enforces this.
- **Footer data** (services, partners, references render on every page) is
  tagged centrally in the middleware for that same reason.
- **Purge on publish**: `src/plugins/cache-purge.ts`, an in-repo EmDash plugin
  (`capabilities: ["content:read"]`, without which the runtime skips every hook
  silently). It purges tags `[collection, id]` on afterSave-when-published,
  afterPublish, afterUnpublish, afterDelete and afterRestore — so purging an
  entry also evicts the pages that merely embed it.
- **Known gap**: menus and site settings emit no publish hook in EmDash 0.34,
  so their staleness is bounded by the 1h TTL rather than purged.
- **Verification**: `cf-cache-status` on a real preview deploy — `wrangler dev`
  strips the CDN headers and the local emulator implements no purge at all.
  `scripts/verify-purge.sh` runs the end-to-end proof, negative control included.

## 10. Deployment

- **Platform**: Cloudflare Workers
- **Build**: `npm run build` → `dist/`
- **Dev**: `npx emdash dev` (runs migrations, seeds, generates types)
- **Admin**: `http://localhost:4321/_emdash/admin`

### 10.1 D1 Seeding (CRITICAL)

`npx emdash seed` writes to `./data.db` by default. With `d1()` adapter, the dev server uses Wrangler's D1 emulator at `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`.

```bash
# Find and seed the correct DB
D1_DB=$(find .wrangler -name "*.sqlite" -path "*/d1/*" -not -name "metadata.sqlite")
npx emdash seed seed/seed.json -d "$D1_DB"
```

### 10.2 Release ritual (CI/CD, issues #191–#196)

```
PR → quality-gates green → merge to main
                              │
                              ▼ (automatic, workflow_run)
                    deploy-preview: build CLOUDFLARE_ENV=preview
                    → wrangler-action deploy (worker FIRST)
                    → wait until the worker migrates the remote D1
                    → refresh preview D1 from seed/seed.json
                    → verify-deploy battery
                              │
                              ▼ (Julio verifies on the preview URL)
                    deploy-production: workflow_dispatch ONLY
                    → rebuild same commit CLOUDFLARE_ENV=production
                    → wrangler-action deploy → verify-deploy battery
```

- **The manual dispatch IS the production approval gate.** GitHub environment
  required-reviewers is a paid feature on private repos; there is no automatic
  path to production.
- **No same-artifact promotion**: the Cloudflare adapter flattens wrangler
  environment bindings into the build at *build* time (`wrangler deploy --env`
  is a no-op against the generated config). Promotion = rebuilding the same
  commit with `CLOUDFLARE_ENV=production`.
- **Remote D1 seeding** (`scripts/seed-remote-preview.sh`): per-table dumps
  (a whole-db dump writes `sqlite_schema` for the FTS5 virtual tables, which
  D1 rejects), explicit `CREATE VIRTUAL TABLE` + FTS rebuild statements,
  rehearsed on a throwaway sqlite before touching remote. Automatic for
  preview on every deploy; **opt-in and destructive** for production
  (`seed_d1` input — overwrites CMS edits made live), and gated:
  `scripts/ci-guard-prod-seed.sh` counts the rows already in the target and
  **refuses** unless the database is empty or the operator typed the
  confirmation string (#358). Per-table counts are printed before anything is
  written, allowed or refused.
- **Deploy order matters** (#369/#370): the worker is deployed **before** the D1
  refresh. EmDash applies its migrations lazily in the request path, so on a
  schema-bumping release only the new worker can move the remote schema
  forward; refreshing first fails with a column-count mismatch. The wait step
  polls the remote `_emdash_migrations` count against a target **derived** from
  a locally seeded database, never a hardcoded number.

- **Post-deploy verification** (`verify-deploy.yml`, reusable): 20 routes ×
  (200 + served title), 404 behavior, security-header suite, robots/sitemap/
  canonical/hreflang, W3C Nu spot-check (downtime warns, errors fail).
- Quality gates on every PR (`ci.yml`): gitleaks, citability guard,
  `astro check` 0/0 (TypeScript pinned to 5.x — `astro check` has no
  programmatic API on TS 7 and TS 6 misreports inference errors), seed
  validation, CMS text integrity, design tokens, build, seeded boot,
  html-validate ×15 routes, header suite, accessibility, Lighthouse 3-run
  median (perf ≥ 95, a11y/bp/seo = 100).
- **Accessibility gate** (`scripts/ci-check-a11y.mjs`): axe-core over a
  sampled route list, plus the checks a rule engine cannot decide — keyboard
  traversal over **every** route the seed declares, both locales, plus the two
  search pages no collection declares — derived like the sitemap, from
  `scripts/lib/seed-routes.mjs`, so the list cannot fall behind a new page and
  the count is not a number anyone has to keep true — each walked
  to the end of the document asserting every stop is visible, carries a focus
  ring and is not under the fixed header; the menu opening with `Enter`,
  holding focus while open, closing with `Escape` and **handing focus back to
  the cube**; WCAG 2.1.4 shortcut scoping; reflow at 320px; and W3C Nu.
  Traversals start by focusing `<body>` — `blur()` clears `activeElement` but
  not the *sequential focus navigation starting point*, so on the autofocusing
  search pages the first Tab otherwise begins mid-document.
- **Every gate carries a positive control** (#385). A check that finds no
  problems and one that *cannot* find problems print the same green line, so
  each gate first plants the exact defect it hunts in a fixture it owns and
  refuses to report anything if it no longer finds it. Failure exits **3** and
  names which guard went blind, distinct from exit 1 (real findings). The
  fixtures live in temporary directories, in-memory strings and a
  `page.setContent` page — never in the repository tree, because a canary in
  the tree trips the very guard it is meant to prove (#347). Controls in
  place: citability (planted name), cache hints (must see the real call
  sites), design tokens (5 planted CSS defects + 3 shapes it must not flag),
  CMS text (hardcoded attribute, hardcoded text node, unseeded label key),
  security headers (a matcher run over present / absent / wrong-value
  responses), copy baseline (routes enumerate, `innerText` returns copy, the
  comparator catches a deleted line, a changed word and a truncation) and
  a11y (a link under a fixed header with its ring suppressed, a 720px block at
  320px, an `<img>` with no alt).
- **Menu check** (`copy-baseline.mjs`, #384): the frozen-copy baselines read
  `document.body.innerText`, which is the *rendered* text, and the menu lives
  in a `<dialog>` closed at rest — so the baseline of all 26 routes is
  identical whether the menu has eleven links or none. That blind spot let a
  whole menu row ship to production (#382). The menu therefore has its own
  **structural** assertion instead of joining the copy contract: the links
  `seed/seed.json` declares must be the links the menu renders, checked on the
  home and a service page per locale. Opening the dialog for the capture
  instead was rejected — `showModal()` makes the document inert and moves
  focus, and the menu's text would couple all 26 baselines to one component.
- **`src/fetch.*` is reserved** (#359, `tests/unit/reserved-paths.test.ts`):
  Astro 7 turns a file at that path into the Advanced Routing entrypoint,
  taking over the whole request pipeline. Nothing lives there and nothing
  should arrive there by accident; the guard steps aside when
  `astro.config.mjs` declares `fetchFile` (renamed, or `null`), which makes
  the file a deliberate act.
- **Design-token gate** (`scripts/ci-check-design-tokens.py`): a colour
  literal, a non-token `border-radius`, a non-token `box-shadow` or a bespoke
  `max-width` outside `theme.css` fails the build. The width rule is the
  layout criterion made executable: a page has ONE column
  (`--container-max`) and everything ends at its right edge, so `max-width`
  may only be the column token, `100%` or `none`. A `var(--token, fallback)` is a token use, not
  a declaration; a region may exempt itself with
  `/* token-guard: off — reason */ … /* token-guard: on */`, which the service
  instruments use because they quote another product's chrome (a cart, a
  BigQuery console, a GitHub pull request). Each run prints how many
  declarations the fences covered, so silencing cannot masquerade as passing.
- **CSP constraint**: `script-src 'self'` with no hashes — Vite must never
  inline scripts into HTML (`assetsInlineLimit: 0` in astro.config.mjs) or
  the browser silently blocks them (menu + phone decode died this way).

## 11. Security

- MCP tokens **must not** be passed via CLI arguments (visible in `ps aux`)
- Use environment variables or config files for secrets
- See `docs/security/mcp-token-exposure.md`

