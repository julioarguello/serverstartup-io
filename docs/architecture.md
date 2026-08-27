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
- `SiteFooter.astro` — 4-column footer (services, partners, contact, legal), plus the
  Kit Digital / NextGenerationEU acknowledgement strip. **Nothing inside that image
  is ours** — red.es issues the five emblems, the endorsement sentence and the rule
  under it as one artefact ("sin banderas" variant; the "con bandera" one belongs in
  the header of a page dedicated to the programme, which this site has none of). Its
  `alt` must reproduce what the artwork says, not a sentence of our own. The rule is
  in red.es's [Manual de identidad para digitalizadores](https://sede.red.gob.es/es/procedimientos/anuncio-de-adhesion-de-agentes-digitalizadores-al-programa-de-ayudas-para-la)
  (Enero 2024, pp. 18–19) and Orden HFP/1030/2021 art. 9.4, which forbids modifying the
  EU emblem. Measured consequence: the manual's 104×30px minimum for the Kit Digital
  logo needs a 630px strip, and a 360px phone gives it 328px — recorded, not "fixed" by
  re-cutting the artwork. Full audit (local KB): `docs/company/10-kit-digital.md`.

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

**One resizing pipeline, and it is Astro's (#323).** Every image that can be
resized goes through `<Image>` — EmDash's for CMS media, `astro:assets` for
anything imported from `src/assets/`. The adapter is configured
`imageService: { build: "compile", runtime: "cloudflare-binding" }`: sharp for
what the build can see, the `IMAGES` binding for what only exists at request
time. Hand-written `srcset` was considered and rejected; a site with two image
pipelines ends up maintaining neither.

Three things that decided the shape, all measured rather than assumed:

