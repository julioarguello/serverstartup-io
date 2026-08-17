#!/usr/bin/env python3
"""hreflang-sweep — verify the alternate-locale contract on every route (#291).

Walks every content URL derived from seed/seed.json (pages + services per
locale, home, search, posts index) against a running preview and asserts,
for each page:

  1. the route itself returns 200;
  2. a complete hreflang set is present (self + alternate + x-default);
  3. the self-reference matches the route;
  4. x-default points to the ES member of the pair (ES = default locale);
  5. the advertised alternate URL returns 200;
  6. reciprocity — the alternate page's own alternate points back;
  7. the visible LanguageSwitcher link equals the alternate and returns 200.

Slugs are translated across locales, so none of this can be assumed from
the URL shape — that assumption was the #291 bug.

Usage:  scripts/hreflang-sweep.py [BASE_URL]     (default http://localhost:4321)
Exit:   0 all green, 1 any failure — failures name route + expectation.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4321").rstrip("/")
ROOT = Path(__file__).resolve().parent.parent

HREFLANG_RE = re.compile(
    r'<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"', re.I
)
SWITCH_RE = re.compile(r'<a[^>]*class="lang-switch"[^>]*href="([^"]+)"|'
                       r'<a[^>]*href="([^"]+)"[^>]*class="lang-switch"', re.I)


def fetch(path: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(BASE + path, timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # connection refused etc. — the sweep itself is broken
        print(f"FATAL: cannot fetch {BASE}{path}: {e}")
        sys.exit(2)


def norm(path: str) -> str:
    """Trailing-slash-insensitive path comparison, root forms preserved."""
    return path if path in ("/", "/en/") else path.rstrip("/")


def routes_from_seed() -> list[tuple[str, str]]:
    seed = json.loads((ROOT / "seed" / "seed.json").read_text())
    routes: list[tuple[str, str]] = [
        ("/", "es"), ("/en/", "en"),
        ("/search", "es"), ("/en/search", "en"),
        ("/posts", "es"), ("/en/posts", "en"),
    ]
    for coll in ("pages", "services"):
        for e in seed["content"][coll]:
            loc, slug = e.get("locale", "es"), e["slug"]
            if slug == "home":
                continue  # served by / and /en/
            routes.append((f"/en/{slug}" if loc == "en" else f"/{slug}", loc))
    return routes


def main() -> int:
    routes = routes_from_seed()
    print(f"hreflang sweep from {BASE} — {len(routes)} routes")
    failures: list[str] = []
    alt_of: dict[str, str | None] = {}  # route -> advertised alternate path

    for path, locale in routes:
        def fail(msg: str) -> None:
            failures.append(f"{path}: {msg}")

        status, html = fetch(path)
        if status != 200:
            fail(f"route returned {status}")
            alt_of[norm(path)] = None
            continue

        links = {hl: urlsplit(href).path for hl, href in HREFLANG_RE.findall(html)}
        other = "en" if locale == "es" else "es"
        if not links:
            fail("no hreflang set emitted")
            alt_of[norm(path)] = None
            continue
        if norm(links.get(locale, "")) != norm(path):
            fail(f"self hreflang is {links.get(locale)!r}, expected {path!r}")
        if other not in links:
            fail(f"missing hreflang={other}")
        if "x-default" not in links:
            fail("missing x-default")
        else:
            es_path = links.get("es") if locale == "en" else path
            if es_path and norm(links["x-default"]) != norm(es_path):
                fail(f"x-default is {links['x-default']!r}, expected ES {es_path!r}")

        alt = links.get(other)
        alt_of[norm(path)] = norm(alt) if alt else None
        if alt:
            alt_status, _ = fetch(alt)
            if alt_status != 200:
                fail(f"alternate {alt!r} returned {alt_status}")

        m = SWITCH_RE.search(html)
        if not m:
            fail("no lang-switch link found")
        else:
            sw = norm((m.group(1) or m.group(2)))
            if alt and sw != norm(alt):
                fail(f"lang-switch {sw!r} != hreflang alternate {norm(alt)!r}")
            sw_status, _ = fetch(sw)
            if sw_status != 200:
                fail(f"lang-switch target {sw!r} returned {sw_status}")

    for path, alt in alt_of.items():
        if alt and alt_of.get(alt) not in (None, path) :
            failures.append(f"{path}: no reciprocity — {alt} points to {alt_of.get(alt)}")

    if failures:
        print(f"\n{len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print(f"✓ all {len(routes)} routes green (self + alternate + x-default + switcher, reciprocal)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
