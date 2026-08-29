# -*- coding: utf-8 -*-
"""Las seis imágenes sobre TINTA DE MARCA (#1E1E1E), no negro puro. Mismo objeto en las
seis; lo que cambia es lo que cada vertical le hace. viewBox 0 0 1440 900."""
import random, json, math

W, H = 1440, 900
GROUND = "#1E1E1E"

# The ground under the drawing is a real NASA photograph, defocused and pushed
# back by `grounds.py`, not a sky this file invents. The founder, 2026-08-29:
# *"que NO pierda los dibujitos que teníamos antes… usemos las fotos como
# background (sustituye al fondo negro con estrellas ficticias de antes), pero
# de alguna forma tendrás que quitarles peso… que el dibujito pudiera encajarle
# para ponerse ENCIMA del real."* So the plates are TRANSPARENT now: the
# subject and its bed, and nothing underneath them. Set this False to get the
# old self-contained plates back — the drawings themselves never changed.
PHOTO_GROUND = True
VERTS = [(100, 14), (186, 64), (186, 164), (100, 214), (14, 164), (14, 64)]
HINT = [((57, 39), (143, 89)), ((143, 39), (57, 89)), ((57, 89), (57, 189)),
        ((14, 114), (100, 164)), ((143, 89), (143, 189)), ((100, 164), (186, 114))]
FACES = {"top": [(100, 14), (186, 64), (100, 114), (14, 64)],
         "left": [(14, 64), (100, 114), (100, 214), (14, 164)],
         "right": [(100, 114), (186, 64), (186, 164), (100, 214)]}

def M(cx, cy, k):
    return lambda x, y: (cx + (x - 100) * k, cy + (y - 114) * k)

def d_poly(pts, close=True):
    s = "M%.1f %.1f " % pts[0] + " ".join("L%.1f %.1f" % p for p in pts[1:])
    return s + (" Z" if close else "")

def cube(cx, cy, k, stroke="#fff", op=0.32, w=1.4, hint=True, cross=True, dash=None):
    p = M(cx, cy, k)
    da = ' stroke-dasharray="%s"' % dash if dash else ''
    out = ['<g fill="none" stroke="%s" stroke-opacity="%.2f" stroke-width="%.1f" stroke-linejoin="round" stroke-linecap="round"%s>' % (stroke, op, w, da)]
    out.append('<path d="%s"></path>' % d_poly([p(*v) for v in VERTS]))
    if cross:
        out.append('<path d="%s"></path>' % d_poly([p(14, 64), p(100, 114), p(186, 64)], False))
        out.append('<path d="%s"></path>' % d_poly([p(100, 114), p(100, 214)], False))
    if hint:
        for a, b in HINT:
            out.append('<path d="%s"></path>' % d_poly([p(*a), p(*b)], False))
    out.append('</g>')
    return "".join(out)

def cube_solid(cx, cy, k, color):
    p = M(cx, cy, k)
    o = []
    for f, a in (("top", 1.0), ("left", 0.86), ("right", 0.66)):
        o.append('<polygon points="%s" fill="%s" fill-opacity="%.2f"></polygon>'
                 % (" ".join("%.1f,%.1f" % p(*v) for v in FACES[f]), color, a))
    return "".join(o)

def glow(fid, blur=22):
    return ('<filter id="%s" x="-70%%" y="-70%%" width="240%%" height="240%%">'
            '<feGaussianBlur stdDeviation="%d"></feGaussianBlur></filter>' % (fid, blur))

def bed(key, cx, cy, rx, ry, op=0.62):
    """A soft dark bed under the subject, so line art survives a nebula.

    A 1.4px stroke at 0.3 opacity reads over brand ink and disappears over the
    Rosette. So each plate lays an out-of-focus ellipse of ink under its OWN
    subject before drawing it: the photograph stays a photograph at the edges
    of the frame and gives way exactly where the drawing has to be read. It is
    the same job the scrim does for the headline, done for the picture — and it
    is what lets the grounds stay as bright and as coloured as they are.
    """
    return ('<defs><radialGradient id="bed%s">'
            '<stop offset="0%%" stop-color="#1E1E1E" stop-opacity="%.2f"></stop>'
            '<stop offset="52%%" stop-color="#1E1E1E" stop-opacity="%.2f"></stop>'
            '<stop offset="100%%" stop-color="#1E1E1E" stop-opacity="0"></stop>'
            '</radialGradient></defs>'
            '<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="url(#bed%s)"></ellipse>'
            % (key, op, op * 0.52, cx, cy, rx, ry, key))


def _r(v):
    """`0.4` -> "0.4", `1.0` -> "1". Naive rstrip turns "0.4" into "0"."""
    t = "%.1f" % v
    return t[:-2] if t.endswith(".0") else t

