#!/usr/bin/env python3
"""ci-check-citability.py — nobody non-citable gets named, and the guard proves it can tell (#347).

The previous version was six lines of shell with three holes, all of the same
family: from outside, a guard that finds nothing looks exactly like a guard
that cannot find anything.

  1. It exited 0 when FORBIDDEN_NAMES was absent, calling it "public mirror".
     Delete the secret, rotate it badly, rename it — and the guard passes
     forever, silently. The mirror is identified by its REPOSITORY, not by a
     missing secret, so that is what decides now: on the private repo an
     absent secret is a failure.

  2. Nothing proved the pattern could match. A broken regex, a name that
     changed shape (a name with an optional internal punctuation mark), a secret set to something
     that matches nothing — all indistinguishable from a clean tree. A
     positive control now runs first: a name from the secret is planted in a
     canary file and the scan MUST find it, plus a shape check that the secret
     was not truncated. What NO check inside CI can prove is that the secret
     still lists the RIGHT names — the control plants a name taken from that
     same secret, which is circular. That gap is real; it is bounded by the
     shape check and named here rather than papered over.

     The canary needed two passes before it matched production (2026-08-23).
     First: a per-name pattern written as "^Name$" or "\bName\b" plants as
     plain text with the anchor character or a literal "\b" still attached,
     which is not the anchor it represents — fixed by stripping them. Second,
     deeper: the real secret's FIRST alternative is itself fuzzy — shaped
     like `Word.?Word.?Word`, an any-char-optional construct for exactly the
     kind of shape-changing name real client lists carry. A fuzzy
     alternative's raw regex text is not text it matches, by construction, so
     no amount of anchor-stripping fixes it — the canary now scans every
     alternative for one that is plain (no backslash, no quantifier) and
     tests with that instead of blindly trusting the first.

  3. The list was negative; the policy (§13) is positive. Grepping for known
     bad names cannot catch a NEW client nobody thought to forbid. So the
     structured surface is checked the other way round: every reference entry
     must be a whitelisted name or a neutral placeholder.

What this still does not do, stated plainly rather than implied: it cannot
read free prose for an unknown company name. Hole 3 is closed for the
reference collection — where client names structurally live — not for every
sentence on the site.
"""

from __future__ import annotations

import json
import os
import re
import fnmatch
import subprocess
import tempfile
import zipfile
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIRROR_REPO = "julioarguello/serverstartup-io"

# §13, plus the #266 amendment. Names that MAY appear in public material.
WHITELIST = {
    "alcampo", "auchan", "forum-sport", "punt-roma", "jobandtalent",
    "inetum", "grupo-seidor",
}
# Neutral placeholders: a reference whose name must stay b64-at-rest.
NEUTRAL = re.compile(r"^[a-z]\d+$")

def tracked_files() -> list[str]:
    """What the repository actually publishes — and what the mirror copies.

    Scanning the working tree instead was wrong in both directions: locally it
    flags the gitignored private KB (docs/company/, which is SUPPOSED to hold
    those names), and in CI that directory does not exist, so the two
    environments disagreed about what the guard even means.
    """
    proc = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT,
                          capture_output=True, text=True, check=True)
    # Regular files only: the index also lists symlinks, and .claude/skills is
    # a symlink to a DIRECTORY (the .agent clone) — grep exits 2 on those,
    # which would abort the scan rather than report a violation.
    return [f for f in proc.stdout.split("\0")
            if f and (ROOT / f).is_file() and not (ROOT / f).is_symlink()]


def scan(pattern: str, files: list[str]) -> list[str]:
    """Tracked files containing the pattern. [] means none."""
    if not files:
        print("citability: DEAD GUARD — no files to scan", file=sys.stderr)
        sys.exit(1)
    proc = subprocess.run(["grep", "-IlE", pattern, "--", *files],
                          cwd=ROOT, capture_output=True, text=True)
    if proc.returncode not in (0, 1):  # 1 = no match; anything else is broken
        print(f"citability: grep failed (exit {proc.returncode}): "
              f"{proc.stderr.strip()[:200]}", file=sys.stderr)
        sys.exit(1)
    return [ln for ln in proc.stdout.splitlines() if ln.strip()]


