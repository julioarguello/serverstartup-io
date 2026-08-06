#!/usr/bin/env bash
# AUTO-GENERATED — DO NOT EDIT MANUALLY
# EmDash Content Loader — syncs markdown files into EmDash CMS via CLI.
#
# Usage:
#   ./scripts/load-content.sh <collection> [--dry-run]
#
# Examples:
#   ./scripts/load-content.sh services           # Load all services (ES + EN)
#   ./scripts/load-content.sh services --dry-run  # Preview only
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
COLLECTION="${1:?Usage: load-content.sh <collection> [--dry-run]}"
DRY_RUN="${2:-}"
CONTENT_DIR="seed/content/${COLLECTION}"

if [[ ! -d "$CONTENT_DIR" ]]; then
  echo "❌ Content directory not found: $CONTENT_DIR" >&2
  exit 1
fi

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

for locale_dir in "$CONTENT_DIR"/*/; do
  locale=$(basename "$locale_dir")
  echo "── Locale: ${locale} ──────────────────────────────────────────"

  for md_file in "$locale_dir"*.md; do
    [[ -f "$md_file" ]] || continue
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$md_file")

    # Parse the file
    PARSED=$(parse_md_file "$md_file")
    FM_ID=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
    FIELDS_JSON=$(echo "$PARSED" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['fields']))")
    BODY=$(echo "$PARSED" | python3 -c "import json,sys; print(json.load(sys.stdin)['body'])")

    if [[ -z "$FM_ID" ]]; then
      echo -e "  ${YELLOW}⊘ SKIP${NC} ${filename} — no 'id' in frontmatter"
      SKIPPED=$((SKIPPED + 1))
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
    REV=$(npx emdash content get "$COLLECTION" "$FM_ID" --json 2>/dev/null \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('_rev',''))" 2>/dev/null) || true

    if [[ -z "$REV" ]]; then
      echo -e "  ${RED}✗ FAIL${NC} ${filename} — entry ${FM_ID} not found in CMS"
      FAILED=$((FAILED + 1))
      continue
    fi

    # Update via CLI (markdown → PT conversion happens server-side).
    # Payload goes through a temp FILE: emoji/unicode payloads break as a giant
    # --data argv in some shells, and --file is immune to quoting entirely.
    PAYLOAD_FILE=$(mktemp)
    printf '%s' "$PAYLOAD" > "$PAYLOAD_FILE"
    ERR_FILE=$(mktemp)
    if npx emdash content update "$COLLECTION" "$FM_ID" \
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
