# Legacy Content — `serverstartup.io`

Source material migrated from `julioarguello/serverstartup.io` (private, to be archived).

This content serves as **reference** for creating `seed/content/` files — it should NOT be loaded into the CMS directly. Use the `emdash-ops` content loader pattern to transform relevant material into properly formatted markdown with YAML frontmatter.

## Structure

### `pages/`

Two versions of the site content created during the initial branding process:

| Directory | Author | Purpose |
|:----------|:-------|:--------|
| `frikitek/` | Frikitek (web agency) | Original agency drafts — WordPress exports + markdown |
| `serverstartup/` | Server Startup (boutique rewrite) | Final versions with technical/boutique tone |

The `serverstartup/` versions are the canonical source for CMS content enrichment.

### `docs/`

| File | Content |
|:-----|:--------|
| `history.md` | Brand origin story ("Server Startup in [2019] ms") |
| `logo.md` | Logo meaning (cube, Ocado hives, precision) |
| `ai-manifesto.txt` | Strategic AI manifesto — business model, roles, pricing (17KB) |
| `boutique-consulting.txt` | Definition of a boutique systems integration consultancy |
| `business-profile.txt` | Company activity summary (from Gmail analysis) |
| `gdrive-structure.txt` | Corporate Google Drive organization |
| `projects-alcampo.csv` | Portfolio of Alcampo projects |
| `brief-agencia-web.pdf` | Original web agency brief (Frikitek) |

### `media/`

| Directory | Content |
|:----------|:--------|
| `logo/` | Logo files (PNG, SVG, Excalidraw, MP4 animations) |
| `assets/areas/` | Architectural sketches per service area + AI prompts used to generate them |
| `assets/history/` | Historical logo versions |

> **Note:** `src/media/misc/` (~115MB of slideshow videos) was NOT migrated — too large for git. Available in the original repo if needed.

### `agent/`

Legacy Antigravity skills and workflows from the old repo:

| File | Content |
|:-----|:--------|
| `boutique-copywriter.md` | Brand voice & tone guide (Tech Lead / Conference Speaker style) |
| `richin13-writing-style.md` | Additional writing style reference |
| `boutique-rewrite-workflow.md` | Workflow for rewriting agency content with boutique tone |
| `style-feedback.md` | Style feedback log (lessons learned about tone) |

## Usage

To create new `seed/content/` files from this material:

1. Read the relevant `pages/serverstartup/*.md` file for the target page/collection
2. Extract the content into `seed/content/<collection>/<locale>/<slug>.md` format
3. Add YAML frontmatter with the CMS entry `id` (from `npx emdash content list`)
4. Run `./scripts/load-content.sh <collection>` to push to CMS

> **See:** `.agent/skills/emdash-ops/SKILL.md` for the full Content as Code workflow.

## Provenance

- **Source repo:** `github.com/julioarguello/serverstartup.io` (commit `817f097`)
- **Migration date:** 2026-05-01
- **Migration issue:** #139