# ── what the text scan cannot read on its own (#324) ────────────────────────
#
# `grep -I` stops at the first NUL byte and reports nothing — not a warning,
# not a count. On a PUBLIC repository whose one naming gate is this scan, that
# silence covered 125 of 414 tracked files. The issue measured it the honest
# way: three words provably inside a WordPress export were grepped for in the
# container, with and without -a, and returned zero. A positive control
# returning zero means the tool is blind, not that the tree is clean.
#
# Two answers, applied in order:
#   1. READ what can be read. OOXML documents (.docx and friends) are ZIP
#      containers holding XML; the text comes out with the standard library
#      alone. That is the 12 WordPress exports — including the legacy site's
#      own clients-and-references page, which is exactly where a non-citable
#      name would sit.
#   2. ACCOUNT for the rest. Anything still opaque must match a glob in
#      scripts/citability-opaque.txt with a written reason. An opaque file
#      nobody accounted for fails the gate, so the blind spot cannot grow back
#      quietly — which is how it got to 30 MB in the first place.

OPAQUE_LIST = ROOT / "scripts" / "citability-opaque.txt"

# ZIP-of-XML documents. The parts differ per format; the shape does not.
OOXML = {".docx", ".dotx", ".pptx", ".xlsx"}
OOXML_PARTS = re.compile(r"^(word/|ppt/slides/|xl/sharedStrings)", re.I)


def is_opaque(path: Path) -> bool:
    """Mirror grep's own heuristic: a NUL byte in the first block means binary.

    Deliberately grep's rule and not `file`'s MIME type — the question is not
    what a file IS, it is what the scan running beside this can SEE. The two
    disagree: an .svg is `image/svg+xml` to `file` and perfectly readable text
    to grep, and counting it as unreadable would pad this list with 27 files
    that were never a blind spot.
    """
    try:
        return b"\0" in path.read_bytes()[:8192]
    except OSError:
        return False


def ooxml_text(path: Path) -> str:
    """Readable text out of a ZIP-of-XML document. '' when it will not open."""
    try:
        with zipfile.ZipFile(path) as z:
            parts = [n for n in z.namelist()
                     if n.endswith(".xml") and OOXML_PARTS.match(n)]
            return " ".join(
                re.sub(r"<[^>]+>", " ", z.read(n).decode("utf-8", "replace"))
                for n in parts)
    except (zipfile.BadZipFile, KeyError, OSError):
        return ""


def opaque_rules() -> list[tuple[str, str]]:
    """(glob, reason) from the accounted-for list. Comment-only lines dropped."""
    out = []
    for raw in OPAQUE_LIST.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        glob, _, reason = line.partition("#")
        out.append((glob.strip(), reason.strip()))
    return out


def scan_containers(pattern: str, files: list[str]) -> list[str]:
    """Forbidden names inside documents grep skipped. Python re, not grep -E:
    the alternations in the secret are plain enough that the two agree, and
    shelling out per file to compare would buy nothing."""
    rx = re.compile(pattern)
    hits = []
    for f in files:
        p = ROOT / f
        if p.suffix.lower() in OOXML and rx.search(ooxml_text(p)):
            hits.append(f)
    return hits


