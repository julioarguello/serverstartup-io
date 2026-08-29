# The rotating hero — the six plates

Six drawn images, one per vertical, behind the home's headline and at the top of each
vertical's own page (#413). They are the **same object** in all six: the brand cube. What
changes is what each trade does to it.

| Face | Vertical | Colour | What happens to the cube |
| --- | --- | --- | --- |
| `ec` | Comercio electrónico | `#008FD3` | Repeated into a wall; one is lit — the order among a million |
| `int` | Integración de sistemas | `#1D4E89` | Pierced — the tangle goes in, one clean path comes out |
| `bd` | Big Data & Cloud Analytics | `#EA4335` | Drawn out of a point cloud; the crosshair marks the outlier |
| `cdn` | CDN, WAF y seguridad edge | `#F38020` | Wrapped around the world; its six vertices are the nodes, the limb is the edge |
| `gf` | Desarrollo greenfield | `#3E7D50` | Being built on an empty plane; exactly one voxel is placed |
| `ia` | Inteligencia artificial | `#6B4FBB` | Lit from the inside, vertex to vertex |

**The drawing is the subject; the photograph is the room.** Each plate is two files — a
transparent SVG drawing and, under it, a real NASA frame. Stock photography would have swapped
a distinctive identity for a generic one, and it still would; what a NASA image gives instead
is a ground no competitor can buy and nobody has to license.

## The ground is a photograph now

The six used to invent their own sky: a vignette, three cloud lobes, seven hundred drawn stars
and a dozen diffraction flares per plate. The founder killed it twice — first as *"un fondo
negro con puntitos blancos"*, and then, when a real star catalogue replaced the invented one,
as *"lo veo muy aburrido, a la mierda… me parece bien que haya una base real, real real, es
decir con una imagen de la NASA y NO generada por computador"*. He was right both times: a
drawing of a sky under a drawing is two drawings, and the second one always loses.

So `sky()` now returns nothing but its defs, and under each plate sits a photograph from
NASA's public archive, prepared by [`grounds.py`](grounds.py). Three rules chose them:

- **Source colour, not tint.** Each vertical's photograph was picked because it already IS
  roughly that colour in the archive — the mean hue of every pixel, weighted by saturation,
  measured against the vertical's own token, not eyeballed. The tint at the end is a nudge of
  14-20%, not a duotone: a duotone would have made the source irrelevant, and the whole point
  of a NASA frame is that it is real. The founder's words: *"que la imagen original no sólo sea
  del color objetivo"*.
- **Room for the drawing.** *"Que el dibujito pudiera encajarle para ponerse ENCIMA del real."*
  Every plate puts its cube in the right-centre of the frame, so every crop pushes the
  photograph's own subject — the Helix ring, the Rosette, the Crab — into the LEFT, where the
  scrim eats it anyway, and leaves the right-centre as quiet field. The crop windows in
  `GROUNDS` are that arithmetic, not taste.
- **Pushed back, hard.** *"Tendrás que quitarles peso mediante capas que difuminen."* Blurred,
  darkened and desaturated at BUILD time, never in CSS — a `filter: blur()` on a full-bleed
  element is a composite the GPU pays for on every frame of the cross-fade. And a defocused sky
  is the one image a JPEG can almost not encode: **the six grounds together are 58 KB**, less
  than the six drawings that sit on them. The visual decision and the performance decision
  turned out to be the same decision.

| Face | Photograph | Credit |
| --- | --- | --- |
| `ec` | Helix Nebula (NGC 7293) | NASA/JPL-Caltech/Univ. of Arizona |
| `int` | Mystic Mountain, Carina Nebula | NASA, ESA, M. Livio and the Hubble 20th Anniversary Team (STScI) |
| `bd` | Rosette Nebula | NASA/JPL-Caltech/Univ. of Arizona |
| `cdn` | Cosmic Cliffs, NGC 3324 | NASA, ESA, CSA, STScI |
| `gf` | Aurora over Earth's limb, ISS Expedition 3 | NASA |
| `ia` | Crab Nebula (M1) | NASA, ESA, J. Hester and A. Loll (Arizona State University) |

**Green is the one honest problem.** Deep sky has no green: the eye's response and the filters
observatories map to RGB conspire against it, and there is not one green nebula in the archive.
The only real green NASA photographs of space are auroras seen from the ISS, so `gf` is an
aurora crowning the Earth's limb with the star field above it — a photograph taken in space, of
space, green because the sky was green that night. It also happens to be the right picture: the
plate draws an empty plane with the first voxel placed on it, and a limb is what an empty plane
looks like from orbit.