def nebula(key, rng, hue, lo, hi):
    """Cloud, not dust.

    The first version washed the frame with white at 0.06 opacity, which is
    below the threshold at which anything reads as anything: the founder saw
    "un fondo negro con puntitos blancos", and he was describing the file
    accurately. A star field alone does not say space — every dark page with
    specks on it looks like this. What says space is CLOUD: coloured, uneven,
    with lobes that overlap and edges you cannot find.

    Three lobes, two in the vertical's own hue and one cold neutral, at
    opacities you can actually see (0.10-0.20). They go down before the stars,
    so the field sits inside the cloud instead of on top of it.
    """
    o = ['<defs>']
    lobes = []
    for i, (col, op, rx, ry) in enumerate((
            (hue, 0.20, 760, 300),
            (hue, 0.12, 520, 380),
            ("#8FA6C8", 0.10, 640, 260))):
        o.append('<radialGradient id="nb%s%d">'
                 '<stop offset="0%%" stop-color="%s" stop-opacity="%.2f"></stop>'
                 '<stop offset="55%%" stop-color="%s" stop-opacity="%.2f"></stop>'
                 '<stop offset="100%%" stop-color="%s" stop-opacity="0"></stop>'
                 '</radialGradient>' % (key, i, col, op, col, op * 0.42, col))
        cx = rng.uniform(0.12, 0.88) * W
        cy = lo + rng.uniform(0.15, 0.85) * (hi - lo)
        lobes.append((i, cx, cy, rx * rng.uniform(0.8, 1.15),
                      min(ry, max(90, (hi - lo) * 0.55)) * rng.uniform(0.8, 1.15),
                      rng.uniform(-40, 40)))
    o.append('</defs>')
    for i, cx, cy, rx, ry, rot in lobes:
        o.append('<ellipse cx="%.0f" cy="%.0f" rx="%.0f" ry="%.0f" fill="url(#nb%s%d)" '
                 'transform="rotate(%.0f %.0f %.0f)"></ellipse>'
                 % (cx, cy, rx, ry, key, i, rot, cx, cy))
    return "".join(o)


def body(key, cx, cy, r, hue, lit=(28, 24), rings=3, atmos=True):
    """A world in the frame.

    This is the single thing that separates the one plate that reads as space
    from the five that do not. `cdn` has a planet as its subject and nobody
    has to be told what they are looking at; the other five are diagrams on a
    speckled ground, and no number of stars fixes that. A body gives the two
    things a star field cannot: MASS, because it occludes the stars behind it,
    and SCALE, because a curve that runs off the edge of the frame can only be
    something enormous.

    Drawn as: the dark mass, a lit limb from `lit` (the direction the light
    comes from, in percent), a few surface bands clipped to the sphere, and a
    thin atmosphere outside the edge. All of it stays dark — this is the
    BACKGROUND of a plate whose subject is the cube, and a bright planet would
    take the picture over.
    """
    lx, ly = lit
    o = ['<defs><radialGradient id="bd%s" cx="%d%%" cy="%d%%" r="76%%">'
         '<stop offset="0%%" stop-color="%s" stop-opacity="0.42"></stop>'
         '<stop offset="38%%" stop-color="%s" stop-opacity="0.13"></stop>'
         '<stop offset="100%%" stop-color="%s" stop-opacity="0"></stop>'
         '</radialGradient>'
         '<clipPath id="bc%s"><circle cx="%.0f" cy="%.0f" r="%.0f"></circle></clipPath>'
         '<filter id="ba%s" x="-40%%" y="-40%%" width="180%%" height="180%%">'
         '<feGaussianBlur stdDeviation="9"></feGaussianBlur></filter></defs>'
         % (key, lx, ly, hue, hue, hue, key, cx, cy, r, key)]
    if atmos:
        o.append('<circle cx="%.0f" cy="%.0f" r="%.0f" fill="none" stroke="%s" '
                 'stroke-opacity="0.30" stroke-width="7" filter="url(#ba%s)"></circle>'
                 % (cx, cy, r + 3, hue, key))
    # the mass. #0A0B0C, not the ground: a body has to be DARKER than the sky
    # it hangs in, or it is a hole rather than a planet.
    o.append('<circle cx="%.0f" cy="%.0f" r="%.0f" fill="#0A0B0C"></circle>' % (cx, cy, r))
    o.append('<circle cx="%.0f" cy="%.0f" r="%.0f" fill="url(#bd%s)"></circle>' % (cx, cy, r, key))
    if rings:
        o.append('<g clip-path="url(#bc%s)" fill="none" stroke="%s" stroke-opacity="0.10">' % (key, hue))
        for i in range(rings):
            f = -0.55 + 1.10 * (i + 0.5) / rings
            o.append('<ellipse cx="%.0f" cy="%.0f" rx="%.0f" ry="%.0f" stroke-width="1.2"></ellipse>'
                     % (cx, cy + f * r, r * 0.99, r * 0.30 * (1 - abs(f) * 0.5)))
        o.append('</g>')
    # the limb: the lit edge, brightest on the side the light is on
    o.append('<circle cx="%.0f" cy="%.0f" r="%.0f" fill="none" stroke="%s" '
             'stroke-opacity="0.55" stroke-width="1.6"></circle>' % (cx, cy, r, hue))
    return "".join(o)