- **Not `imageService: "cloudflare"`.** That emits `/cdn-cgi/image/…` URLs,
  which are a **zone** feature. Both deploys live on `*.workers.dev`, where the
  original answers 200 and the transformed URL answers **404**. When the worker
  moves onto `serverstartup.io` (#162) with Transformations enabled, switching
  is one line in `astro.config.mjs` and no markup moves.
- **`image.remotePatterns` is not optional here.** The CMS points
  `featured_image` at static files under `public/assets/`, and EmDash hands
  Astro an absolute URL for them, which Astro treats as *remote* and passes
  through unless the host is allowed. Before the allow-list, the build emitted a
  `srcset` of nine identical URLs — one per width descriptor. The list is written
  host by host: a wildcard makes `/_image` an open proxy that resizes anything on
  the internet at our expense.
- **`<Image>` carries the SLOT's dimensions, not the file's.** Astro derives its
  width ladder from `width`, so a 1200px source in a 53px avatar produced a
  ladder starting at 640. Measure the slot per breakpoint (device emulation, not
  a bare window size) and let `sizes` say what the layout does.

A fourth thing, learned after the fact (#405). The adapter's `/_image`
endpoint caches its own output through `caches.default`, and `cache.put` runs
**before** the middleware. Two consequences that are easy to meet the hard way:
the cached copy never carries the §11 security headers, so the middleware has to
add them on the way out of a hit; and a response handed back by
`caches.default.match()` has **immutable** headers, so writing to it throws and
Astro answers 500 with an empty body. That is why `src/middleware.ts` collects
its headers and rebuilds the response instead of mutating in place. The failure
only appeared on the *second* request for a given image, and `curl -I` reported
200 on it, which is why `scripts/ci-check-headers.sh` now ends with a real GET,
issued twice.

A fifth, and the one that only Cloudflare could teach (#407). Because EmDash
hands Astro an **absolute** url for CMS media, the endpoint treats our own
static files as remote and fetches them over HTTP — and on the edge that fetch
is a Worker asking for its own hostname, which is refused. Measured on the
deployed preview worker: the subrequest returns `404 text/plain, 17 bytes`, the
`IMAGES` binding is handed an error string, and every image on the site answers
500. `wrangler dev` cannot show it, because there the same loopback is an
ordinary HTTP request that returns the real file.

Rewriting the href inside `src/middleware.ts` looks like the fix and is not:
`next(payload)` re-routes the request but never replaces the `Request` the
endpoint reads, so the rewrite is dead code — measured with simultaneous probes
in the middleware and the endpoint on the deployed worker, and shipped once
before that was known. The fix has to change what the **markup** asks for. So
`src/components/TeamPhoto.astro` picks the source per photograph: one the repo
carries goes through `astro:assets` (via a `import.meta.glob` of
`public/assets/team/`, so the files do not move and the CMS field keeps
resolving), which emits a `/_astro/…` **path** and puts the endpoint on its
`env.ASSETS.fetch()` branch with no subrequest at all; anything else falls to
EmDash's `<Image>`, which reads media-library bytes off the storage binding.
That second branch is the destination — #410 moves these photographs into the
media library, and then none of the first branch is needed.

That line is now held by a gate rather than by memory (#412).
`scripts/ci-check-image-hrefs.py` crawls the sitemap on the local stack and
fails on any `/_image` href that is an absolute URL. It reads the bytes rather
than the behaviour on purpose: locally the site *serves* those images perfectly,
which is exactly why the behavioural checks were green while #407 was live. Any
absolute href fails, foreign hosts included — the repository carries no
third-party image, so the rule closes by default and one is written down, with
a reason, in `scripts/image-remote-allowlist.txt`.

The lesson generalises past images: a Worker cannot reach itself, so anything
the site needs to read about its own content has to come from a binding, not
from its own URL.

Deliberately excluded: the Kit Digital strip in the footer. It is red.es's
artefact and the composition is not ours to re-cut (§4.1, #308).

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
- **Accessibility gate** (`scripts/ci-check-a11y.mjs`): axe-core over **every**
  audited route, plus the checks a rule engine cannot decide — keyboard
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
- **The axe list was a sample of ten until #387, and the reason is worth
  keeping.** Widening it surfaced four real `color-contrast` failures (WCAG
  1.4.3, eight nodes across both locales), and three of the greys belonged to
  the foreign chrome those instruments imitate — Google's BigQuery console and
  a javadoc page — inside the `token-guard: off` regions §10.10 describes.
  Raising them trades fidelity for contrast, which is not a gate's decision, so
  the failures were filed rather than fixed or suppressed, and the sample
  carried the four measurements in its comment. The founder's call (2026-08-25)
  was to raise all four to the smallest value that clears AA, on the reasoning
  that fidelity there meant reproducing an interface that fails AA itself:
  `#9aa0a6 → #6d7379` (2.50 → 4.55:1), `#b0b4b8 → #73777b` (2.09 → 4.51:1),
  `#4a524a → #7f877f` (2.08 → 4.54:1). The fourth was not foreign at all —
  `--color-text-muted` (#6B6B6B, 5.4:1 on paper) dressing the javadoc's own
  dark bar at 2.84:1. Ink at reduced weight has to **flip** on a dark ground,
  not merely dim, so `theme.css` gained `--color-text-muted-dark` (#8C8C8C) and
  `.inst--dark .inst__muted` consumes it. The audit is the full route list
  again; narrowing it to make a failure go away would drop routes nobody would
  then check, and the drop leaves no trace in a green run.
- **Every gate carries a positive control** (#385). A check that finds no
  problems and one that *cannot* find problems print the same green line, so
  each gate first plants the exact defect it hunts in a fixture it owns and
  refuses to report anything if it no longer finds it. Failure exits **3** and
  names which guard went blind, distinct from exit 1 (real findings). The
  fixtures live in temporary directories, in-memory strings and a
  `page.setContent` page — never in the repository tree, because a canary in
  the tree trips the very guard it is meant to prove (#347). Controls in
  place: citability (a planted name, and a name planted INSIDE a generated
  `.docx`), cache hints (must see the real call
  sites), design tokens (5 planted CSS defects + 3 shapes it must not flag),
  CMS text (hardcoded attribute, hardcoded text node, unseeded label key),
  security headers (a matcher run over present / absent / wrong-value
  responses), copy baseline (routes enumerate, `innerText` returns copy, the
  comparator catches a deleted line, a changed word and a truncation) and
  a11y (a link under a fixed header with its ring suppressed, a 720px block at
  320px, an `<img>` with no alt).
- **Public agent guide, private rules** (#325). `AGENTS.md` is the file a
  foreign agent opens by convention, and it is tracked — so it is published.
  It used to be generated output: an index of eleven paths into a private
  repository no clone receives, a glob table routing `worker/**`, `Dockerfile`
  and `application.properties` in a project with none of them, and a tracked
  `.claude/skills` symlink pointing outside the tree and therefore dangling on
  every clone. All three fail *silently* — an agent reading them loads nothing
  and gets no warning, the same failure mode worktrees have. `AGENTS.md` is now
  hand-owned public content: how to run the site, where the gate table is, and
  the rules that are not obvious from the code (content in the CMS, both
  languages, tokens from `theme.css`, one column, who may be named). The
  private index reaches the agent through `CLAUDE.md`, a real file that is not
  tracked. `tests/unit/agent-boundary.test.ts` keeps the boundary: no private
  path in `AGENTS.md`, every relative link resolved **against `git ls-files`
  rather than the disk** (the private directory exists on a maintainer's
  machine and nowhere else, so the working tree would answer "fine" for exactly
  the reader the test protects), and no tracked symlink escaping the
  repository. The generator that wrote the old file lives in the private repo
  and can overwrite this one from outside anything CI sees; the test is what
  turns that into a red build instead of a silent republication. `AGENTS.md`
  was not the only thing it wrote: the PR template asked every contributor to
  tick `npm run lint`, a script this project has never had, beside a row about
  a Cloudflare Worker build in a repository with no `worker/`. A checklist row
  nobody can satisfy gets ticked anyway. Both are now asserted generically —
  no tracked file may point *into* the private repository (naming the bare
  directory is allowed; explaining the `.agents/` rename requires it), and the
  template may name no npm script that `package.json` does not define.
- **Vendored, and named so** (#325). The EmDash starter's skill pack sat at
  `.agents/` — one character from the private `.agent/`, public where the other
  is private, tracked where the other is excluded, and referenced by nothing.
  It is now `vendor/emdash-skills/`, beside the other external code, with a
  README recording that it came from `cloudflare[bot]`'s import commit on
  2026-04-21 when EmDash was **0.6.0**, and has not been touched since. The
  project runs **0.34.0**, so that README says plainly which parts to distrust.
- **A stack that dies mid-run says so** (`scripts/lib/stack-probe.mjs`, #390).
  A `wrangler dev` session died in the middle of a gate run on 2026-08-25. Every
  guard reported honestly what it saw — a navigation timeout on one route, then
  `ERR_CONNECTION_REFUSED` — and every one of those messages points at the
  route, the guard, or the diff under test. None pointed at the stack, because
  none had looked, and ruling it out cost a full investigation. The guards now
  spend one HTTP request answering the question `copy-baseline` used to merely
  ask ("Is the stack up?"), and print wrangler's own last twelve log lines when
  the answer is no. It adds information and nothing else — no retry, no wider
  timeout, no changed exit code, because masking the crash would destroy the
  only signal that reveals it. Two things the break test taught that reading
  would not: a rejected **top-level `await`** in an entry module does not reach
  `unhandledRejection` (the a11y guard needs `uncaughtException` as well, or it
  still dies with a bare puppeteer trace), and a handler that prints only
  `error.message` trades one blind spot for another on every failure that is
  *not* a dead stack — so the trace stays. The crash itself remains open: #390
  can only close on a reproduction, and seven clean sessions the same day say
  it does not reproduce on demand.
- **Astro 7's agent endpoints, evaluated and split** (#367). Astro 7.2.4 ships
  `/_astro/status` and `astro dev --background`, and the parent issue asked
  whether either lets us delete hand-rolled work. Measured, not reasoned:
  `/_astro/status` answered 200 **6.2s** after start while `/` did not answer
  until **15.0s**, and its body is the constant `{"ok":true}` from a Vite
  middleware with no state behind it. It is a **liveness** probe, not a
  readiness one, and `scripts/ci-local-stack.sh` runs `wrangler dev` over the
  built output where Vite does not exist at all — so it is rejected twice over,
  and adopting it would have replaced a probe that knows when the site works
  with one that does not. `astro dev --background` is the opposite verdict:
  `astro dev status` and `astro dev stop` are a real lockfile-backed lifecycle
  (measured — `stop` freed the port), and they are what `stop_stack()`
  approximates in forty lines of `pkill`/`lsof` archaeology. They manage **astro
  dev** servers, though, and the CI stack is wrangler, so the win is for
  interactive agent sessions rather than for the gate run.
- **Blind exits 3, found exits 1 — in all seven guards** (#392). The
  convention was documented before it was uniform: five gates implemented it
  and `ci-check-cache-hints.py` and `ci-check-citability.py`, which came first,
  still returned 1 when they went blind. Nothing was unguarded — CI fails on
  any non-zero — but the two codes answer opposite questions, and a reader
  debugging a red step would go looking for a violation that was never found.
  Ten sites in the citability guard moved to 3; the three that report a real
  finding (an unaccounted opaque file, a forbidden name in the tree, a
  non-citable reference in the seed) stayed at 1. Every one of the twelve was
  exercised by breaking it — which turned out to be possible locally after all,
  the reason the issue was filed rather than fixed on the spot: the guard runs
  end to end under a **synthetic** `FORBIDDEN_NAMES` (three plain alternatives
  that appear nowhere in the tree), so its shape, its two positive controls and
  its scan are all reachable without the real secret. What a synthetic secret
  cannot check is that the real one still holds the real names, which the
  script's own comment already explains is uncheckable from inside CI.
- **The naming gate reads what grep skips** (`ci-check-citability.py`, #324).
  This repository is mirrored publicly and one guard decides who may be named
  in it (§13). `grep -I` stops at the first NUL byte and says nothing, which
  left 125 of 414 tracked files — around 30 MB, the whole `reference/` archive
  — outside it: a skipped file and a clean file produced the same green. The
  issue proved it the honest way, grepping a WordPress export for three words
  known to be inside it and getting zero. Two answers, in order. **Read what
  can be read**: OOXML documents are ZIP-of-XML, so the twelve exports are
  extracted with the standard library and scanned like text — including the
  legacy site's own clients-and-references page, which is exactly where a
  non-citable name would sit. **Account for the rest**: anything still opaque
  must match a glob in `scripts/citability-opaque.txt` *with a written reason*,
  and an unaccounted opaque file fails the build, so the blind spot cannot grow
  back quietly. The Figma renders are on that list with a measurement rather
  than an assumption — their type is converted to outlines, so a whole frame
  decodes to 29 ToUnicode CMap entries and no recoverable word. What survives
  in `reference/` at all is a separate decision (#324).
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

