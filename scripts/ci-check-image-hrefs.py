#!/usr/bin/env python3
"""ci-check-image-hrefs — what a /_image URL has to say: a path, and a quality.

Two rules over the same markup, read on the same crawl.

## One — the href is a path, never an absolute URL (#412)

#407 was a Worker unable to fetch its own hostname. EmDash hands Astro an
ABSOLUTE url for CMS media, Astro classifies our own site as remote, and the
/_image endpoint then FETCHES it over HTTP — which on Cloudflare is a Worker
asking the edge for its own name, answered with a 17-byte error string. Every
image on the site returned 500.

The cause was legible in the rendered HTML long before it reached the edge:

    /_image?href=https%3A%2F%2Fwww-serverstartup-io-preview…%2Fassets%2Fteam%2Fdani.jpg

Nothing read for it. `ci-check-headers.sh` issues a real GET and would catch
the 500, but under `wrangler dev` that same href returns the real file: there
the loopback is an ordinary request to localhost, so a BEHAVIOURAL check is
green on a broken build. Only deploy-preview caught it — one merge to main too
late, which is how #408 shipped a fix that was dead code.

So this gate reads the BYTES, in the one environment where the bug is
invisible. An href that is a path puts the endpoint on its `env.ASSETS.fetch()`
branch (or the media binding) with no subrequest at all; an href that is an
absolute URL puts it on the remote branch, which on Workers cannot work and
cannot be made to work.

Any absolute href fails, including one pointing somewhere genuinely foreign.
That is stricter than the endpoint requires and deliberate: today every host in
`image.remotePatterns` is ours and the repository carries no third-party image
at all, so the rule costs nothing and closes by default. The day a foreign
image is wanted, this gate goes red and the host is written down, with a
reason, in scripts/image-remote-allowlist.txt.

## Two — the transform names its quality (#409)

The adapter's endpoint reads `q` off the URL and hands it to the IMAGES
binding, which applies no default of its own and encodes near-losslessly when
the parameter is absent. Measured on the deployed preview worker, same URL,
same transform: the sponsorship photograph at its 852px variant came back
489 154 bytes, and 116 634 with `&q=85` appended by hand. A team photograph at
520px: 144 204 against 29 932. Four to five times the bytes, on the pages whose
whole point was to stop shipping full-size originals.

Astro puts `q` in the URL only when the call site passes `quality`, so this is
a rule about markup — and markup is what this gate already reads. It is invisible
anywhere else: the local `compile` build goes through sharp, which has a sensible
default of its own, and the transform ANSWERS correctly either way. Only the
size of the answer differs, and only in production.

Usage:  scripts/ci-check-image-hrefs.py [BASE_URL]   (default http://localhost:8787)
Exit:   0 clean · 1 findings · 2 stack unreachable · 3 THIS GATE IS BLIND
"""

# `str | None` in an evaluated annotation is 3.10+, and the interpreter that
# runs the local gate set is 3.9 — the same line opens every other ci-check.
from __future__ import annotations

import html
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787").rstrip("/")
ROOT = Path(__file__).resolve().parent.parent
ALLOWLIST = ROOT / "scripts" / "image-remote-allowlist.txt"

# One /_image URL, not the list it may sit in. Inside a srcset each URL is
# followed by a width descriptor and a comma, so `[^"]+` swallows the whole
# attribute — measured, and why scripts/ci-check-headers.sh cuts the same way.
IMAGE_URL_RE = re.compile(r"/_image\?[^\"'\s,>]+")
LOC_RE = re.compile(r"<loc>([^<]+)</loc>")


def image_params(markup: str) -> list[dict[str, str]]:
    """Every /_image URL in `markup`, decoded into its query parameters.

    Separated from where the bytes came from so the positive control can
    exercise this exact function over a fixture instead of a served page.

    `html.unescape` first: the query separator renders as `&amp;`, and without
    it every parameter after the first parses under the key `amp;<name>` — an
    href that is not the first parameter then disappears silently, which reads
    as a clean page.
    """
    return [
        dict(parse_qsl(urlsplit(url).query, keep_blank_values=True))
        for url in IMAGE_URL_RE.findall(html.unescape(markup))
    ]


def image_hrefs(markup: str) -> list[str]:
    """Every decoded `href` of every /_image URL — the #407 rule reads in hrefs."""
    return [p["href"] for p in image_params(markup) if "href" in p]


def has_quality(params: dict[str, str]) -> bool:
    """Whether a transform names a quality at all.

    Presence, not value: Astro emits either a number or one of the named
    presets the adapter maps through its own table (`low`/`mid`/`high`/`max`),
    and both reach the binding as an explicit quality. What must never happen
    is the parameter being absent, which is the one case the binding answers
    near-losslessly.
    """
    return bool(params.get("q", "").strip())


