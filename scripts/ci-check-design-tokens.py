#!/usr/bin/env python3
"""Design-token guard (#304) — colour, radius, shadow and the column.

`src/styles/theme.css` is the only place a colour, a radius or a shadow may be
declared. Everything else — the other stylesheets and the `<style>` blocks
inside components — consumes tokens. Without this check the unification lasts
until the next page: a literal `#fafafa` or `border-radius: 8px` reads as
perfectly good CSS in review, and the portal drifts back to five radii.

What counts as a violation, in a *declaration* outside the token file:

  · a colour literal — `#abc`, `#aabbcc`, `rgb(...)`, `rgba(...)`, `hsl(...)`
  · `border-radius` with anything but a token (or 0 / 50% / a percentage)
  · `box-shadow` with anything but a token (or `none`)
  · `max-width` with anything but the column token (or `100%` / `none`)

That last one is the layout rule made executable. A page has ONE width: every
heading, paragraph, box, panel and row ends at the column's right edge. The
portal had drifted to seven measures (1400 / 1040 / 1000 / 880 / 780 / 700 /
680) and the founder's reaction was the correct one — *"me pierdo con el
criterio… busco consistencia"*. Prose is not exempt: a second, narrower
measure for body copy alternates long and short lines down the page, which is
what reads as no criterion at all. A bespoke `max-width` is how that comes
back, one component at a time, so it is the thing to reject.

Two things are deliberately NOT violations:

  · a token with a literal fallback — `var(--color-primary, #1e1e1e)` — which
    is a token use, not a declaration;
  · a region a file marks itself, between `/* token-guard: off — reason */`
    and `/* token-guard: on */`. The service instruments quote foreign chrome
    (a cart, a search result, a pull request) whose colours belong to the
    product being imitated; a house token there would be wrong, not right.
    The marker keeps the exception visible at the exact line instead of
    exempting a whole file from a list nobody reads.

Usage:  python3 scripts/ci-check-design-tokens.py [--verbose]
Exit 0 clean · 1 violations found · 2 nothing was inspected.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = ROOT / "src" / "styles" / "theme.css"

COLOR_LITERAL = re.compile(
    r"(?<![\w-])(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))"
)
DECL = re.compile(r"^\s*([a-z-]+)\s*:\s*([^;]+);", re.IGNORECASE)

# `var(--token, <fallback>)` — the fallback is part of a token USE
VAR_FALLBACK = re.compile(r"var\(\s*--[\w-]+\s*,[^)]*\)")

GUARD_OFF = re.compile(r"/\*\s*token-guard:\s*off\b")
GUARD_ON = re.compile(r"/\*\s*token-guard:\s*on\b")

# A declaration line may carry a literal legitimately when it is inside a
# comment; strip block comments before scanning — but the guard markers are
# themselves comments, so they are read before stripping.
COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)

# a radius may be a corner list (`0 var(--radius) var(--radius) 0`) — every
# atom must be a token, a zero or a percentage
RADIUS_ATOM = r"(0|0px|\d+%|var\(--[\w-]+\)|inherit|initial|unset)"
RADIUS_OK = re.compile(rf"^{RADIUS_ATOM}(\s*/?\s*{RADIUS_ATOM})*$")
SHADOW_OK = re.compile(r"^(none|var\(--[\w-]+\)|inherit|initial|unset)$")
# the column, or "as wide as whatever contains me" — nothing else
WIDTH_OK = re.compile(r"^(100%|none|var\(--container-max\)|var\(--measure-statement\)"
                      r"|100vw|fit-content|max-content|min-content|inherit|initial|unset)$")


def scan(path: Path) -> tuple[list[tuple[int, str, str]], int]:
    """Return (violations, muted_lines) for `path`.

    `muted_lines` counts what the file's own `token-guard: off` regions cover,
    so a run can report how much it chose not to look at — a guard that goes
    quiet because everything was silenced must say so.
    """
    raw = path.read_text(encoding="utf-8")
    raw_lines = raw.splitlines()
    # blank out comments but keep line numbering intact
    stripped = COMMENT.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), raw)

    findings: list[tuple[int, str, str]] = []
    muted = 0
    off = False
    for n, (line, source) in enumerate(zip(stripped.splitlines(), raw_lines), 1):
        if GUARD_OFF.search(source):
            off = True
        elif GUARD_ON.search(source):
            off = False

        m = DECL.match(line)
        if not m:
            # a colour literal outside a declaration (e.g. an SVG attribute in
            # an .astro file) is not CSS — ignore it
            continue
        if off:
            muted += 1
            continue
        prop, value = m.group(1).lower(), m.group(2).strip()

        if prop == "border-radius":
            if not RADIUS_OK.match(value):
                findings.append((n, prop, f"{value!r} is not var(--radius…) or 0"))
        elif prop == "box-shadow":
            if not SHADOW_OK.match(value):
                findings.append((n, prop, f"{value!r} is not var(--shadow…) or none"))
        elif prop == "max-width":
            if not WIDTH_OK.match(value):
                findings.append((n, prop, f"{value!r} is a width of its own — a page has one "
                                          f"(var(--container-max)); use 100% inside a box"))

        # a literal inside `var(--token, …)` is a fallback, not a declaration
        for lit in COLOR_LITERAL.findall(VAR_FALLBACK.sub("", value)):
            findings.append((n, prop, f"colour literal {lit} — declare it in theme.css"))

    return findings, muted


def main() -> int:
    verbose = "--verbose" in sys.argv

    targets = sorted(
        [p for p in (ROOT / "src" / "styles").rglob("*.css") if p != TOKEN_FILE]
        + [p for p in (ROOT / "src").rglob("*.astro") if "<style" in p.read_text(encoding="utf-8")]
    )
    if not targets:
        print("✗ nothing to inspect — the scan found no stylesheets", file=sys.stderr)
        return 2

    total = 0
    muted_total = 0
    for path in targets:
        rel = str(path.relative_to(ROOT))
        findings, muted = scan(path)
        muted_total += muted
        for line_no, prop, reason in findings:
            print(f"✗ {rel}:{line_no}  {prop}: {reason}")
            total += 1
        if verbose:
            note = f" ({muted} declarations under token-guard: off)" if muted else ""
            print(f"  {'✗' if findings else 'ok'}   {rel}{note}")

    print(f"\nInspected {len(targets)} files against {TOKEN_FILE.relative_to(ROOT)}.")
    if muted_total:
        print(f"  {muted_total} declarations sat inside `token-guard: off` regions "
              f"(foreign chrome) and were not inspected.")
    if total:
        print(f"✗ {total} literal(s) outside the token file.")
        print("  Add the value to theme.css as a token and consume it, or — if the")
        print("  value belongs to a product being imitated, wrap that region in")
        print("  `/* token-guard: off — reason */ … /* token-guard: on */`.")
        return 1
    print("✓ colour, radius, shadow and width come from theme.css only.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
