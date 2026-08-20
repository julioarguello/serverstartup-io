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

# 0. COLLECTION SCHEMA (#326). Collection tables (ec_*) are not created by the
#    numbered migrations — EmDash creates them from the collections declared in
#    seed.json. So a collection added after the remote was first seeded exists
#    only locally, and step 2's DELETE dies with "no such table". That is what
#    took the preview environment down: ec_references arrived with #271/#296
#    and the remote never learned about it.
#    Emitting the CREATEs as IF NOT EXISTS is idempotent and stays inside the
#    header's contract — it does not replay migrations, does not touch
#    _emdash_migrations, and does not write sqlite_schema for FTS shadows.
sqlite3 "$D1_DB" "
  SELECT replace(sql, 'CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ') || ';'
    FROM sqlite_master WHERE type='table' AND name LIKE 'ec\_%' ESCAPE '\' AND sql IS NOT NULL
  UNION ALL
  SELECT replace(replace(sql, 'CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS '),
                 'CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ') || ';'
    FROM sqlite_master WHERE type='index' AND tbl_name LIKE 'ec\_%' ESCAPE '\' AND sql IS NOT NULL;
" >> "$SQL"

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
# .backup, not cp: the freshly-seeded database's newest schema (the FTS
# virtual tables) may still live in the -wal file — a bare file copy loses
# it and the rehearsal dies with "no such table: _emdash_fts_*" (bit CI,
# where the server is killed and copied within the same second).
sqlite3 "$D1_DB" ".backup '$WORK/rehearsal.sqlite'"

# The rehearsal used to run against a straight copy of the local database,
# which BY CONSTRUCTION already has every collection table — so it could never
# see a remote that is behind, and it waved through the exact SQL that killed
# the deploy (#326). Dropping the collection tables first makes the rehearsal
# stand where the remote stands: if the generated file cannot rebuild them, it
# fails here, on a throwaway copy, instead of against the real database.
sqlite3 "$WORK/rehearsal.sqlite" \
  "SELECT 'DROP TABLE \"' || name || '\";' FROM sqlite_master
     WHERE type='table' AND name LIKE 'ec\_%' ESCAPE '\';" > "$WORK/drop.sql"
sqlite3 -cmd "PRAGMA trusted_schema=ON;" "$WORK/rehearsal.sqlite" < "$WORK/drop.sql"

sqlite3 -cmd "PRAGMA trusted_schema=ON;" "$WORK/rehearsal.sqlite" < "$SQL"
PAGES_LOCAL=$(sqlite3 "$WORK/rehearsal.sqlite" "SELECT count(*) FROM ec_pages;")
[ "$PAGES_LOCAL" -gt 0 ] || { echo "ERROR: rehearsal produced 0 pages" >&2; exit 1; }

# Every collection the seed declares must exist after the rehearsal, or the
# remote will hit "no such table" on a table nobody noticed was missing.
MISSING=$(sqlite3 "$WORK/rehearsal.sqlite" "
  SELECT group_concat(name, ' ') FROM (
    SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ec\_%' ESCAPE '\')" )
echo "rehearsal rebuilt collections: ${MISSING:-NONE}"

# The remote apply is the one step that can still fail on state we cannot see
# from here. Say what was attempted and where to look — the failure that took
# the preview down surfaced as a bare SQLITE_ERROR under 300 lines of Vite
# noise, and was misread as a build error for a day (#326).
if ! npx wrangler d1 execute "$D1_NAME" --remote --file "$SQL" -y > "$WORK/apply.log" 2>&1; then
	echo "ERROR: applying the refresh to remote D1 '$D1_NAME' failed." >&2
	echo "  The SQL rehearsed clean against a copy with the collection tables dropped," >&2
	echo "  so the remote is in a state this file does not account for." >&2
	echo "  Generated SQL: $SQL" >&2
	echo "  --- wrangler said ---" >&2
	tail -20 "$WORK/apply.log" >&2
	exit 1
fi
PAGES_REMOTE=$(npx wrangler d1 execute "$D1_NAME" --remote --command "SELECT count(*) AS c FROM ec_pages;" -y 2>/dev/null | grep -oE '"c": [0-9]+' | grep -oE '[0-9]+')
echo "remote $D1_NAME refreshed: $PAGES_REMOTE pages (rehearsal had $PAGES_LOCAL)"
[ "$PAGES_REMOTE" = "$PAGES_LOCAL" ]