def absolute_host(href: str) -> str | None:
    """The host an href points at, or None when it is a path.

    Covers all three absolute shapes in one expression: `https://h/x`,
    `http://h/x` and the protocol-relative `//h/x` all yield a netloc; a path
    yields the empty string.
    """
    return urlsplit(href).netloc or None


def allowed_hosts() -> set[str]:
    """Hosts a /_image href may legitimately point at. Empty is correct."""
    if not ALLOWLIST.exists():
        return set()
    hosts = set()
    for raw in ALLOWLIST.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        host, _, _reason = line.partition("#")
        hosts.add(host.strip())
    return hosts


def fetch(path: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(BASE + path, timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # connection refused etc. — the sweep itself is broken
        print(f"FATAL: cannot fetch {BASE}{path}: {e}", file=sys.stderr)
        sys.exit(2)


# ── positive control ────────────────────────────────────────────────────────

# Written the way Astro actually emits images — `&amp;` separators, a srcset of
# comma-separated URLs with width descriptors — because that is what the
# extractor reads. A fixture contorted to match the regex would agree with it
# by construction. Every trap this check has to survive is planted here:
#   · the first srcset entry must not swallow the two behind it;
#   · an href that is NOT the first query parameter must still be found,
#     which is only true if the entities were unescaped;
#   · protocol-relative `//host/x` counts as absolute;
#   · a media URL that is not a transform at all is none of our business;
#   · a transform that names no quality is caught, and the seven that name one
#     are not.
CONTROL_HTML = """<!doctype html>
<img src="/_image?href=%2F_astro%2Fdani.CzQ8.jpg&amp;w=53&amp;h=40&amp;f=webp&amp;q=85"
     srcset="/_image?href=%2F_astro%2Fdani.CzQ8.jpg&amp;w=53&amp;f=webp&amp;q=85 53w, /_image?href=%2F_astro%2Fdani.CzQ8.jpg&amp;w=106&amp;f=webp&amp;q=85 106w, /_image?href=https%3A%2F%2Fexample.invalid%2Fassets%2Fteam%2Fdani.jpg&amp;w=212&amp;f=webp&amp;q=85 212w"
     alt="a photograph the repository carries">
<img src="/_image?href=https%3A%2F%2Fpreview.example.workers.dev%2Fassets%2Fteam%2Fana.jpg&amp;w=260&amp;h=195&amp;f=webp&amp;q=85"
     alt="the #407 shape exactly">
<img src="/_image?href=%2F%2Fcdn.example.invalid%2Flogo.png&amp;w=64&amp;f=webp&amp;q=85"
     alt="protocol-relative, still absolute">
<img src="/_emdash/api/media/file/team-dani.jpg" alt="untransformed — not a finding">
<img src="/_image?f=webp&amp;href=%2F_astro%2Flate.CzQ8.jpg&amp;w=90&amp;q=high"
     alt="href is not the first parameter, and the quality is a named preset">
<img src="/_image?href=%2F_astro%2Fnoq.CzQ8.jpg&amp;w=53&amp;f=webp"
     alt="the #409 shape: a transform that names no quality">
"""

CONTROL_TOTAL = 8
CONTROL_ABSOLUTE = {
    "example.invalid",
    "preview.example.workers.dev",
    "cdn.example.invalid",
}
CONTROL_QLESS = {"/_astro/noq.CzQ8.jpg"}


def positive_control() -> int:
    """Prove the extractor still sees what it exists to see. 0 sighted, 3 blind."""
    params = image_params(CONTROL_HTML)
    found = image_hrefs(CONTROL_HTML)
    absolute = {h for h in (absolute_host(f) for f in found) if h}
    qless = {p.get("href", "") for p in params if not has_quality(p)}

    blind: list[str] = []
    if len(found) != CONTROL_TOTAL:
        blind.append(
            f"the extractor found {len(found)} /_image href(s) in the control, "
            f"expected {CONTROL_TOTAL} — a srcset entry or a late `href=` is being missed"
        )
    for host in CONTROL_ABSOLUTE - absolute:
        blind.append(f"planted absolute href at {host} was NOT reported")
    for host in absolute - CONTROL_ABSOLUTE:
        blind.append(f"{host} is not in the control and was reported")
    paths = [f for f in found if not absolute_host(f)]
    if not all(p.startswith("/_astro/") for p in paths):
        blind.append(f"a path href came back mangled: {paths}")
    for href in CONTROL_QLESS - qless:
        blind.append(f"planted quality-less transform {href} was NOT reported")
    for href in qless - CONTROL_QLESS:
        blind.append(f"{href} names a quality and was reported as missing one")

    if blind:
        print("✗ image-hrefs: THIS GATE IS BLIND — it can no longer find the shape "
              "it exists to find, so a green run proves nothing:", file=sys.stderr)
        for b in blind:
            print(f"    {b}", file=sys.stderr)
        print("  → the extractor changed (the URL regex, the entity unescape, the "
              "query parse); fix it before trusting any result.", file=sys.stderr)
        return 3
    return 0


# ── routes ──────────────────────────────────────────────────────────────────


def routes_from_sitemap() -> list[str]:
    """Every path the site declares. EmDash injects a competing /sitemap.xml —
    ours is the <urlset>, theirs the <sitemapindex> — so assert the outcome
    rather than trust the route precedence, as scripts/verify-deploy.sh does."""
    status, xml = fetch("/sitemap.xml")
    if status != 200:
        print(f"FATAL: /sitemap.xml returned {status}", file=sys.stderr)
        sys.exit(2)
    if "<sitemapindex" in xml:
        print("✗ image-hrefs: THIS GATE IS BLIND — /sitemap.xml is serving EmDash's "
              "generic index, not the site's own, so there is no route list to walk.",
              file=sys.stderr)
        print("  → route collision resolved the wrong way; see src/pages/sitemap.xml.ts.",
              file=sys.stderr)
        sys.exit(3)
    paths = {urlsplit(loc).path or "/" for loc in LOC_RE.findall(xml)}
    if not paths:
        print("✗ image-hrefs: THIS GATE IS BLIND — /sitemap.xml declares no <loc> at all.",
              file=sys.stderr)
        sys.exit(3)
    return sorted(paths)


def main() -> int:
    blind = positive_control()
    if blind:
        return blind
    print(f"  ok   positive control — {CONTROL_TOTAL} URLs extracted, "
          f"{len(CONTROL_ABSOLUTE)} absolute hrefs and "
          f"{len(CONTROL_QLESS)} quality-less transform(s) caught")

    allowed = allowed_hosts()
    routes = routes_from_sitemap()
    print(f"image-hrefs: {BASE} — {len(routes)} routes from the sitemap")

    failures: list[str] = []
    qless: list[str] = []
    seen = 0
    for path in routes:
        status, markup = fetch(path)
        if status != 200:
            failures.append(f"{path}: returned {status}")
            continue
        for params in image_params(markup):
            seen += 1
            href = params.get("href", "")
            host = absolute_host(href)
            if host and host not in allowed:
                failures.append(f"{path}: absolute href at {host} — {href}")
            if not has_quality(params):
                qless.append(f"{path}: no q= — {href or '(a URL with no href at all)'}")

    # A clean result over a site that emits no transforms at all proves nothing:
    # the check would report the same silence if /_image stopped being used, or
    # if the extractor stopped matching. Either way it is no longer looking.
    if seen == 0:
        print("✗ image-hrefs: THIS GATE IS BLIND — not one /_image URL on any of "
              f"the {len(routes)} routes, so nothing was actually inspected.",
              file=sys.stderr)
        print("  → either the site stopped routing images through /_image, in which "
              "case this gate needs rewriting rather than skipping, or the extractor "
              "no longer matches what Astro emits.", file=sys.stderr)
        return 3

    if failures:
        print(f"\n{len(failures)} ABSOLUTE HREF(S):", file=sys.stderr)
        for f in failures:
            print(f"  ✗ {f}", file=sys.stderr)
        print("  → a Worker cannot fetch its own hostname (#407). Render the image "
              "through src/components/TeamPhoto.astro, or off the media library, so "
              "the href is a PATH; add the host to scripts/image-remote-allowlist.txt "
              "only if it is genuinely someone else's.", file=sys.stderr)

    if qless:
        print(f"\n{len(qless)} TRANSFORM(S) THAT NAME NO QUALITY:", file=sys.stderr)
        for f in qless[:20]:
            print(f"  ✗ {f}", file=sys.stderr)
        if len(qless) > 20:
            print(f"  ✗ … and {len(qless) - 20} more", file=sys.stderr)
        print("  → the IMAGES binding has no default and encodes near-losslessly "
              "without q: 489 KB where 117 KB would do (#409). Pass "
              "quality={IMAGE_QUALITY} from src/lib/images.ts at the call site.",
              file=sys.stderr)

    if failures or qless:
        return 1

    print(f"✓ image-hrefs: clean — {seen} /_image URL(s) across {len(routes)} routes, "
          "every href a path and every transform with a quality")
    return 0


if __name__ == "__main__":
    sys.exit(main())
