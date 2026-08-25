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

Positive control (#385)
-----------------------
Both checks run first over a throwaway template of the gate's own making,
carrying one planted defect of each shape. A regex that stops matching — a new
attribute spelling, a changed `labels.get` signature, a frontmatter fence
parsed differently — would otherwise leave this printing "cms-text: clean"
over templates it is no longer reading. The fixture lives in a temp directory,
never in `src/`, so it cannot be found by the real scan nor trip the gate.

Exit 0 = clean. Exit 1 = findings, each printed as file:line: reason.
Exit 3 = the gate is blind: it can no longer find what it exists to find.
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "seed" / "seed.json"
ALLOWLIST = ROOT / "scripts" / "cms-text-allowlist.txt"
LOCALE_AREAS = ("ui_labels_es", "ui_labels_en")

findings: list[str] = []


def fail(path: Path, line: int, reason: str) -> None:
    # The positive control's fixture lives outside ROOT on purpose, so a path
    # that cannot be made relative reports itself whole rather than aborting.
    try:
        where = path.relative_to(ROOT)
    except ValueError:
        where = path
    findings.append(f"{where}:{line}: {reason}")


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

# ── positive control ────────────────────────────────────────────────────────

# A template carrying one planted defect per shape the lint claims to catch,
# plus the three shapes it must NOT flag: a CMS-wired attribute whose key is
# real (`author` exists in both locale areas — so this line also proves the
# seed parse still finds keys), an ORed settings lookup, and a comment.
CONTROL_ASTRO = """---
const canary = 1;
---
<button aria-label="canario sin CMS">x</button>
<p>Texto duro que nadie ha pasado por el CMS</p>
<p>{labels.get("ui_labels", "__canary_key_that_is_not_in_the_seed__", "ok")}</p>
<img src="/x.png" alt={t("author")} />
<span>{settings.phone || "+34"}</span>
<!-- comentario con palabras, que no cuenta -->
"""

CONTROL_EXPECTED = (
    ('hardcoded aria-label: "canario sin CMS"', "the aria-label/alt/placeholder/title lint"),
    ('hardcoded text node: "Texto duro que nadie ha pasado por el CMS"', "the text-node lint"),
    ('label "ui_labels:__canary_key_that_is_not_in_the_seed__" missing from ui_labels_es',
     "label integrity against seed/seed.json"),
)


def positive_control() -> int:
    """Prove both checks can still see their defects. 0 = sighted, 3 = blind."""
    global findings
    real, findings = findings, []
    try:
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Path(tmp) / "canary.astro"
            fixture.write_text(CONTROL_ASTRO, encoding="utf-8")
            check_labels([fixture])
            check_hardcoded([fixture])
            planted = findings
    finally:
        findings = real

    blind = [what for expected, what in CONTROL_EXPECTED
             if not any(expected in f for f in planted)]
    # The fixture's last four lines are legal: a CMS-wired alt, an ORed
    # settings lookup, a comment. Anything reported there is a false positive.
    noise = [f for f in planted if "author" in f or "+34" in f or "comentario" in f]

    if blind or noise:
        print("cms-text: THIS GATE IS BLIND — a clean result proves nothing:", file=sys.stderr)
        for b in blind:
            print(f"    {b} found none of its planted defects", file=sys.stderr)
        for n in noise:
            print(f"    reported legal, CMS-wired markup: {n}", file=sys.stderr)
        print("  → a pattern stopped matching (attribute list, labels.get "
              "signature, frontmatter fence); fix it before trusting a green run.",
              file=sys.stderr)
        return 3
    return 0


def main() -> int:
    blind = positive_control()
    if blind:
        return blind

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
    print(f"cms-text: clean (labels resolve in both locales; no hardcoded template "
          f"text) — {len(CONTROL_EXPECTED)} planted defects found first, so the scan is "
          f"not blind")
    return 0


if __name__ == "__main__":
    sys.exit(main())
