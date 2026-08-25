#!/usr/bin/env python3
"""Sync live CMS entries back into seed/seed.json.

Why: seed/seed.json must be the complete, canonical text corpus — a clean
rebuild from seeds alone must reproduce every text on the site. Copy is
authored in seed/content/<collection>/<locale>/*.md and loaded into the live
CMS (which converts markdown to Portable Text server-side, link markDefs
included). This script closes the loop: it reads the converted entries from
the local D1 database and splices them into the matching entries of seed.json,
preserving the file's tab formatting so diffs stay minimal.

Any collection, not just services (#305): `pages` needed the same round trip
the moment its copy grew links, and hand-forging markDefs in JSON is how two
locale mix-ups reached the tree in one week. The fields written back are the
ones the seed entry ALREADY declares, intersected with the table's real
columns — no hardcoded field list to drift.

Usage: run AFTER load-content.sh has pushed the latest markdown:
    python3 scripts/seed-sync-services.py [collection ...]   # default: services

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


def fetch(db: str, collection: str) -> tuple[dict, set]:
    import sqlite3  # stdlib — the system sqlite3 CLI (3.28) predates -json
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    table = f"ec_{collection}"
    try:
        cols = {r["name"] for r in con.execute(f"PRAGMA table_info({table});")}
    except sqlite3.Error as exc:
        sys.exit(f"{table}: {exc}")
    if not cols:
        sys.exit(f"{table} does not exist — is the database seeded?")
    rows = con.execute(
        f"SELECT * FROM {table} WHERE deleted_at IS NULL;"
    ).fetchall()
    con.close()
    return {(r["slug"], r["locale"] or "es"): dict(r) for r in rows}, cols


def sync(collection: str, db: str) -> tuple[list, list]:
    live, cols = fetch(db, collection)
    if not live:
        sys.exit(f"ec_{collection} returned no rows — is the database seeded?")

    seed = json.load(open(SEED))
    if collection not in seed["content"]:
        sys.exit(f"seed.json has no content.{collection}")
    lines = open(SEED).read().split("\n")
    synced, missing = [], []

    for entry in seed["content"][collection]:
        key = (entry["slug"], entry.get("locale") or "es")
        row = live.get(key)
        if not row:
            missing.append(entry["id"])
            continue

        # The seed entry declares which fields this collection carries; the
        # table says which of them the CMS actually stores. Writing back their
        # intersection means a new field is picked up by declaring it once, in
        # the seed, instead of in a list here that nobody re-reads.
        data = {}
        for field in entry["data"]:
            if field not in cols:
                data[field] = entry["data"][field]  # not CMS-backed: keep as is
                continue
            value = row[field]
            if field == "content":
                data[field] = json.loads(value) if value else []
            elif value is None:
                # An absent optional field must not become the string "None",
                # and must not be invented either — keep what the seed had.
                if field in entry["data"]:
                    data[field] = entry["data"][field]
            else:
                data[field] = value

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
    return synced, missing


def main() -> None:
    collections = sys.argv[1:] or ["services"]
    db = find_d1()
    for collection in collections:
        synced, missing = sync(collection, db)
        print(f"{collection}: synced {len(synced)}: {', '.join(synced)}")
        if missing:
            print(f"{collection}: NOT in CMS (left untouched): {', '.join(missing)}")


if __name__ == "__main__":
    main()