**The drawing keeps its own bed.** A 1.4px stroke at 0.3 opacity reads over brand ink and
disappears over the Rosette, so each plate lays a soft out-of-focus ellipse of `#1E1E1E` under
its own subject before drawing it (`bed()` in `generate.py`). The photograph stays a photograph
at the edges of the frame and gives way exactly where the drawing has to be read — the same job
the scrim does for the headline, done for the picture. It is what lets the grounds stay as
bright and as coloured as they are.

**Licensing.** NASA imagery is public domain and free for commercial use. The conditions are
attribution — the table above — and no implied endorsement, which is why the credits belong in
the colophon and never beside a claim about the company.

## The subject still lives in the right half

**The body lives in the right half of the frame.** That is a composition rule, not a
preference: the scrim darkens the left because the copy is there, so a world on the left is a
world nobody sees — and on a phone, where the plate is cropped to `object-position: 72%`, it
is cropped away entirely. `ec`, `int` and `bd` were drawn left first and moved.

**Every subject sits inside `y` 150-760**, and that is a hard constraint rather than a
composition choice. The band is `min-height: 100svh` with `object-fit: cover`, so any viewport
that is not 3:2 crops the plate top and bottom — 112px each at 1920x860, 100px at 1440x700.

## Regenerating them

```sh
python3 docs/design/hero-rotativo/generate.py   # the drawings
python3 docs/design/hero-rotativo/grounds.py    # the photographs under them
```

`generate.py` writes `public/assets/hero/{ec,int,bd,cdn,gf,ia}.svg` — the transparent drawings
the site serves — plus `public/assets/menu/ground.svg` (the menu panel's ground: the same cube
lattice, no stars and no subject, #417) and `images.json` next to itself for the design canvas.
The RNG is seeded, so a re-run reproduces the same bytes; change composition **here**, never by
hand-editing an SVG. Setting `PHOTO_GROUND = False` brings the old self-contained plates back —
the drawings themselves never changed.

`grounds.py` downloads the originals into a git-ignored `.cache/` and writes
`public/assets/hero/ground/*.jpg`, which ARE committed: the site never fetches from NASA at
runtime. It needs ImageMagick (`magick`) on the path.

The plates carry no `role`, no `aria-label` and no `<title>`: they are decorative. The `<img>`
that shows them has `alt=""` and the vertical's name sits beside it as a real link — a label in
the file would be locale-bound copy living outside the CMS, and it would announce the picture
twice.

All six drawings together are ~60 KB gzipped (`bd` is the outlier — it is ~4,000 circles) and
the six photographs add **58 KB** for all of them. Dropping the invented sky paid for most of
the photograph: the plates lost seven hundred circles and twelve flare filters each. Six slides,
two layers apiece and a pure-CSS cross-fade still cost less than the one stock photograph they
replace, with no JavaScript involved.

## Where the code is

| Piece | File |
| --- | --- |
| Face → file map | [`src/utils/hero-art.ts`](../../../src/utils/hero-art.ts) |
| The home's rotation | [`src/components/HomepageContent.astro`](../../../src/components/HomepageContent.astro), [`src/styles/homepage.css`](../../../src/styles/homepage.css) |
| The vertical page's still plate | [`src/pages/[slug].astro`](../../../src/pages/%5Bslug%5D.astro), [`src/styles/service.css`](../../../src/styles/service.css) |
| The photographic ground | [`grounds.py`](grounds.py); `.s-hero__ground` in [`homepage.css`](../../../src/styles/homepage.css) and [`service.css`](../../../src/styles/service.css) |
| The bed under each subject | `bed()` in [`generate.py`](generate.py) |
| Face -> ground file map | [`src/utils/hero-art.ts`](../../../src/utils/hero-art.ts) |
| The bar over the picture | [`src/components/SiteHeader.astro`](../../../src/components/SiteHeader.astro) |
| Scrim, ink and clock tokens | [`src/styles/theme.css`](../../../src/styles/theme.css) |
| The gate that measures ink over the plates | [`scripts/ci-check-a11y.mjs`](../../../scripts/ci-check-a11y.mjs) §5 |

## Previews

Captures of the built site, not mockups.

![The home](previews/home.jpg)

![A vertical page](previews/pagina-vertical.jpg)

![The home at 390 px](previews/movil.jpg)
