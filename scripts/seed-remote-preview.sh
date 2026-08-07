#!/usr/bin/env bash
# seed-remote-preview.sh — reproduce seed/seed.json onto the REMOTE preview D1.
#
# Route (each step earned in rehearsal, 2026-08-07):
#   1. Seed a LOCAL sqlite the canonical way (emdash seed applies the 33
#      migrations itself; server must be down — FTS corruption rule).
#   2. Per-table dump of REAL tables only. A whole-db .dump restores FTS5
#      virtual tables by writing sqlite_schema directly (writable_schema),
#      which D1 rejects; FTS shadow tables travel the same forbidden path.
#      (Local sqlite3 is 3.28: one LIKE pattern per .dump call, hence the loop.)
#   3. Append explicit CREATE VIRTUAL TABLE statements + FTS 'rebuild' inserts.
#   4. Rehearse the SQL on a throwaway sqlite BEFORE touching remote.
#   5. Apply to the remote preview database and verify a count.
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
sqlite3 "$D1_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\_emdash\_fts\_%' ESCAPE '\' AND name NOT LIKE 'sqlite_%' AND name != '_cf_METADATA';" |
while read -r t; do
	sqlite3 "$D1_DB" ".dump '$t'" | grep -vE "^PRAGMA|^BEGIN TRANSACTION;|^COMMIT;" >> "$SQL"
done
sqlite3 "$D1_DB" "SELECT sql || ';' FROM sqlite_master WHERE sql LIKE 'CREATE VIRTUAL TABLE%';" >> "$SQL"
sqlite3 "$D1_DB" "SELECT 'INSERT INTO ' || name || '(' || name || ') VALUES(''rebuild'');' FROM sqlite_master WHERE sql LIKE 'CREATE VIRTUAL TABLE%';" >> "$SQL"

# Rehearse before remote (a guard that only runs remotely is a dead guard).
rm -f "$WORK/throwaway.sqlite"
sqlite3 "$WORK/throwaway.sqlite" < "$SQL"
PAGES_LOCAL=$(sqlite3 "$WORK/throwaway.sqlite" "SELECT count(*) FROM ec_pages;")
[ "$PAGES_LOCAL" -gt 0 ] || { echo "ERROR: rehearsal produced 0 pages" >&2; exit 1; }

npx wrangler d1 execute "$D1_NAME" --remote --file "$SQL" -y >/dev/null
PAGES_REMOTE=$(npx wrangler d1 execute "$D1_NAME" --remote --command "SELECT count(*) AS c FROM ec_pages;" -y 2>/dev/null | grep -oE '"c": [0-9]+' | grep -oE '[0-9]+')
echo "remote $D1_NAME seeded: $PAGES_REMOTE pages (rehearsal had $PAGES_LOCAL)"
[ "$PAGES_REMOTE" = "$PAGES_LOCAL" ]