def sky(key, seed, n=720, yr=(0, H), flares=12, dust=True, hue="#8FA6C8", band=True):
    """The ground is DEEP SKY, not grey with specks in it (founder, 2026-08-27:
    "asegúrate de que se note que estamos en el cielo").

    Three things make a field read as sky instead of noise, and the first
    version had none of them:

    * **Magnitudes.** Many faint, some middling, a few bright. A field of
      equal dots reads as texture.
    * **Diffraction spikes** on the brightest ones. The tapered cross is the
      gesture the eye files under "star"; without it a bright dot is a dot.
    * **Dust.** Two long, almost imperceptible washes across the frame, so the
      ground is not a flat grey the stars sit on top of.

    Stars are grouped into twelve opacity buckets, which drops each circle to
    ~30 bytes and compresses the whole field to about 2 KB. Without that,
    six skies of ~700 stars would double the folder.

    `seed` is the sky's OWN generator on purpose: the subjects were approved
    as they are, and sharing a stream would redraw them every time a star
    count changes.
    """
    rng = random.Random(seed)
    lo, hi = yr
    span = hi - lo
    o = ['<defs><radialGradient id="vig%s" cx="50%%" cy="46%%" r="72%%">'
         '<stop offset="0%%" stop-color="#242424"></stop>'
         '<stop offset="100%%" stop-color="#141414"></stop></radialGradient>'
         '<radialGradient id="dust%s" cx="50%%" cy="50%%" r="50%%">'
         '<stop offset="0%%" stop-color="#FFFFFF" stop-opacity="0.06"></stop>'
         '<stop offset="100%%" stop-color="#FFFFFF" stop-opacity="0"></stop></radialGradient>'
         '<linearGradient id="fx%s"><stop offset="0%%" stop-color="#FFFFFF" stop-opacity="0"></stop>'
         '<stop offset="50%%" stop-color="#FFFFFF" stop-opacity="0.92"></stop>'
         '<stop offset="100%%" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>'
         '<linearGradient id="fy%s" x1="0" y1="0" x2="0" y2="1">'
         '<stop offset="0%%" stop-color="#FFFFFF" stop-opacity="0"></stop>'
         '<stop offset="50%%" stop-color="#FFFFFF" stop-opacity="0.92"></stop>'
         '<stop offset="100%%" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>'
         '<filter id="fh%s" x="-300%%" y="-300%%" width="700%%" height="700%%">'
         '<feGaussianBlur stdDeviation="3.5"></feGaussianBlur></filter></defs>'
         % (key, key, key, key, key)]
    if PHOTO_GROUND:
        # Everything this function used to draw — the vignette, the cloud, the
        # invented star field, the diffraction flares — is what the photograph
        # already IS, and better. Keeping any of it would be a drawing of a sky
        # laid over a sky, and the seams would show at every crop. Only the
        # defs survive: the subjects still reference them.
        return "".join(o)
    o.append('<rect x="0" y="0" width="%d" height="%d" fill="url(#vig%s)"></rect>' % (W, H, key))
    if dust:
        o.append(nebula(key, rng, hue, lo, hi))

    # A real sky clumps. Roughly a quarter of the field falls near one of five
    # loose centres; the rest is scattered.
    cl = [(rng.uniform(0, W), rng.uniform(lo, hi), rng.uniform(90, 250)) for _ in range(5)]
    # A galactic band. A field of uniform density reads as wallpaper however
    # well the magnitudes are graded — the sky you actually remember has a
    # river of stars across it and empty quarters either side. A third of the
    # field falls within a soft distance of one diagonal.
    ba, bb = rng.uniform(-0.55, -0.20), lo + rng.uniform(0.25, 0.75) * span
    field = []
    for _ in range(n):
        u0 = rng.random()
        if u0 < 0.26:
            ccx, ccy, cr = cl[rng.randrange(len(cl))]
            x, y = ccx + rng.gauss(0, cr), ccy + rng.gauss(0, cr * 0.7)
        elif band and u0 < 0.60:
            x = rng.uniform(-8, W + 8)
            y = ba * x + bb + rng.gauss(0, span * 0.11)
        else:
            x, y = rng.uniform(-8, W + 8), rng.uniform(lo, hi)
        if not (-6 <= x <= W + 6 and lo - 6 <= y <= hi + 6):
            continue
        u = rng.random()
        if u < 0.64:
            r, op = rng.uniform(0.4, 0.8), rng.uniform(0.18, 0.46)
        elif u < 0.91:
            r, op = rng.uniform(0.9, 1.5), rng.uniform(0.48, 0.80)
        else:
            r, op = rng.uniform(1.6, 2.7), rng.uniform(0.82, 1.00)
        field.append((min(11, int(op * 12)), round(x), round(y), r))
    field.sort()
    cur = None
    for b, x, y, r in field:
        if b != cur:
            if cur is not None:
                o.append('</g>')
            o.append('<g fill="#fff" fill-opacity="%.2f">' % ((b + 0.5) / 12.0))
            cur = b
        o.append('<circle cx="%d" cy="%d" r="%s"/>' % (x, y, _r(r)))
    if cur is not None:
        o.append('</g>')

    for _ in range(flares):
        x, y = rng.uniform(50, W - 50), rng.uniform(lo + 40, max(lo + 41, hi - 40))
        L, rr = rng.uniform(26, 52), rng.uniform(1.7, 2.8)
        o.append('<g opacity="%.2f">' % rng.uniform(0.7, 1.0))
        o.append('<circle cx="%.0f" cy="%.0f" r="%.0f" fill="#fff" opacity="0.30" filter="url(#fh%s)"/>'
                 % (x, y, rr * 2.1, key))
        o.append('<path d="M%.0f %.0f h%.0f" stroke="url(#fx%s)" stroke-width="1.5"/>'
                 % (x - L, y, 2 * L, key))
        o.append('<path d="M%.0f %.0f v%.0f" stroke="url(#fy%s)" stroke-width="1.5"/>'
                 % (x, y - L * 0.72, 1.44 * L, key))
        o.append('<circle cx="%.0f" cy="%.0f" r="%s" fill="#fff"/>' % (x, y, _r(rr)))
        o.append('</g>')
    return "".join(o)

