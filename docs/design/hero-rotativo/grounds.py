# -*- coding: utf-8 -*-
"""The ground under the six drawings: a real photograph, matched to the drawing.

Three rounds of the founder's brief are baked into this file, in order.

*"Que NO pierda los dibujitos… usemos las fotos como background… pero tendrás
que quitarles peso."* (2026-08-29) — so the drawing is still the subject and the
photograph is only the room it hangs in.

*"Están muy disimulados… lo ideal sería que las imágenes encajasen con las
figuras actuales, por color y por contenido… si nuestra figura se mimetizase con
lo expresado por la imagen sería la caña."* (2026-08-30) — a photograph chosen
for its measured hue and nothing else reads as a blur, because there is nothing
in it to recognise. Every source below was chosen because it SAYS what its
drawing says, and every crop is then SOLVED so that it does.

*"Las veo muy desenfocadas… ¿no se puede conseguir también con el color?"* — the
defocus is gone and the colour is reached by subtraction. See the two sections
below.

## The crop is solved, not composed

Each entry names a FEATURE — a point in the source, measured off a luminance
grid — and the point in the 720x450 ground where that feature has to land. The
crop offset is then arithmetic, and all six land with zero pixels of drift:

* `ec` the core of a globular cluster, under the one lit cube of the wall
* `int` the jet of HH 34, turned 53 degrees until it runs along the drawn clean
  path out of the cube
* `bd` a real galaxy of the eXtreme Deep Field, inside the crosshair that marks
  the outlier
* `cdn` Saturn's limb, tangent to the drawn globe's own limb
* `gf` the Earth's limb at orbital sunrise, as the empty plane the first voxel
  stands on
* `ia` RS Puppis, a star lighting the cloud it sits in, inside the cube that is
  lit from within

## Weight, colour and focus, all by subtraction

* **No blur.** The defocus was how the first version took weight off the
  photograph; it did that by making it unreadable. The crop and the scrim carry
  that job now: the picture is quiet because it is dark and because its own
  subject hides under the drawing.
* **Colour without rotating hue.** Rotating a photograph's hue onto the token
  turns a cluster's stars pink and an aurora red. Chroma is dropped to ~55% and
  a colorize of 30-38% carries the rest, which never moves a pixel's luminance.
  Measured, saturation-weighted mean hue against each token: ec 201.1 vs 199.3,
  int 213.5 vs 212.8, bd 3.8 vs 4.6, cdn 27.6 vs 27.3, gf 150.1 vs 137.1, ia
  263.7 vs 255.6. `gf` is the one that misses: an aurora is the green the sky
  was that night, not the green in theme.css.
* **Resolution is not free any more.** A blurred ground could be 720x450 because
  it carried no detail above a few cycles. A sharp one cannot: the band is
  full-bleed, so a 1706 px viewport at DPR 2 paints 3412 device pixels. The
  shipped ground is AVIF at 2160x1350 — nine times the pixels of the old file
  for a quarter more weight — with the 720 JPEG under it in a <picture> for the
  browsers that cannot read AVIF.

Green is the one honest problem. Deep sky has no green — the eye's response and
the filters observatories map to RGB conspire against it, and there is not one
green nebula in the archive. The only real green NASA photographs of space are
auroras seen from the ISS, so `gf` is an aurora over the Earth's limb. It is a
photograph taken in space, of space, and it is green because the sky was green
that night. It also happens to be the right picture: a limb is what an empty
plane looks like from orbit.

Credit, per NASA's terms: the images are public domain and free to use
commercially; what is required is attribution and what is forbidden is implying
endorsement. `CREDITS` below is rendered into the page colophon, not next to a
claim.

    python3 docs/design/hero-rotativo/grounds.py

Downloads the originals into `.cache/` (git-ignored) and writes the treated
`public/assets/hero/ground/*.{avif,jpg}`, which ARE committed — the site never
fetches from NASA at runtime. Needs ImageMagick with AVIF support (`magick
-list format | grep AVIF`).
"""
import json, os, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(ROOT, "public", "assets", "hero", "ground")

# The composition is authored at 720x450 — half the plate, and the coordinate
# space every FEATURE target below is written in. What ships is that same
# composition at 3x as AVIF, plus the 1x JPEG as the <picture> fallback.
W, H = 720, 450
SHIP = ((3, "avif", 40), (1, "jpg", 72))

# key: (nasa id, rotation, zoom, feature (fx, fy) in the rotated source,
#       where that feature must land in the 720x450 ground,
#       brightness, saturation, tint, colorize %)
#
#   rotation  degrees, clockwise. There is no up in space; `int` is turned so
#             the real jet runs along the path the drawing already drew.
#   zoom      how much larger than the frame the source is rendered before the
#             crop. It is bounded from below by the anchor: too small and the
#             feature cannot reach its target without the window leaving the
#             image. Every value here is the smallest that clears it.
#   brightness  chosen against a measurement, not a look. The a11y gate takes
#             the 98th percentile of background luminance behind every text
#             box; ec is 44 rather than 118 because a globular cluster is far
#             brighter than the nebula it replaced.
GROUNDS = {
    "ec":  ("GSFC_20171208_Archive_e000722",   0, 1.60, (0.547, 0.532), (504, 175),  44, 50, "#008FD3", 38),
    "int": ("GSFC_20171208_Archive_e001708", -53, 2.10, (0.500, 0.435), (380, 225), 140, 55, "#1D4E89", 36),
    "bd":  ("GSFC_20171208_Archive_e001651",   0, 1.60, (0.734, 0.537), (650, 382), 135, 52, "#EA4335", 36),
    "cdn": ("PIA08351",                        0, 1.35, (0.855, 0.520), (595, 250),  92, 48, "#F38020", 30),
    "gf":  ("iss023e057948",                   0, 1.45, (0.550, 0.600), (490, 300), 128, 57, "#3E7D50", 34),
    "ia":  ("GSFC_20171208_Archive_e001283",   0, 1.55, (0.516, 0.466), (470, 235),  78, 57, "#6B4FBB", 34),
}

