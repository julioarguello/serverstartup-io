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

`frikitek/docx/` holds twelve WordPress exports whose markdown twins sit in the
directory above them. Measured 2026-08-25: every word inside those `.docx` also
appears in a plain-text file of this repository, so they carry nothing the
markdown does not — they are 2.5 MB of format, not of content. They are read by
the citability gate now (§ below); whether they should be here at all is #324.

### `docs/`

| File | Content |
|:-----|:--------|
| `history.md` | Brand origin story ("Server Startup in [2019] ms") |
| `logo.md` | Logo meaning (cube, Ocado hives, precision) |
| `ai-manifesto.txt` | Strategic AI manifesto — business model, roles, pricing (17KB) |
| `boutique-consulting.txt` | Definition of a boutique systems integration consultancy |

> Four further documents were removed from this archive in #160 because they
> were company-internal. Their entries stayed in this table for three months,
> on a repository that is mirrored publicly — an index describing internal
> documents, with no way for a reader to tell they were gone, which is worse
> than the files themselves would have been. They are named here by count and
> not by title on purpose. If you need them, they are in the private knowledge
> base, not in this tree.

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

> **See:** `CONTRIBUTING.md` for the dev stack and the seed procedure, and
> `docs/architecture.md` for how content reaches the CMS.

## Provenance

- **Source repo:** `github.com/julioarguello/serverstartup.io` (commit `817f097`)
- **Migration date:** 2026-05-01
- **Migration issue:** #139

## Why this directory is readable by the naming gate

Nothing here builds, tests or deploys the site; it is an archive. But it is a
**public** archive, and until #324 about 30 MB of it — every image, every
document, both Figma files — sat outside `scripts/ci-check-citability.py`,
which is the only gate on who may be named in this repository (§13 of the
project rules). `grep -I` stops at the first NUL byte and reports nothing, so
a skipped file and a clean file produced the same green.

Now the twelve `.docx` are extracted and scanned like any text file, and every
remaining unreadable file is listed with a reason in
`scripts/citability-opaque.txt`. A new one that nobody accounts for fails the
build. What survives in this directory at all is still open — see #324.