def check_opaque(files: list[str]) -> int:
    """Every unreadable tracked file is either extracted above, or accounted for."""
    rules = opaque_rules()
    if not rules:
        print("citability: DEAD CHECK — scripts/citability-opaque.txt lists no "
              "rule, so every opaque file would be reported and nobody would "
              "read the output", file=sys.stderr)
        return 1

    opaque = [f for f in files
              if is_opaque(ROOT / f) and (ROOT / f).suffix.lower() not in OOXML]
    unaccounted = [f for f in opaque
                   if not any(fnmatch.fnmatch(f, g) for g, _ in rules)]
    if unaccounted:
        print(f"citability: {len(unaccounted)} tracked file(s) the scan cannot "
              "read and nobody has accounted for:", file=sys.stderr)
        for f in unaccounted[:20]:
            print(f"  {f}", file=sys.stderr)
        print("  → this repository is public and this scan is the only gate on "
              "who gets named in it.", file=sys.stderr)
        print("  → add a glob and a REASON to scripts/citability-opaque.txt, or "
              "remove the file. 'binary' is not a reason.", file=sys.stderr)
        return 1

    print(f"citability: {len(opaque)} unreadable file(s), all accounted for in "
          f"{OPAQUE_LIST.name} ({len(rules)} rules)")
    return 0


MIN_ALTERNATIVES = 3


def check_forbidden(pattern: str) -> int:
    files = tracked_files()

    # Shape check. The positive control below proves the SCAN works; it cannot
    # prove the SECRET still holds the real names, because it plants a name
    # taken from that same secret — circular by construction, and there is no
    # way around it from inside CI without keeping a second copy of the list.
    # What is checkable is that the secret was not truncated or overwritten
    # with junk: the policy names many non-citable clients, so a pattern with
    # fewer than a handful of alternatives is not that list any more.
    alternatives = [a for a in pattern.split("|") if a.strip()]
    if len(alternatives) < MIN_ALTERNATIVES:
        print(f"citability: FORBIDDEN_NAMES holds {len(alternatives)} "
              f"alternative(s); the policy names many more.", file=sys.stderr)
        print("  A truncated or overwritten secret scans clean and proves "
              "nothing. Check the repository secret.", file=sys.stderr)
        return 1

    # ── positive control: the scan must be able to find something ──
    # Two earlier attempts failed against the real secret. A structural
    # diagnostic (letters->X, digits->9, everything else untouched — printed
    # nothing that could be turned back into a name) showed why: of 24
    # alternatives, one is deliberately FUZZY — something shaped like
    # `Name.?N.?ame`, an any-char-optional construct for matching a name
    # whose real-world spelling varies by a punctuation mark (the classic
    # any-char-optional shape-changing case the module docstring already
    # names). A fuzzy alternative's raw regex text is not text it matches —
    # that is the whole point of writing it that way — so planting it
    # literally can never self-match, by design, regardless of anchor
    # handling. The other 23 alternatives are plain text.
    #
    # So: pick an alternative to test, don't just take the first one. A
    # "clean" alternative — after stripping ^, $, \b anchors — has no
    # backslash and no quantifier (the constructs that make raw regex text
    # diverge from matched text); anything else about it is just letters,
    # digits, spaces and ordinary punctuation, safe to plant as-is.
    UNSAFE = re.compile(r"[\\?*+{}]")
    core = None
    for alt in alternatives:
        candidate = re.sub(r"^(\^|\\b)+", "", alt)
        candidate = re.sub(r"(\$|\\b)+$", "", candidate).strip()
        if candidate and not UNSAFE.search(candidate):
            core = candidate
            break
    if core is None:
        print("citability: every alternative in FORBIDDEN_NAMES uses a "
              "backslash or a quantifier — none is safe to plant as a "
              "literal positive control. Add one plain-text alternative, "
              "or extend this script's canary construction.", file=sys.stderr)
        return 1

    canary = ROOT / ".citability-canary.tmp"
    try:
        canary.write_text(f"{core}\ncontext {core} context\n", encoding="utf-8")
        if not scan(pattern, [canary.name]):
            print("citability: DEAD GUARD — the pattern did not match a file "
                  "containing one of its own plain-text alternatives (tried "
                  "bare and padded). The secret's regex cannot match "
                  "anything, so a clean result would prove nothing.",
                  file=sys.stderr)
            return 1
    finally:
        canary.unlink(missing_ok=True)
    print("citability: positive control ok (the scan can find a planted name)")

    # ── second control: the container path (#324) ──
    # The extractor is the whole reason 12 documents stopped being invisible,
    # so a green from it has to be earned the same way. The fixture is a real
    # .docx built here, in a temp directory — never in the tree, because a
    # canary in the tree trips the guard it exists to prove (#347).
    with tempfile.TemporaryDirectory() as tmp:
        doc = Path(tmp) / "canary.docx"
        with zipfile.ZipFile(doc, "w") as z:
            z.writestr("word/document.xml",
                       '<?xml version="1.0"?><w:document xmlns:w="x"><w:p><w:r>'
                       f'<w:t>{core}</w:t></w:r></w:p></w:document>')
        text = ooxml_text(doc)
        if core not in text:
            print("citability: DEAD GUARD — a name planted inside a .docx was "
                  "not recovered by the extractor, so the 12 documents it "
                  "claims to read are being scanned as an empty string.",
                  file=sys.stderr)
            return 1
        if is_opaque(doc) is False:
            print("citability: DEAD GUARD — a real .docx did not read as "
                  "opaque, so is_opaque() no longer selects the files the "
                  "extractor exists for.", file=sys.stderr)
            return 1
    print("citability: positive control ok (a name planted inside a .docx is "
          "recovered, and .docx still reads as opaque)")

    print(f"citability: scanning {len(files)} tracked files")
    hits = scan(pattern, files)
    contained = scan_containers(pattern, files)
    if contained:
        print(f"citability: and {len(contained)} inside documents grep skips",
              file=sys.stderr)
    if hits or contained:
        print("citability: forbidden name found in the tree:", file=sys.stderr)
        for h in [*hits, *contained][:20]:
            print(f"  {h}", file=sys.stderr)
        return 1
    print(f"citability: no forbidden name in the tree "
          f"(text, plus the text inside every OOXML document)")
    return 0


