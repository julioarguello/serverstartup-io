#!/usr/bin/env python3
"""ci-check-cache-hints.py — cache.set() only where it reaches the headers (#357).

Astro streams HTML: a page's response headers are finalized after PAGE
frontmatter and middleware run, but BEFORE child components and layouts
render. A `cache.set()` inside a component or layout executes mid-stream and
is silently dropped — the home served cf-cache-status BYPASS for exactly this
reason until the verify-purge E2E caught it (2026-08-23), and Base.astro
carried two hints that never reached the edge.

Allowed locations:
  - src/pages/**           (page/endpoint frontmatter runs pre-response)
  - src/middleware.ts      (post-next() but pre-applyCacheHeaders — measured)

Anything else fails the gate, with file:line evidence.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
ALLOWED_DIRS = (SRC / "pages",)
ALLOWED_FILES = (SRC / "middleware.ts",)
PATTERN = re.compile(r"\bcache\.set\s*\(")

def allowed(path: Path) -> bool:
    if path in ALLOWED_FILES:
        return True
    return any(d in path.parents for d in ALLOWED_DIRS)

def main() -> int:
    violations: list[str] = []
    scanned = 0
    hits_in_allowed = 0
    for path in sorted(SRC.rglob("*")):
        if path.suffix not in {".astro", ".ts", ".tsx", ".mjs"}:
            continue
        scanned += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        for i, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith(("//", "*", "/*")):
                continue  # prose about cache.set is fine; calls are not
            if PATTERN.search(line):
                if allowed(path):
                    hits_in_allowed += 1
                else:
                    violations.append(f"{path.relative_to(ROOT)}:{i}: {stripped[:90]}")

    # Positive control: the gate must SEE the legitimate call sites. If it
    # finds none, the pattern or the tree moved and this check is dead.
    if hits_in_allowed == 0:
        print("cache-hints: DEAD GATE — found zero cache.set calls in allowed "
              "locations; the pattern or layout changed", file=sys.stderr)
        return 1

    if violations:
        print("cache-hints: cache.set() outside page frontmatter / middleware "
              "is dropped mid-stream and never reaches the edge:", file=sys.stderr)
        for v in violations:
            print(f"  {v}", file=sys.stderr)
        print("  → move the hint to the consuming page's frontmatter, or to "
              "src/middleware.ts if it is site-wide (footer data).", file=sys.stderr)
        return 1

    print(f"cache-hints: clean ({scanned} files scanned, "
          f"{hits_in_allowed} hint calls in allowed locations)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
