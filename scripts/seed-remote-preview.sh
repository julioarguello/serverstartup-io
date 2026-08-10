#!/usr/bin/env bash
# seed-remote-preview.sh — reproduce seed/seed.json onto a REMOTE D1, idempotently.
#
# Route (each step earned in rehearsal, 2026-08-07/08):
#   1. Seed a LOCAL sqlite the canonical way (emdash seed applies the 33
#      migrations itself; server must be down — FTS corruption rule).
#   2. DATA-ONLY refresh: per real table, DELETE FROM + INSERT rows. Replaying
#      CREATEs breaks on a previously-seeded remote (UNIQUE on
#      _emdash_migrations was the first casualty), and a whole-db .dump writes
#      sqlite_schema for the FTS5 virtual tables, which D1 rejects. Schema is
#      migrations' job, not ours — we only move content.
#      (_emdash_migrations, _cf_METADATA, sqlite_% and FTS shadows excluded.)
#   3. Append FTS 'rebuild' inserts (regenerated from sqlite_master, never
#      speculative — a rebuild for a missing table rolls back the whole file).
#   4. Rehearse the SQL on a COPY of the local sqlite BEFORE touching remote.
#   5. Apply to the remote database and verify a count.
#
# Usage: scripts/seed-remote-preview.sh [d1-name]   (default www-serverstartup-io-preview)
set -euo pipefail

D1_NAME="${1:-www-serverstartup-io-preview}"
WORK="${RUNNER_TEMP:-/tmp}/preview-seed"
mkdir -p "$WORK"

D1_DB=$(find .wrangler -name "*.sqlite" -path "*/d1/*" -not -name "metadata.sqlite" | head -1)
[ -n "$D1_DB" ] || { echo "ERROR: no local seeded D1 sqlite (run scripts/ci-local-stack.sh first)" >&2; exit 1; }

SQL="$WORK/seed.sql"
: > "$SQL"
sqlite3 "$D1_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\_emdash\_fts\_%' ESCAPE '\' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA','_emdash_migrations');" |
while read -r t; do
	echo "DELETE FROM \"$t\";" >> "$SQL"
	sqlite3 "$D1_DB" ".mode insert \"$t\"" "SELECT * FROM \"$t\";" >> "$SQL"
done
sqlite3 "$D1_DB" "SELECT 'INSERT INTO ' || name || '(' || name || ') VALUES(''rebuild'');' FROM sqlite_master WHERE sql LIKE 'CREATE VIRTUAL TABLE%';" >> "$SQL"

# Rehearse on a copy of the local database (schema present, data replaced).
# trusted_schema=ON: the pages FTS triggers write into the virtual table on
# every ec_pages insert, which modern sqlite3 CLIs reject as "unsafe" under
# their default untrusted-schema policy — it is our own schema, and remote
# D1 executes the same statements through its own engine without complaint.
cp "$D1_DB" "$WORK/rehearsal.sqlite"
sqlite3 -cmd "PRAGMA trusted_schema=ON;" "$WORK/rehearsal.sqlite" < "$SQL"
PAGES_LOCAL=$(sqlite3 "$WORK/rehearsal.sqlite" "SELECT count(*) FROM ec_pages;")
[ "$PAGES_LOCAL" -gt 0 ] || { echo "ERROR: rehearsal produced 0 pages" >&2; exit 1; }

npx wrangler d1 execute "$D1_NAME" --remote --file "$SQL" -y >/dev/null
PAGES_REMOTE=$(npx wrangler d1 execute "$D1_NAME" --remote --command "SELECT count(*) AS c FROM ec_pages;" -y 2>/dev/null | grep -oE '"c": [0-9]+' | grep -oE '[0-9]+')
echo "remote $D1_NAME refreshed: $PAGES_REMOTE pages (rehearsal had $PAGES_LOCAL)"
[ "$PAGES_REMOTE" = "$PAGES_LOCAL" ]
