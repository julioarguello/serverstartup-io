#!/usr/bin/env python3
"""Rendered-copy baseline — catches text regressions that compile green.

Why this exists
---------------
Astro 7 changes `compressHTML` from `true` to `'jsx'`. Under JSX whitespace
rules, inline elements adjacent across a newline GLUE together:

    <span>uno</span>
    <em>dos</em>          renders "unodos", not "uno dos"

Nothing fails. `astro check` passes, the build succeeds, html-validate is
happy, and the page ships with two words welded into one. The only way to
see it is to compare the rendered TEXT against a baseline captured before
the change.

The same comparison answers a second, larger question. If the CMS read
path shifts under EmDash 0.34 (`getEmDashCollection`, `emdashLoader`, the
PortableText spans `mdNormalize` patches), whole paragraphs go missing
rather than words gluing. A text diff shows both — one as a lost space,
the other as a lost block.

Extraction rules, and why they are not negotiable
-------------------------------------------------
The extractor MUST reproduce what a browser renders, because the defect we
hunt IS a whitespace defect:

  * Inline elements concatenate with NOTHING between them. Inserting a
    separator at every tag boundary would render "uno dos" both before and
    after the upgrade — the gate would pass over the very bug it exists
    for. This is the whole design.
  * Block elements separate with a newline, mirroring how they render as
    distinct lines.
  * Runs of whitespace collapse to one space, which is what HTML does.
    Collapsing is safe; INSERTING is not.
  * <script> and <style> contents are dropped — they are not copy.

Usage
-----
    copy-baseline.py capture --base-url http://localhost:8787
    copy-baseline.py verify  --base-url http://localhost:8787

`verify` exits non-zero and names the file and line on the first
difference. Run `capture` again, deliberately, when copy legitimately
changes — that is the maintenance cost of the gate, accepted knowingly.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BASELINE_DIR = REPO / "tests" / "copy-baseline"
SEED = REPO / "seed" / "seed.json"

# Elements that render as their own line. Everything else is inline and
# concatenates with nothing — see the module docstring.
BLOCK = {
    "address", "article", "aside", "blockquote", "br", "dd", "details",
    "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer",
    "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li",
    "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td",
    "tfoot", "th", "thead", "tr", "ul",
}

SKIP_CONTENT = {"script", "style", "template", "noscript"}


class CopyExtractor(HTMLParser):
    """Text as rendered: inline concatenates, block breaks the line."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in SKIP_CONTENT:
            self._skip_depth += 1
            return
        if tag in BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in SKIP_CONTENT:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if tag in BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            # Appended verbatim. Whitespace is collapsed later, never added.
            self.parts.append(data)

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = []
        for line in raw.split("\n"):
            # Collapse runs to a single space — what HTML rendering does.
            collapsed = re.sub(r"[ \t\r\f\v ]+", " ", line).strip()
            if collapsed:
                lines.append(collapsed)
        return "\n".join(lines) + "\n"


def routes() -> list[str]:
    """Every public route, derived from the CMS seed.

    Same derivation as src/pages/sitemap.xml.ts: the seed knows which pages
    exist, so a route added there is covered here without editing a list.
    """
    data = json.loads(SEED.read_text(encoding="utf-8"))
    content = data["content"]
    out: list[str] = []
    for collection in ("pages", "services"):
        for entry in content.get(collection, []):
            slug = entry.get("slug") or entry.get("id")
            prefix = "/en" if entry.get("locale") == "en" else ""
            if collection == "pages" and slug == "home":
                out.append(prefix or "/")
            else:
                out.append(prefix + "/" + str(slug))
    return sorted(set(out))


def filename_for(route: str) -> str:
    return ("home" if route == "/" else route.strip("/").replace("/", "__")) + ".txt"


def fetch(base_url: str, route: str) -> str:
    url = base_url.rstrip("/") + route
    request = urllib.request.Request(url, headers={"User-Agent": "copy-baseline"})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(url + " returned HTTP " + str(response.status))
        html = response.read().decode("utf-8", errors="replace")
    parser = CopyExtractor()
    parser.feed(html)
    return parser.text()


def capture(base_url: str) -> int:
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    for route in routes():
        text = fetch(base_url, route)
        (BASELINE_DIR / filename_for(route)).write_text(text, encoding="utf-8")
        print("  captured " + route + " (" + str(len(text)) + " chars)")
    print("\n" + str(len(routes())) + " routes captured into tests/copy-baseline/")
    return 0


def verify(base_url: str) -> int:
    if not BASELINE_DIR.is_dir():
        print("ERROR: no baseline at " + str(BASELINE_DIR) + " — run `capture` first", file=sys.stderr)
        return 2
    failures = 0
    for route in routes():
        path = BASELINE_DIR / filename_for(route)
        if not path.is_file():
            print("FAIL " + route + " — no baseline file (" + path.name + ")", file=sys.stderr)
            failures += 1
            continue
        expected = path.read_text(encoding="utf-8").split("\n")
        actual = fetch(base_url, route).split("\n")
        for index in range(max(len(expected), len(actual))):
            want = expected[index] if index < len(expected) else "<end of file>"
            got = actual[index] if index < len(actual) else "<end of file>"
            if want != got:
                print("FAIL " + path.name + ":" + str(index + 1) + "  (" + route + ")", file=sys.stderr)
                print("  baseline: " + want, file=sys.stderr)
                print("  rendered: " + got, file=sys.stderr)
                failures += 1
                break
    if failures:
        print("\n" + str(failures) + " route(s) differ from the baseline.", file=sys.stderr)
        print("If the change is intentional, re-run `capture` and commit the new baseline.", file=sys.stderr)
        return 1
    print(str(len(routes())) + " routes match the baseline.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("capture", "verify"))
    parser.add_argument("--base-url", default="http://localhost:8787")
    args = parser.parse_args()
    try:
        return capture(args.base_url) if args.mode == "capture" else verify(args.base_url)
    except (urllib.error.URLError, RuntimeError) as error:
        # The observed fact and where to look — never a guessed cause.
        print("ERROR: could not read " + args.base_url + " — " + str(error), file=sys.stderr)
        print("  Is the stack up?  scripts/ci-local-stack.sh 8787", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
