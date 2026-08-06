#!/usr/bin/env python3
# AUTO-GENERATED — DO NOT EDIT MANUALLY
"""Sync live CMS service entries back into seed/seed.json.

Why: seed/seed.json must be the complete, canonical text corpus — a clean
rebuild from seeds alone must reproduce every text on the site. Service copy
is authored in seed/content/services/*.md and loaded into the live CMS (which
converts markdown to Portable Text server-side). This script closes the loop:
it reads the converted entries from the local D1 database and splices them
into the matching svc-* entries of seed.json, preserving the file's tab
formatting so diffs stay minimal.

Usage: run AFTER load-content.sh has pushed the latest markdown:
    python3 scripts/seed-sync-services.py

Requires: a seeded local D1 (dev server may be running; reads are safe).
"""
import json
import subprocess
import sys

SEED = "seed/seed.json"


def find_d1() -> str:
    out = subprocess.run(
        ["find", ".wrangler", "-name", "*.sqlite", "-path", "*/d1/*",
         "-not", "-name", "metadata.sqlite"],
        capture_output=True, text=True,
    ).stdout.strip().split("\n")
    if not out or not out[0]:
        sys.exit("No local D1 database found — run `npx emdash dev` first.")
    return out[0]


def fetch_services(db: str) -> dict:
    import sqlite3  # stdlib — the system sqlite3 CLI (3.28) predates -json
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "SELECT slug, locale, title, excerpt, cta_label, color, content "
        "FROM ec_services WHERE deleted_at IS NULL;"
    ).fetchall()
    con.close()
    return {(r["slug"], r["locale"] or "es"): dict(r) for r in rows}


def main() -> None:
    db = find_d1()
    live = fetch_services(db)
    if not live:
        sys.exit("ec_services returned no rows — is the database seeded?")

    seed = json.load(open(SEED))
    lines = open(SEED).read().split("\n")
    synced, missing = [], []

    for entry in seed["content"]["services"]:
        key = (entry["slug"], entry.get("locale") or "es")
        row = live.get(key)
        if not row:
            missing.append(entry["id"])
            continue
        data = {
            "title": row["title"],
            "excerpt": row["excerpt"] or "",
            "cta_label": row["cta_label"] or "",
            "content": json.loads(row["content"]) if row["content"] else [],
        }
        if row.get("color"):
            data["color"] = row["color"]

        i0 = next(i for i, l in enumerate(lines) if f'"id": "{entry["id"]}"' in l)
        i_d = next(i for i in range(i0, i0 + 12) if lines[i] == '\t\t\t\t"data": {')
        i_close = next(i for i in range(i_d + 1, len(lines))
                       if lines[i].startswith('\t\t\t\t}')
                       and not lines[i].startswith('\t\t\t\t\t'))
        dumped = json.dumps(data, ensure_ascii=False, indent="\t").split("\n")
        block = ['\t\t\t\t"data": ' + dumped[0]] + ['\t\t\t\t' + l for l in dumped[1:]]
        if lines[i_close].rstrip().endswith(","):
            block[-1] += ","
        lines[i_d:i_close + 1] = block
        synced.append(entry["id"])

    open(SEED, "w").write("\n".join(lines))
    json.load(open(SEED))  # hard fail if the splice broke the file
    print(f"synced {len(synced)}: {', '.join(synced)}")
    if missing:
        print(f"NOT in CMS (left untouched): {', '.join(missing)}")


if __name__ == "__main__":
    main()
