#!/usr/bin/env python3
"""ci-check-image-hrefs — no /_image href may point at an absolute URL (#412).

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


def image_hrefs(markup: str) -> list[str]:
    """Every decoded `href` parameter of every /_image URL in `markup`.

    Separated from where the bytes came from so the positive control can
    exercise this exact function over a fixture instead of a served page.

    `html.unescape` first: the query separator renders as `&amp;`, and without
    it every parameter after the first parses under the key `amp;<name>` — an
    href that is not the first parameter then disappears silently, which reads
    as a clean page.
    """
    hrefs: list[str] = []
    for url in IMAGE_URL_RE.findall(html.unescape(markup)):
        for key, value in parse_qsl(urlsplit(url).query, keep_blank_values=True):
            if key == "href":
                hrefs.append(value)
    return hrefs


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
#   · a media URL that is not a transform at all is none of our business.
CONTROL_HTML = """<!doctype html>
<img src="/_image?href=%2F_astro%2Fdani.CzQ8.jpg&amp;w=53&amp;h=40&amp;f=webp"
     srcset="/_image?href=%2F_astro%2Fdani.CzQ8.jpg&amp;w=53&amp;f=webp 53w, /_image?href=%2F_astro%2Fdani.CzQ8.jpg&amp;w=106&amp;f=webp 106w, /_image?href=https%3A%2F%2Fexample.invalid%2Fassets%2Fteam%2Fdani.jpg&amp;w=212&amp;f=webp 212w"
     alt="a photograph the repository carries">
<img src="/_image?href=https%3A%2F%2Fpreview.example.workers.dev%2Fassets%2Fteam%2Fana.jpg&amp;w=260&amp;h=195&amp;f=webp"
     alt="the #407 shape exactly">
<img src="/_image?href=%2F%2Fcdn.example.invalid%2Flogo.png&amp;w=64&amp;f=webp"
     alt="protocol-relative, still absolute">
<img src="/_emdash/api/media/file/team-dani.jpg" alt="untransformed — not a finding">
<img src="/_image?f=webp&amp;href=%2F_astro%2Flate.CzQ8.jpg&amp;w=90"
     alt="href is not the first parameter">
"""

CONTROL_TOTAL = 7
CONTROL_ABSOLUTE = {
    "example.invalid",
    "preview.example.workers.dev",
    "cdn.example.invalid",
}


def positive_control() -> int:
    """Prove the extractor still sees what it exists to see. 0 sighted, 3 blind."""
    found = image_hrefs(CONTROL_HTML)
    absolute = {h for h in (absolute_host(f) for f in found) if h}

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
    print(f"  ok   positive control — {CONTROL_TOTAL} hrefs extracted, "
          f"{len(CONTROL_ABSOLUTE)} absolute ones caught")

    allowed = allowed_hosts()
    routes = routes_from_sitemap()
    print(f"image-hrefs: {BASE} — {len(routes)} routes from the sitemap")

    failures: list[str] = []
    seen = 0
    for path in routes:
        status, markup = fetch(path)
        if status != 200:
            failures.append(f"{path}: returned {status}")
            continue
        for href in image_hrefs(markup):
            seen += 1
            host = absolute_host(href)
            if host and host not in allowed:
                failures.append(f"{path}: absolute href at {host} — {href}")

    # A clean result over a site that emits no transforms at all proves nothing:
    # the check would report the same silence if /_image stopped being used, or
    # if the extractor stopped matching. Either way it is no longer looking.
    if seen == 0:
        print("✗ image-hrefs: THIS GATE IS BLIND — not one /_image href on any of "
              f"the {len(routes)} routes, so nothing was actually inspected.",
              file=sys.stderr)
        print("  → either the site stopped routing images through /_image, in which "
              "case this gate needs rewriting rather than skipping, or the extractor "
              "no longer matches what Astro emits.", file=sys.stderr)
        return 3

    if failures:
        print(f"\n{len(failures)} FAILURE(S):", file=sys.stderr)
        for f in failures:
            print(f"  ✗ {f}", file=sys.stderr)
        print("  → a Worker cannot fetch its own hostname (#407). Render the image "
              "through src/components/TeamPhoto.astro, or off the media library, so "
              "the href is a PATH; add the host to scripts/image-remote-allowlist.txt "
              "only if it is genuinely someone else's.", file=sys.stderr)
        return 1

    print(f"✓ image-hrefs: clean — {seen} /_image href(s) across {len(routes)} routes, "
          "every one a path")
    return 0


if __name__ == "__main__":
    sys.exit(main())