# 1 · COMERCIO ELECTRÓNICO — un muro de cubos, uno encendido
def img_ec():
    rng = random.Random(23); C = "#008FD3"
    s = [sky("ec", 901, n=880, flares=17, hue=C),
         bed("ec", 1008, 350, 470, 360),
         # The wall hangs OVER something. Cropped by two edges, so the curve
         # can only belong to something far larger than the frame.
         body("ec", 1318, 1004, 420, C, lit=(26, 16), rings=3),
         '<defs>%s%s</defs>' % (glow("gec", 18), glow("gec2", 60))]
    cols, rows = 15, 9
    cw, ch = 1440.0 / cols, 900.0 / rows
    k = (cw * 0.60) / 172.0
    HC, HR = 10, 3
    wall, hero = [], None
    for r in range(rows):
        for c in range(cols):
            cx = c * cw + cw / 2 + (ch * 0.0)
            cy = r * ch + ch / 2
            if c == HC and r == HR:
                hero = (cx, cy); continue
            # The wall used to fade from the CENTRE of the frame, which left an
            # even lattice over every star — "no se nota que estamos en el
            # cielo" (founder). It now falls away from the lit cube instead, so
            # the ones near your order stay legible and the rest dissolve into
            # the sky they are floating in.
            # Two falloffs, not one. The radial makes the wall a halo around
            # your order; the vertical clears the top third completely, so the
            # frame opens onto the sky the wall is hanging in. A regular
            # lattice edge to edge is the one thing that cannot read as space,
            # however many stars are behind it.
            d = math.hypot((c - HC) / 7.0, (r - HR) / 4.2)
            vf = min(1.0, max(0.06, (r - 0.2) / 2.6))
            op = 0.46 * math.exp(-1.45 * d) * vf * rng.uniform(0.75, 1.25)
            if op < 0.030:
                continue
            wall.append(cube(cx, cy, k, op=op, w=1.1, hint=False))
    s.append("".join(wall))
    hx, hy = hero
    s.append('<g filter="url(#gec2)" opacity="0.55">%s</g>' % cube_solid(hx, hy, k * 1.06, C))
    s.append('<g filter="url(#gec)">%s</g>' % cube_solid(hx, hy, k, C))
    s.append(cube_solid(hx, hy, k, C))
    s.append(cube(hx, hy, k, stroke="#131313", op=0.55, w=2.0, hint=True))
    s.append(cube(hx, hy, k * 1.30, stroke=C, op=0.45, w=1.0, hint=False, cross=False, dash="5 7"))
    return "".join(s)

