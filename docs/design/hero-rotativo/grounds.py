# -*- coding: utf-8 -*-
"""The ground under the six drawings: a real photograph, pushed back.

The founder's brief, 2026-08-29: *"que NO pierda los dibujitos que teníamos
antes… usemos las fotos como background (sustituye al fondo negro con estrellas
ficticias de antes), pero de alguna forma tendrás que quitarles peso… Busca tb
que la imagen original no sólo sea del color objetivo sino que el dibujito
pudiera encajarle para ponerse ENCIMA."*

So the drawing is still the subject and the photograph is only the room it
hangs in. Three rules decided every choice below:

* **Source colour, not tint.** Each vertical's photograph was picked because it
  IS roughly that colour in the archive — measured, not eyeballed: the mean hue
  of every pixel, weighted by saturation, against the vertical's own token. The
  tint at the end is a nudge of 14-22%, not a duotone. A duotone would have made
  the source irrelevant, and the whole point of a NASA frame is that it is real.
* **Room for the drawing.** Each crop is chosen so the quarter where that
  plate's subject sits is the calm part of the photograph. `generate.py` also
  lays a soft dark bed under the subject; between the two, white line art reads
  over a nebula.
* **Pushed back, hard.** Blurred, darkened and desaturated at BUILD time, not
  in CSS. A defocused nebula is the one image that compresses almost to nothing:
  the treated files are ~10x lighter than the originals, so the visual decision
  and the performance decision are the same decision.

Green is the one honest problem. Deep sky has no green — the eye's response and
the filters observatories map to RGB conspire against it, and there is not one
green nebula in the archive. The only real green NASA photographs of space are
auroras seen from the ISS, so `gf` is an aurora crowning the Earth's limb with
the star field above it. It is a photograph taken in space, of space, and it is
green because the sky was green that night.

Credit, per NASA's terms: the images are public domain and free to use
commercially; what is required is attribution and what is forbidden is implying
endorsement. `CREDITS` below is rendered into the page colophon, not next to a
claim.

    python3 docs/design/hero-rotativo/grounds.py

Downloads the originals into `.cache/` (git-ignored) and writes the treated
`public/assets/hero/ground/*.jpg`, which ARE committed — the site never fetches
from NASA at runtime.
"""
import json, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(ROOT, "public", "assets", "hero", "ground")

# The plate is 1440x900. The ground is served at 720x450 and scaled up: it is
# already out of focus, so the second half of the pixels would encode nothing a
# viewer can see, and the upscale adds a little more softness for free.
W, H = 720, 450

# The composition rule, and the reason each crop is what it is: the DRAWING is
# the subject and the photograph is the room. Every plate puts its cube in the
# right-centre of the frame (ec 1008,350 · cdn 940,500 · bd 900,470 · int
# 900,470 · gf 980,560 · ia 940,470 in plate coordinates), so each crop pushes
# whatever the photograph's own subject is — the Helix ring, the Rosette, the
# Crab — into the LEFT of the frame, where the scrim eats it anyway, and leaves
# the right-centre as quiet field for the drawing to stand on.
#
#   zoom  how much larger than the frame the source is rendered before cropping
#   ax/ay where the crop window sits in that render, 0..1 (0 = left / top)
GROUNDS = {
    # key: (nasa_id, zoom, ax, ay, blur, brightness, saturation, tint, tint %)
    "ec":  ("PIA09178",                      1.90, 0.08, 0.44, 7,  96, 88, "#008FD3", 20),
    "int": ("GSFC_20171208_Archive_e002058", 1.15, 0.34, 0.28, 7, 128, 96, "#1D4E89", 18),
    "bd":  ("PIA09268",                      1.55, 0.10, 0.46, 5,  92, 90, "#EA4335", 16),
    "cdn": ("carina_nebula",                 1.30, 0.50, 0.26, 8,  70, 78, "#F38020", 18),
    "gf":  ("iss003e6130",                   1.38, 0.50, 0.10, 6, 165, 135, "#3E7D50", 14),
    "ia":  ("GSFC_20171208_Archive_e000053", 1.28, 0.72, 0.50, 7, 104, 86, "#6B4FBB", 20),
}

CREDITS = {
    "ec":  ("Helix Nebula (NGC 7293)", "NASA/JPL-Caltech/Univ. of Arizona"),
    "int": ("Mystic Mountain, Carina Nebula", "NASA, ESA, M. Livio and the Hubble 20th Anniversary Team (STScI)"),
    "bd":  ("Rosette Nebula", "NASA/JPL-Caltech/Univ. of Arizona"),
    "cdn": ("Cosmic Cliffs, NGC 3324 (Carina Nebula)", "NASA, ESA, CSA, STScI"),
    "gf":  ("Aurora over Earth's limb, ISS Expedition 3", "NASA"),
    "ia":  ("Crab Nebula (M1)", "NASA, ESA, J. Hester and A. Loll (Arizona State University)"),
}

def fetch(nid):
    p = os.path.join(CACHE, nid + ".jpg")
    if os.path.exists(p):
        return p
    os.makedirs(CACHE, exist_ok=True)
    for sz in ("large", "orig"):
        u = "https://images-assets.nasa.gov/image/%s/%s~%s.jpg" % (nid, nid, sz)
        try:
            urllib.request.urlretrieve(u, p)
            return p
        except Exception:
            continue
    raise SystemExit("could not fetch %s" % nid)

def treat(key):
    nid, zoom, ax, ay, blur, bright, sat, tint, pct = GROUNDS[key]
    src = fetch(nid)
    dst = os.path.join(OUT, key + ".jpg")
    sw, sh = [int(v) for v in subprocess.check_output(
        ["magick", "identify", "-format", "%w %h", src]).split()]
    # cover a frame `zoom` times the output, then take the window we want out
    # of it: that is the only way to put the photograph's own subject where the
    # drawing is not.
    scale = max(W * zoom / sw, H * zoom / sh)
    rw, rh = max(W, int(sw * scale + 0.5)), max(H, int(sh * scale + 0.5))
    ox, oy = int((rw - W) * ax), int((rh - H) * ay)
    subprocess.run([
        "magick", src,
        "-resize", "%dx%d!" % (rw, rh),
        "-crop", "%dx%d+%d+%d" % (W, H, ox, oy), "+repage",
        "-gaussian-blur", "0x%d" % blur,
        "-modulate", "%d,%d" % (bright, sat),
        "-fill", tint, "-colorize", "%d%%" % pct,
        # a JPEG of a defocused sky has no high frequencies left to protect
        "-sampling-factor", "4:2:0", "-strip", "-quality", "66",
        "-interlace", "Plane",
        dst,
    ], check=True)
    return dst

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key in GROUNDS:
        p = treat(key)
        n = os.path.getsize(p)
        total += n
        print("%-4s %5.1f KB  %-28s  %s" % (key, n / 1024.0, CREDITS[key][0], p))
    print("     %5.1f KB  total" % (total / 1024.0))
    json.dump(CREDITS, open(os.path.join(HERE, "grounds.json"), "w"),
              ensure_ascii=False, indent=1)
