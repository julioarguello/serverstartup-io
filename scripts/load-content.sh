#!/usr/bin/env bash
# EmDash Content Loader — syncs markdown files into EmDash CMS via CLI.
#
# Usage:
#   ./scripts/load-content.sh <collection> [--dry-run] [--port N | --url URL]
#
# Examples:
#   ./scripts/load-content.sh services              # Load all services (ES + EN)
#   ./scripts/load-content.sh services --dry-run    # Preview only
#   ./scripts/load-content.sh services --port 8263  # A parallel session's stack
#
# The CMS URL defaults to http://localhost:4321 (the EmDash CLI default).
# Parallel sessions run their stack on 8000 + issue number, and pointing the
# loader at the wrong port used to surface as "entry not found in CMS" — a
# connection problem wearing a content problem's message.
#
# Prerequisites:
#   - EmDash dev server running (npx emdash dev)
#   - Content files in seed/content/<collection>/<locale>/*.md
#
# References:
#   - Pattern inspired by kmelve/markdown-to-sanity (https://github.com/kmelve/markdown-to-sanity)
#   - Frontmatter parsing adapted from gray-matter conventions (https://www.npmjs.com/package/gray-matter)

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────
COLLECTION="${1:?Usage: load-content.sh <collection> [--dry-run] [--port N|--url URL]}"
shift
DRY_RUN=""
BASE_URL="${EMDASH_URL:-http://localhost:4321}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="--dry-run"; shift ;;
    --port) BASE_URL="http://localhost:${2:?--port needs a number}"; shift 2 ;;
    --url) BASE_URL="${2:?--url needs a URL}"; shift 2 ;;
    *) echo "unknown argument: $1 (expected --dry-run, --port N or --url URL)" >&2; exit 2 ;;
  esac
done
CONTENT_DIR="seed/content/${COLLECTION}"

if [[ ! -d "$CONTENT_DIR" ]]; then
  echo "❌ Content directory not found: $CONTENT_DIR" >&2
  exit 1
fi

# Fail fast on the connection, with the observed fact and where to look: a
# dead or wrong-port CMS otherwise reports as every entry being "not found".
if [[ -z "$DRY_RUN" ]]; then
  if ! curl -sf -o /dev/null -m 5 "$BASE_URL/"; then
    {
      echo "❌ No CMS answering at $BASE_URL"
      echo "   Start it, or point this loader at the right stack:"
      echo "     scripts/load-content.sh $COLLECTION --port <PORT>"
      echo "   (parallel sessions use 8000 + issue number)"
    } >&2
    exit 1
  fi
fi

# ── Resolve slug+locale → id from the LIVE database (#302) ────────────
# The loader used to trust an `id` in each file's frontmatter. Those ids are
# frozen snapshots of whichever database existed when the file was written,
# and a clean rebuild (§3) mints fresh ULIDs — so after the very procedure
# every text change requires, all 12 files failed with "Content item not
# found". The stable key was in the path all along: the filename IS the slug
# and the directory IS the locale. Ask the database who owns that pair.
# The listing API caps --limit at 100 and rejects anything above it with
# "Invalid request data" (measured 2026-08-24, EmDash 0.34). This asked for 500,
# so the call failed on EVERY run and 2>/dev/null swallowed the reason: the
# loader has been dead since the cap arrived, reporting it as a missing index.
# 100 is therefore the ceiling, and truncation is checked rather than assumed —
# the response carries no total, no cursor and no hasMore, so a full page is the
# only signal there is.
INDEX_LIMIT=100