CREDITS = {
    "ec":  ("A globular cluster losing stars to its own tides",
            "NASA, ESA and the Hubble Heritage Team (STScI/AURA)"),
    "int": ("HH 34, a Herbig-Haro jet", "NASA, ESA and the Hubble Heritage Team (STScI/AURA)"),
    "bd":  ("The Hubble eXtreme Deep Field",
            "NASA, ESA, G. Illingworth, D. Magee, P. Oesch, R. Bouwens and the HUDF09 Team"),
    "cdn": ("Saturn's limb and rings, Cassini", "NASA/JPL/Space Science Institute"),
    "gf":  ("The Earth's limb at orbital sunrise, ISS Expedition 23", "NASA"),
    "ia":  ("RS Puppis, a star lighting the cloud it sits in",
            "NASA, ESA and the Hubble Heritage Team (STScI/AURA)-Hubble/Europe Collaboration"),
}


def fetch(nid):
    """The archive original, not the `large` derivative: resolution is the
    ceiling now, and three of these six have twice the pixels in `orig`."""
    p = os.path.join(CACHE, nid + ".jpg")
    if os.path.exists(p):
        return p
    os.makedirs(CACHE, exist_ok=True)
    for sz in ("orig", "large"):
        u = "https://images-assets.nasa.gov/image/%s/%s~%s.jpg" % (nid, nid, sz)
        try:
            urllib.request.urlretrieve(u, p)
            return p
        except Exception:
            continue
    raise SystemExit("could not fetch %s" % nid)


def source(key):
    """The image the crop is solved against — rotated first, if it is turned,
    because a rotation changes both the frame and where the feature is in it."""
    nid, rot = GROUNDS[key][0], GROUNDS[key][1]
    src = fetch(nid)
    if not rot:
        return src
    dst = os.path.join(CACHE, "%s.rot%d.jpg" % (nid, rot))
    if not os.path.exists(dst):
        subprocess.run(["magick", src, "-background", "black", "-rotate", str(rot),
                        "+repage", "-quality", "96", dst], check=True)
    return dst


def treat(key, scale, fmt, quality):
    _, _, zoom, (fx, fy), (tx, ty), bright, sat, tint, pct = GROUNDS[key]
    src = source(key)
    w, h = int(W * scale), int(H * scale)
    sw, sh = [int(v) for v in subprocess.check_output(
        ["magick", "identify", "-format", "%w %h", src]).split()]
    # cover a frame `zoom` times the output, then slide the window until the
    # feature sits on its target. The clamp is a guard, not a knob: if it ever
    # bites, the zoom for that face is too small and the anchor has moved.
    s = max(w * zoom / sw, h * zoom / sh)
    rw, rh = max(w, int(sw * s + 0.5)), max(h, int(sh * s + 0.5))
    ox = int(round(min(max(fx * rw - tx * scale, 0), rw - w)))
    oy = int(round(min(max(fy * rh - ty * scale, 0), rh - h)))
    drift = max(abs(ox - (fx * rw - tx * scale)), abs(oy - (fy * rh - ty * scale)))
    dst = os.path.join(OUT, "%s.%s" % (key, fmt))
    cmd = ["magick", src,
           "-resize", "%dx%d!" % (rw, rh),
           "-crop", "%dx%d+%d+%d" % (w, h, ox, oy), "+repage",
           # luminance untouched: the colour is reached by taking chroma out,
           # never by rotating hue, which recolours what the photograph shows
           "-modulate", "%d,%d" % (bright, sat),
           "-fill", tint, "-colorize", "%d%%" % pct,
           "-strip", "-quality", str(quality)]
    if fmt == "jpg":
        cmd += ["-sampling-factor", "4:2:0", "-interlace", "Plane"]
    subprocess.run(cmd + [dst], check=True)
    return dst, drift


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for scale, fmt, quality in SHIP:
        total = 0
        for key in GROUNDS:
            p, drift = treat(key, scale, fmt, quality)
            n = os.path.getsize(p)
            total += n
            print("%-4s %4s %5.1f KB  drift %.0f px  %s"
                  % (key, fmt, n / 1024.0, drift, CREDITS[key][0]))
        print("     %4s %5.1f KB  total at %dx (%dx%d)"
              % (fmt, total / 1024.0, scale, W * scale, H * scale))
    json.dump(CREDITS, open(os.path.join(HERE, "grounds.json"), "w"),
              ensure_ascii=False, indent=1)
