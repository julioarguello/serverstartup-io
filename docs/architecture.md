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

### 4.3 Shared CSS

| File | Used by |
|:-----|:--------|
| `styles/theme.css` | Global design tokens, typography, colors |
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
- **hreflang** tags with absolute URLs and `x-default`
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

- Every page that queries CMS content **must** call `Astro.cache.set(cacheHint)`.
- API routes (RSS) use `Cache-Control: public, max-age=3600` as fallback.
- Cloudflare CDN provides edge caching. Static assets are served directly.

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
                    → refresh preview D1 from seed/seed.json
                    → wrangler-action deploy → verify-deploy battery
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
  (`seed_d1` input — overwrites CMS edits made live).
- **Post-deploy verification** (`verify-deploy.yml`, reusable): 20 routes ×
  (200 + served title), 404 behavior, security-header suite, robots/sitemap/
  canonical/hreflang, W3C Nu spot-check (downtime warns, errors fail).
- Quality gates on every PR (`ci.yml`): gitleaks, citability guard,
  `astro check` 0/0 (TypeScript pinned to 5.x — `astro check` has no
  programmatic API on TS 7 and TS 6 misreports inference errors), seed
  validation, build, seeded boot, html-validate ×15 routes, header suite,
  Lighthouse 3-run median (perf ≥ 95, a11y/bp/seo = 100).
- **CSP constraint**: `script-src 'self'` with no hashes — Vite must never
  inline scripts into HTML (`assetsInlineLimit: 0` in astro.config.mjs) or
  the browser silently blocks them (menu + phone decode died this way).

## 11. Security

- MCP tokens **must not** be passed via CLI arguments (visible in `ps aux`)
- Use environment variables or config files for secrets
- See `docs/security/mcp-token-exposure.md`