# 2 · CDN / EDGE — el cubo envuelve el mundo; el limbo es el borde
def img_cdn():
    rng = random.Random(11); C = "#F38020"
    # 296 at (1006, 466) until the bears became compulsory. The globe and the
    # cube circumscribing it filled the one quarter the scrim leaves bright,
    # so the plate was drawn without an asterism at all. Wrong call: the globe
    # is 15% smaller and a little lower now, and it has lost nothing — it is
    # still the largest body of the six by a wide margin, and the extra sky
    # above its shoulder is what makes it read as hanging in something.
    cx, cy, r = 940, 500, 250
    s = [sky("cdn", 902, n=780, flares=14, hue=C),
         bed("cdn", 940, 500, 520, 430),
         # No second planet here — the subject already is one. A moon, off in
         # the empty quarter, for the depth two bodies give and one cannot.
         body("cdnm", 232, 690, 96, C, lit=(70, 30), rings=2, atmos=False),
         '<defs>%s%s' % (glow("gcdn", 26), glow("gcdn2", 62))]
    s.append('<clipPath id="pcdn"><circle cx="%d" cy="%d" r="%d"></circle></clipPath></defs>' % (cx, cy, r))
    s.append('<circle cx="%d" cy="%d" r="%d" fill="#131313"></circle>' % (cx, cy, r))
    mesh = []
    for i in range(1, 9):
        mesh.append('<ellipse cx="%d" cy="%d" rx="%d" ry="%.0f" fill="none" stroke="#fff" stroke-opacity="0.09" stroke-width="1"></ellipse>' % (cx, cy, r, r * math.cos(i * math.pi / 18)))
        mesh.append('<ellipse cx="%d" cy="%d" rx="%.0f" ry="%d" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1"></ellipse>' % (cx, cy, r * math.cos(i * math.pi / 18), r))
    s.append('<g clip-path="url(#pcdn)">%s</g>' % "".join(mesh))
    s.append('<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="24" opacity="0.30" filter="url(#gcdn2)"></circle>' % (cx, cy, r, C))
    s.append('<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="6" opacity="0.85" filter="url(#gcdn)"></circle>' % (cx, cy, r, C))
    s.append('<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="2.2"></circle>' % (cx, cy, r, C))
    # el cubo, circunscrito: la coraza que envuelve el mundo
    k = 3.43   # the cube stays circumscribed: 4.06 * 250/296
    s.append(cube(cx, cy, k, stroke="#fff", op=0.30, w=1.6, hint=True))
    p = M(cx, cy, k)
    nodes = []
    for v in VERTS:
        vx, vy = p(*v)
        nodes.append('<circle cx="%.0f" cy="%.0f" r="15" fill="%s" opacity="0.5" filter="url(#gcdn)"></circle>' % (vx, vy, C))
        nodes.append('<circle cx="%.0f" cy="%.0f" r="6" fill="%s"></circle>' % (vx, vy, C))
        nodes.append('<circle cx="%.0f" cy="%.0f" r="17" fill="none" stroke="%s" stroke-opacity="0.5" stroke-width="1"></circle>' % (vx, vy, C))
    s.append("".join(nodes))
    return "".join(s)

# 3 · BIG DATA — el cubo emerge de la nube de puntos
def img_bd():
    rng = random.Random(37); C = "#EA4335"
    s = [sky("bd", 903, n=430, flares=9, hue=C),
         bed("bd", 900, 470, 500, 400),
         body("bd", 1400, 40, 215, C, lit=(30, 62), rings=4),
         '<defs>%s%s</defs>' % (glow("gbd", 16), glow("gbd2", 52))]
    cx, cy, k = 900, 470, 3.15
    p = M(cx, cy, k)
    pts = []
    # difusa alrededor
    for _ in range(1700):
        a = rng.uniform(0, 2 * math.pi); rad = abs(rng.gauss(0, 1)) ** 0.85
        x = cx + math.cos(a) * rad * 400; y = cy + math.sin(a) * rad * 250
        if not (-20 < x < 1460 and -20 < y < 920): continue
        pts.append('<circle cx="%.0f" cy="%.0f" r="%.1f" fill="#fff" opacity="%.2f"></circle>'
                   % (x, y, rng.uniform(0.5, 1.9), max(0.05, rng.uniform(0.10, 0.55) * (1.2 - min(rad, 1.4) / 1.6))))
    # el cubo, dibujado con los datos: puntos densos sobre sus aristas
    EDGES = [(VERTS[i], VERTS[(i + 1) % 6]) for i in range(6)]
    EDGES += [((14, 64), (100, 114)), ((100, 114), (186, 64)), ((100, 114), (100, 214))]
    EDGES += [a for a in HINT]
    for a, b in EDGES:
        ax, ay = p(*a); bx, by = p(*b)
        L = math.hypot(bx - ax, by - ay)
        n = int(L / 3.4)
        for i in range(n):
            t = i / max(1, n - 1)
            jx = rng.gauss(0, 3.4); jy = rng.gauss(0, 3.4)
            x = ax + (bx - ax) * t + jx; y = ay + (by - ay) * t + jy
            pts.append('<circle cx="%.0f" cy="%.0f" r="%.1f" fill="#fff" opacity="%.2f"></circle>'
                       % (x, y, rng.uniform(0.6, 2.1), rng.uniform(0.42, 0.95)))
    s.append("".join(pts))
    hx, hy = 1300, 764
    s.append('<path d="M1128 640 L%d %d" stroke="%s" stroke-opacity="0.26" stroke-width="1" stroke-dasharray="5 8"></path>' % (hx, hy, C))
    s.append('<circle cx="%d" cy="%d" r="13" fill="%s" opacity="0.55" filter="url(#gbd2)"></circle>' % (hx, hy, C))
    s.append('<circle cx="%d" cy="%d" r="5.5" fill="%s" filter="url(#gbd)"></circle>' % (hx, hy, C))
    for rr, op in ((28, 0.9), (56, 0.45), (92, 0.2)):
        s.append('<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-opacity="%.2f" stroke-width="1"></circle>' % (hx, hy, rr, C, op))
    s.append('<path d="M%d %d h-64 M%d %d h64 M%d %d v-64 M%d %d v64" stroke="%s" stroke-opacity="0.5" stroke-width="1"></path>'
             % (hx - 104, hy, hx + 104, hy, hx, hy - 104, hx, hy + 104, C))
    return "".join(s)