def check_whitelist() -> int:
    """The inverse check: everything the seed names must be allowed to be named."""
    seed = json.loads((ROOT / "seed" / "seed.json").read_text(encoding="utf-8"))
    refs = seed.get("content", {}).get("references", [])
    if not refs:
        print("citability: DEAD CHECK — the seed declares no references; "
              "this check cannot see anything", file=sys.stderr)
        return 1
    bad = []
    for r in refs:
        slug = (r.get("slug") or "").strip()
        if slug in WHITELIST or NEUTRAL.match(slug):
            continue
        bad.append(slug or "<no slug>")
    if bad:
        print("citability: reference entries name something the whitelist does "
              "not allow:", file=sys.stderr)
        for b in bad:
            print(f"  {b}", file=sys.stderr)
        print("  → §13 lists who may be named publicly. A client outside it "
              "goes in with a neutral slug (c1, t1…) and its name b64-at-rest.",
              file=sys.stderr)
        return 1
    print(f"citability: all {len(refs)} reference entries are whitelisted or neutral")
    return 0


def main() -> int:
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pattern = os.environ.get("FORBIDDEN_NAMES", "")

    # check_opaque runs everywhere, mirror included: it needs no secret, and
    # the mirror is precisely the tree whose unreadable files are published to
    # strangers. Called at the return sites so its output lands after the
    # scans it qualifies, rather than above them.
    if repo == MIRROR_REPO:
        print(f"citability: running on the public mirror ({repo}) — the secret "
              "does not exist there by design; skipping the forbidden-name scan")
        return check_whitelist() | check_opaque(tracked_files())

    if not pattern:
        # The observed fact and where to look — never a guessed cause.
        print("citability: FORBIDDEN_NAMES is empty or unset, and this is not "
              f"the public mirror (GITHUB_REPOSITORY={repo or '<unset>'}).",
              file=sys.stderr)
        print("  Refusing to pass: an absent secret and a clean tree produce "
              "the same green, and only one of them is safe.", file=sys.stderr)
        print("  Check the repository secret FORBIDDEN_NAMES.", file=sys.stderr)
        return 1

    return (check_forbidden(pattern) | check_whitelist()
            | check_opaque(tracked_files()))


if __name__ == "__main__":
    sys.exit(main())