declare_index() {
  [[ -n "$DRY_RUN" ]] && return 0
  INDEX_JSON=$(npx emdash content list "$COLLECTION" -u "$BASE_URL" --limit "$INDEX_LIMIT" --json 2>&1) || INDEX_JSON=""
  INDEX=$(python3 -c "
import json, sys
raw = sys.argv[1]
try:
    d = json.loads(raw)
except Exception:
    sys.exit(0)
items = d if isinstance(d, list) else (d.get('items') or d.get('entries') or [])
for it in items:
    slug, loc, _id = it.get('slug'), it.get('locale'), it.get('id')
    if slug and _id:
        print(f\"{loc or ''}/{slug}={_id}\")
" "$INDEX_JSON")
  if [[ -z "$INDEX" ]]; then
    {
      echo "❌ Could not read the '$COLLECTION' index from $BASE_URL."
      echo "   Not 'the collection is empty' — the listing returned nothing at all,"
      echo "   which is also what an unauthenticated CLI looks like."
      echo "   The CLI said:"
      printf '     %s\n' "$INDEX_JSON" | head -5
      echo "   Check: npx emdash content list $COLLECTION -u $BASE_URL --limit $INDEX_LIMIT"
    } >&2
    exit 1
  fi
  # A full page means there may be more, and every entry past the cut would be
  # reported as "no such slug" — a wrong diagnosis, worse than a missing one.
  if [[ "$(echo "$INDEX" | grep -c .)" -ge "$INDEX_LIMIT" ]]; then
    {
      echo "❌ The '$COLLECTION' listing came back full ($INDEX_LIMIT entries), so it may be cut."
      echo "   Entries past the cut would be reported as 'no such slug'. Page through"
      echo "   with --cursor before trusting this run."
    } >&2
    exit 1
  fi
  echo "  resolved $(echo "$INDEX" | grep -c .) entries by slug+locale from $BASE_URL"
}

lookup_id() {  # $1 = locale, $2 = slug
  echo "$INDEX" | awk -F= -v k="$1/$2" '$1==k {print $2; exit}'
}

# ── Colors ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ── Counters ──────────────────────────────────────────────────────────
TOTAL=0
SUCCESS=0
SKIPPED=0
FAILED=0

# ── Parse frontmatter using python3 (macOS bash 3.x compatible) ───────
# Outputs JSON: { "id": "...", "fields": { "key": "val", ... }, "body": "..." }
parse_md_file() {
  python3 -c "
import sys, json, re

content = open(sys.argv[1], 'r').read()

# Split frontmatter and body
fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
if not fm_match:
    print(json.dumps({'id': '', 'fields': {}, 'body': content}))
    sys.exit(0)

fm_raw, body = fm_match.group(1), fm_match.group(2).strip()

# Parse YAML-like frontmatter (simple key: value pairs)
fields = {}
entry_id = ''
for line in fm_raw.split('\n'):
    line = line.strip()
    if not line or ':' not in line:
        continue
    key, val = line.split(':', 1)
    key = key.strip()
    val = val.strip().strip('\"').strip(\"'\")
    if key == 'id':
        entry_id = val
    else:
        fields[key] = val

print(json.dumps({'id': entry_id, 'fields': fields, 'body': body}))
" "$1"
}

# ── Main loop ─────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  EmDash Content Loader"
echo "  Collection: ${COLLECTION}"
echo "  Source:     ${CONTENT_DIR}/"
[[ "$DRY_RUN" == "--dry-run" ]] && echo -e "  Mode:       ${YELLOW}DRY RUN${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""

declare_index

for locale_dir in "$CONTENT_DIR"/*/; do
  locale=$(basename "$locale_dir")
  echo "── Locale: ${locale} ──────────────────────────────────────────"

  for md_file in "$locale_dir"*.md; do
    [[ -f "$md_file" ]] || continue
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$md_file")

    # Parse the file
    PARSED=$(parse_md_file "$md_file")
    FIELDS_JSON=$(echo "$PARSED" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['fields']))")
    BODY=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['body'])")

    # The slug is the filename, the locale is the directory (#302).
    SLUG="${filename%.md}"
    if [[ -n "$DRY_RUN" ]]; then
      FM_ID="(resolved at run time)"
    else
      FM_ID=$(lookup_id "$locale" "$SLUG")
    fi

    if [[ -z "$FM_ID" ]]; then
      echo -e "  ${RED}✗ FAIL${NC} ${filename} — no '$COLLECTION' entry with slug '${SLUG}' in locale '${locale}' at ${BASE_URL}"
      echo "         (the file names the entry; if the slug changed, rename the file)"
      FAILED=$((FAILED + 1))
      continue
    fi

    # Build the JSON payload: merge { "content": body, ...fields }
    PAYLOAD=$(python3 -c "
import json, sys
fields = json.loads(sys.argv[1])
body = sys.argv[2]
fields['content'] = body
print(json.dumps(fields))
" "$FIELDS_JSON" "$BODY")

    if [[ "$DRY_RUN" == "--dry-run" ]]; then
      echo -e "  ${YELLOW}⊘ DRY${NC}  ${filename} → ${FM_ID}"
      echo "         Fields: $(echo "$PAYLOAD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(', '.join(f'{k} ({len(str(v))} chars)' for k,v in d.items()))")"
      continue
    fi

    # Get current _rev for optimistic concurrency
    GET_ERR=$(mktemp)
    REV=$(npx emdash content get "$COLLECTION" "$FM_ID" -u "$BASE_URL" --json 2>"$GET_ERR" \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('_rev',''))" 2>/dev/null) || true

    if [[ -z "$REV" ]]; then
      # the CLI's own words, not our guess about what went wrong
      REASON=$(head -c 160 "$GET_ERR" | tr '\n' ' ')
      rm -f "$GET_ERR"
      echo -e "  ${RED}✗ FAIL${NC} ${filename} — no _rev for ${FM_ID} at ${BASE_URL}${REASON:+ — }${REASON}"
      FAILED=$((FAILED + 1))
      continue
    fi

    # Update via CLI (markdown → PT conversion happens server-side).
    # Payload goes through a temp FILE: emoji/unicode payloads break as a giant
    # --data argv in some shells, and --file is immune to quoting entirely.
    PAYLOAD_FILE=$(mktemp)
    printf '%s' "$PAYLOAD" > "$PAYLOAD_FILE"
    ERR_FILE=$(mktemp)
    rm -f "$GET_ERR"
    if npx emdash content update "$COLLECTION" "$FM_ID" \
        -u "$BASE_URL" \
        --rev "$REV" \
        --file "$PAYLOAD_FILE" \
        --json >/dev/null 2>"$ERR_FILE"; then
      echo -e "  ${GREEN}✓ OK${NC}   ${filename} → ${FM_ID}"
      SUCCESS=$((SUCCESS + 1))
      rm -f "$PAYLOAD_FILE" "$ERR_FILE"
    else
      rm -f "$PAYLOAD_FILE"
      echo -e "  ${RED}✗ FAIL${NC} ${filename} → ${FM_ID} — $(head -c 200 "$ERR_FILE" | tr '\n' ' ')"
      rm -f "$ERR_FILE"
      FAILED=$((FAILED + 1))
    fi
  done

  echo ""
done

# ── Summary ───────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "  Results: ${SUCCESS} updated, ${SKIPPED} skipped, ${FAILED} failed (${TOTAL} total)"
echo "════════════════════════════════════════════════════════════════"

[[ $FAILED -gt 0 ]] && exit 1
exit 0