# 4 · INTEGRACIÓN — todo pasa por el cubo
def img_int():
    rng = random.Random(53); C, CL = "#1D4E89", "#5B94DA"
    cx, cy, k = 760, 450, 2.35
    s = [sky("int", 904, n=720, flares=13, hue=CL),
         bed("int", 900, 470, 520, 410),
         body("int", 1330, 872, 262, CL, lit=(30, 24), rings=3),
         '<defs>%s%s</defs>' % (glow("gint", 18), glow("gint2", 54))]
    # The corner the tangle is not allowed into. 96 crossing beziers is the
    # right density for "everything goes through the cube" and the wrong one
    # for anything else to be read through it. The pair no longer lives on
    # this plate, but the quiet corner stays: the sky needs somewhere to be
    # visible as sky, and rejection sampling costs nothing — the tangle keeps
    # its full weight everywhere it is the subject.
    KEEP = (1136, 130, 1440, 500)   # x0, y0, x1, y1

    def clear_of_keep(p0, c1, c2, p3):
        for i in range(15):
            t = i / 14.0
            u = 1 - t
            x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0]
            y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]
            if KEEP[0] < x < KEEP[2] and KEEP[1] < y < KEEP[3]:
                return False
        return True

    wires = []
    for _ in range(96):
        y0 = rng.uniform(-60, 960); y1 = rng.uniform(-60, 960)
        wires.append('<path d="M-120 %.0f C%.0f %.0f %.0f %.0f %.0f %.0f" fill="none" stroke="#fff" stroke-opacity="%.2f" stroke-width="%.1f"></path>'
                     % (y0, rng.uniform(180, 620), rng.uniform(-140, 1040), rng.uniform(360, 700), cy + rng.gauss(0, 90),
                        cx, cy + rng.gauss(0, 40), rng.uniform(0.05, 0.22), rng.uniform(0.6, 1.2)))
        # the outbound half, redrawn until it misses the reserved corner
        for _try in range(8):
            p0 = (cx, cy + rng.gauss(0, 40))
            c1 = (rng.uniform(820, 1160), cy + rng.gauss(0, 90))
            c2 = (rng.uniform(1100, 1400), rng.uniform(-140, 1040))
            p3 = (1560, y1)
            if clear_of_keep(p0, c1, c2, p3):
                wires.append('<path d="M%.0f %.0f C%.0f %.0f %.0f %.0f %.0f %.0f" fill="none" stroke="#fff" stroke-opacity="%.2f" stroke-width="%.1f"></path>'
                             % (p0 + c1 + c2 + p3 + (rng.uniform(0.05, 0.22), rng.uniform(0.6, 1.2))))
                break
    s.append("".join(wires))
    # el cubo: el punto por el que pasa todo
    s.append('<polygon points="%s" fill="#171717" opacity="0.92"></polygon>'
             % " ".join("%.1f,%.1f" % M(cx, cy, k)(*v) for v in VERTS))
    s.append(cube(cx, cy, k, stroke="#fff", op=0.40, w=1.8, hint=True))
    path = "M-40 690 C 300 690, 420 480, %d %d S 1140 300, 1240 330 S 1420 250, 1500 236" % (cx, cy)
    s.append('<path d="%s" fill="none" stroke="%s" stroke-width="24" opacity="0.55" filter="url(#gint2)"></path>' % (path, C))
    s.append('<path d="%s" fill="none" stroke="%s" stroke-width="7" opacity="0.5" filter="url(#gint)"></path>' % (path, CL))
    s.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.6"></path>' % (path, CL))
    for px, py in [(cx, cy), (1240, 330)]:
        s.append('<circle cx="%d" cy="%d" r="6.5" fill="%s"></circle>' % (px, py, CL))
        s.append('<circle cx="%d" cy="%d" r="16" fill="none" stroke="%s" stroke-opacity="0.55" stroke-width="1"></circle>' % (px, py, CL))
    return "".join(s)

