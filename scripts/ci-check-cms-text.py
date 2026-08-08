#!/usr/bin/env python3
"""ci-check-cms-text.py — CMS text integrity gate (#209).

Two static checks, no server needed:

A. Label integrity — every label key the templates use must exist in BOTH
   locale widget areas of seed/seed.json, and the areas must have key parity.
   Catches the #207 class forever: a key that only lives as a code fallback.

B. Hardcoded text lint — user-visible literals in .astro templates (JSX text
   nodes and aria-label/alt/placeholder/title attributes) must be CMS-wired.
   The versioned allowlist (scripts/cms-text-allowlist.txt) carries the
   instrument graphics' own syntax (SQL keywords, Javadoc tags, wordmark…).
   Fallback literals passed to labels.get()/L()/t() or ORed after a CMS/
   settings lookup are legal by design: they mirror the CMS, not replace it.

Exit 0 = clean. Exit 1 = findings, each printed as file:line: reason.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "seed" / "seed.json"
ALLOWLIST = ROOT / "scripts" / "cms-text-allowlist.txt"
LOCALE_AREAS = ("ui_labels_es", "ui_labels_en")

findings: list[str] = []


def fail(path: Path, line: int, reason: str) -> None:
    findings.append(f"{path.relative_to(ROOT)}:{line}: {reason}")


# ── inputs ──────────────────────────────────────────────────────────────────

def seed_areas() -> dict[str, dict[str, set[str]]]:
    seed = json.loads(SEED.read_text())
    areas: dict[str, dict[str, set[str]]] = {}
    for area in seed["widgetAreas"]:
        name = area.get("name") or area.get("id") or ""
        titles: dict[str, set[str]] = {}
        for widget in area.get("widgets", []):
            keys = {b.get("_key") for b in (widget.get("content") or [])
                    if isinstance(b, dict) and b.get("_key")}
            titles.setdefault(widget.get("title", ""), set()).update(keys)
        areas[name] = titles
    return areas


def allowlist() -> set[str]:
    entries = set()
    for line in ALLOWLIST.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            entries.add(line)
    return entries


# ── check A: label integrity ────────────────────────────────────────────────

def check_labels(sources: list[Path]) -> None:
    areas = seed_areas()
    used: dict[tuple[str, str], tuple[Path, int]] = {}
    for f in sources:
        text = f.read_text()
        alias = re.search(
            r'const (\w+) = \(k: string, fb: string\) => labels\.get\("([^"]+)"', text)
        for i, line in enumerate(text.splitlines(), 1):
            for m in re.finditer(r'labels\.get\(\s*"([^"]+)"\s*,\s*"([^"]+)"', line):
                used[(m.group(1), m.group(2))] = (f, i)
            if alias:
                for m in re.finditer(rf'\b{alias.group(1)}\(\s*"([^"]+)"', line):
                    used[(alias.group(2), m.group(1))] = (f, i)
            # t("key") — aria_labels via middleware; skip t(...) with params var
            for m in re.finditer(r'\bt\(\s*"([^"]+)"', line):
                used[("aria_labels", m.group(1))] = (f, i)

    for (widget, key), (f, i) in sorted(used.items()):
        for area in LOCALE_AREAS:
            if key not in areas.get(area, {}).get(widget, set()):
                fail(f, i, f'label "{widget}:{key}" missing from {area} in seed/seed.json')

    es, en = (areas.get(a, {}) for a in LOCALE_AREAS)
    for widget in set(es) | set(en):
        for only, where in ((es.get(widget, set()) - en.get(widget, set()), "ui_labels_en"),
                            (en.get(widget, set()) - es.get(widget, set()), "ui_labels_es")):
            for key in sorted(only):
                fail(SEED, 1, f'parity: "{widget}:{key}" missing from {where}')


# ── check B: hardcoded text lint ────────────────────────────────────────────

WORD = re.compile(r"[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]{2,}")
ENTITY = re.compile(r"&[a-z]+;|&#\d+;")
CMS_WIRED = re.compile(r"labels\.get\(|\bL\(|\bt\(|settings\.|\|\|")


def has_words(value: str) -> bool:
    """True if the string carries real words once HTML entities are stripped."""
    return bool(WORD.search(ENTITY.sub(" ", value)))


def template_of(text: str) -> tuple[int, str]:
    """Return (line offset, template part) — skip the frontmatter fence."""
    parts = text.split("---", 2)
    if len(parts) >= 3:
        head = parts[0] + "---" + parts[1] + "---"
        return head.count("\n"), parts[2]
    return 0, text


def check_hardcoded(templates: list[Path]) -> None:
    allowed = allowlist()
    for f in templates:
        offset, tpl = template_of(f.read_text())
        for i, line in enumerate(tpl.splitlines(), offset + 1):
            s = line.strip()
            if s.startswith("<!--") or s.startswith("//") or s.startswith("*"):
                continue
            wired = bool(CMS_WIRED.search(s))
            for m in re.finditer(
                    r'(aria-label|alt|placeholder|title)="([^"{][^"]*)"', s):
                value = m.group(2)
                if has_words(value) and value not in allowed and not wired:
                    fail(f, i, f'hardcoded {m.group(1)}: "{value[:60]}"')
            for m in re.finditer(r">([^<>{}]+)<", s):
                value = m.group(1).strip()
                if has_words(value) and value not in allowed and not wired:
                    fail(f, i, f'hardcoded text node: "{value[:60]}"')


# ── main ────────────────────────────────────────────────────────────────────

def main() -> int:
    src = ROOT / "src"
    sources = sorted(src.rglob("*.astro")) + sorted(src.rglob("*.ts"))
    templates = sorted(src.rglob("*.astro"))
    check_labels(sources)
    check_hardcoded(templates)
    if findings:
        for f in findings:
            print(f, file=sys.stderr)
        print(f"cms-text: {len(findings)} finding(s)", file=sys.stderr)
        return 1
    print("cms-text: clean (labels resolve in both locales; no hardcoded template text)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