# 5 · GREENFIELD — el campo vacío y la primera pieza del cubo
def img_gf():
    rng = random.Random(71); C, CL = "#3E7D50", "#5FBE7C"
    hz = 392
    s = [sky("gf", 905, n=700, yr=(0, hz - 8), flares=12, hue=CL),
         bed("gf", 980, 545, 520, 380),
         # Above the horizon, never below it: a planet drawn over the plain
         # would be sitting ON the ground instead of hanging in the sky. It
         # used to be 162px at (1206, 126), which is exactly where the bears
         # had to go; now it is smaller and runs off the top edge instead —
         # a limb leaving the frame reads as bigger than a disc inside it,
         # so the plate arguably gained a planet by losing 50px of one.
         body("gf", 1078, 78, 116, CL, lit=(32, 60), rings=3),
         '<defs>%s%s</defs>' % (glow("ggf", 18), glow("ggf2", 56))]
    lines = []
    vx = 700
    for i in range(-30, 31):
        lines.append('<path d="M%d %d L%.0f 960" fill="none" stroke="#fff" stroke-opacity="0.10" stroke-width="1"></path>' % (vx, hz, vx + i * 228))
    for kk in range(1, 22):
        t = kk / 22
        y = hz + (960 - hz) * (t ** 2.5)
        lines.append('<path d="M-40 %.0f H1480" fill="none" stroke="#fff" stroke-opacity="%.2f" stroke-width="1"></path>' % (y, 0.05 + 0.13 * t))
    s.append("".join(lines))
    s.append('<path d="M-40 %d H1480" fill="none" stroke="#fff" stroke-opacity="0.30" stroke-width="1"></path>' % hz)
    # Haze at the horizon, as a GRADIENT and not the flat 120px band this was.
    # A flat band draws its own hard edge straight across the frame at
    # y=hz-120 — a line the eye reads as a second horizon — and it took a
    # fixed 50% off everything in it, which on this plate is where the Plough
    # has to sit. A ramp does the job the band was for (air thickens toward
    # the ground; stars dim into it) and does it the way the sky does.
    s.append('<defs><linearGradient id="ghz" x1="0" y1="0" x2="0" y2="1">'
             '<stop offset="0%%" stop-color="#171717" stop-opacity="0"></stop>'
             '<stop offset="100%%" stop-color="#171717" stop-opacity="0.62"></stop>'
             '</linearGradient></defs>'
             '<rect x="0" y="%d" width="1440" height="164" fill="url(#ghz)"></rect>' % (hz - 164))
    # el cubo por levantar: silueta en discontinuo, y la primera pieza puesta
    cx, cy, k = 980, 560, 2.1
    s.append(cube(cx, cy, k, stroke="#fff", op=0.34, w=1.5, hint=True, dash="10 9"))
    p = M(cx, cy, k)
    # el voxel frontal inferior: centro del cubo completo desplazado al vértice bajo
    vx, vy = p(100, 164)
    s.append('<g filter="url(#ggf2)" opacity="0.55">%s</g>' % cube_solid(vx, vy, k * 0.5, C))
    s.append(cube_solid(vx, vy, k * 0.5, CL))
    s.append(cube(vx, vy, k * 0.5, stroke="#171717", op=0.5, w=1.6, hint=False))
    # su sombra en el suelo
    fx, fy = p(100, 214)
    s.append('<ellipse cx="%.0f" cy="%.0f" rx="118" ry="30" fill="none" stroke="%s" stroke-opacity="0.30" stroke-width="1"></ellipse>' % (fx, fy + 14, CL))
    return "".join(s)

# 6 · IA — la ruta que se enciende dentro del cubo
def img_ia():
    rng = random.Random(97); C, CL = "#6B4FBB", "#9A7BEE"
    cx, cy, k = 760, 460, 3.5
    p = M(cx, cy, k)
    s = [sky("ia", 906, n=760, flares=14, hue=CL),
         bed("ia", 940, 470, 490, 400),
         body("ia", 1352, 806, 288, CL, lit=(26, 22), rings=3),
         '<defs>%s%s</defs>' % (glow("gia", 18), glow("gia2", 54))]
    # retícula de nodos en los cruces de la trama 2×2 del cubo, en tres planos
    grid = []
    for u in (14, 57, 100, 143, 186):
        for v in (64, 114, 164):
            grid.append((u, v))
    for u in (57, 100, 143):
        for v in (39, 89, 139, 189):
            grid.append((u, v))
    nodes = sorted(set(grid))
    XY = [p(*g) for g in nodes]
    edges = []
    for i in range(len(XY)):
        for j in range(i + 1, len(XY)):
            d = math.dist(XY[i], XY[j])
            if d < 190 and rng.random() < 0.55:
                edges.append('<path d="M%.0f %.0f L%.0f %.0f" stroke="#fff" stroke-opacity="%.2f" stroke-width="0.8"></path>'
                             % (XY[i][0], XY[i][1], XY[j][0], XY[j][1], rng.uniform(0.05, 0.16)))
    s.append("".join(edges))
    s.append(cube(cx, cy, k, stroke="#fff", op=0.26, w=1.4, hint=True))
    s.append("".join('<circle cx="%.0f" cy="%.0f" r="4" fill="#1E1E1E" stroke="#fff" stroke-opacity="0.40" stroke-width="1"></circle>' % xy for xy in XY))
    lit = [p(14, 64), p(57, 89), p(100, 164), p(143, 139), p(186, 164)]
    d = d_poly(lit, False)
    s.append('<path d="%s" fill="none" stroke="%s" stroke-width="22" opacity="0.5" filter="url(#gia2)"></path>' % (d, C))
    s.append('<path d="%s" fill="none" stroke="%s" stroke-width="6" opacity="0.5" filter="url(#gia)"></path>' % (d, CL))
    s.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.6"></path>' % (d, CL))
    for xy in lit:
        s.append('<circle cx="%.0f" cy="%.0f" r="6.5" fill="%s"></circle>' % (xy[0], xy[1], CL))
        s.append('<circle cx="%.0f" cy="%.0f" r="17" fill="none" stroke="%s" stroke-opacity="0.5" stroke-width="1"></circle>' % (xy[0], xy[1], CL))
    return "".join(s)

IMAGES = {
    "ec":  ("Comercio electrónico", "comercio-electronico", "#008FD3", "Un muro de cubos; uno es tu pedido", img_ec()),
    "cdn": ("CDN, WAF y seguridad edge", "cdn-waf-seguridad-edge-cloudflare", "#F38020", "El cubo envuelve el mundo; el limbo es el borde", img_cdn()),
    "bd":  ("Big Data & Cloud Analytics", "big-data-cloud-analytics", "#EA4335", "El cubo emerge del dato; la mira, lo que se sale", img_bd()),
    "int": ("Integración de sistemas", "integracion-de-sistemas", "#1D4E89", "Todo pasa por el cubo", img_int()),
    "gf":  ("Desarrollo greenfield", "desarrollo-greenfield", "#3E7D50", "El campo vacío y la primera pieza puesta", img_gf()),
    "ia":  ("Inteligencia artificial", "inteligencia-artificial", "#6B4FBB", "La ruta que se enciende dentro del cubo", img_ia()),
}
SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">%%s</svg>' % (W, H, W, H)


def menu_ground():
    """The ground for the menu panel (#417).

    The menu went dark so it would stop reading as a different website, and
    the thing that ties it to the home is not the colour — the home's dark is
    everywhere now — it is the DRAWING. So the panel gets the same sky the six
    plates are built on and the same wire cubes, drawn by the same functions,
    and nothing is copied by hand into a stylesheet.

    Three departures from a hero plate, all because a menu is read, not looked
    at: no subject (there is nothing here to be about), the cubes fade out
    toward the left where the six specialty links sit (a texture that runs
    under 32px type at full strength is a texture that wins), and NO SKY.

    The sky was here first and the founder called it (2026-08-29: "el menú más
    sobrio, sí. Parece unos fuegos artificiales con las estrellas, ahí me
    equivoqué"). He is right, and the reason is worth keeping: a hero band is
    looked at for two seconds and a menu is scanned for the one word you came
    for. Diffraction spikes and magnitude-graded stars are exactly the wrong
    amount of event behind a list of six links. What ties the panel to the
    home was never the stars anyway — it is the wire cubes and the colour
    rule, both of which stay.
    """
    rng = random.Random(910)
    out = []
    for row in range(5):
        for col in range(8):
            cx = 92 + col * 184 + rng.uniform(-26, 26)
            cy = 96 + row * 182 + rng.uniform(-24, 24)
            # quiet on the reading side, present on the right
            side = min(1.0, max(0.30, cx / W))
            op = 0.13 * side * rng.uniform(0.75, 1.2)
            if op < 0.035:
                continue
            out.append(cube(cx, cy, 0.30 * rng.uniform(0.85, 1.15), op=op, w=1.2, hint=False))
    return "".join(out)



if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    # the canvas build reads this; the site reads the SVGs
    json.dump({k: list(v) for k, v in IMAGES.items()},
              open(os.path.join(here, "images.json"), "w"), ensure_ascii=False)
    # No role, no aria-label, no <title>: the plates are DECORATIVE. The <img>
    # that carries them has alt="" and the vertical's name is a real link next
    # to it — a label here would be locale-bound copy living outside the CMS,
    # and it would read the picture out twice.
    out = os.path.normpath(os.path.join(here, "..", "..", "..", "public", "assets", "hero"))
    os.makedirs(out, exist_ok=True)
    for k, v in IMAGES.items():
        path = os.path.join(out, k + ".svg")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(SVG % v[4])
        print("%-4s %4d KB  %s" % (k, os.path.getsize(path) // 1024, path))

    # …and the menu panel's ground, same vocabulary, no subject (#417)
    mout = os.path.normpath(os.path.join(here, "..", "..", "..", "public", "assets", "menu"))
    os.makedirs(mout, exist_ok=True)
    mpath = os.path.join(mout, "ground.svg")
    with open(mpath, "w", encoding="utf-8") as fh:
        fh.write(SVG % menu_ground())
    print("%-4s %4d KB  %s" % ("menu", os.path.getsize(mpath) // 1024, mpath))
