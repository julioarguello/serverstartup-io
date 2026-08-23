#!/usr/bin/env bash
# verify-purge.sh — E2E proof that purge-on-publish works on a deployed env (#357).
#
# Timeline, each step gated on the previous:
#   1. Warm the cache: a CMS page and the home must reach cf-cache-status HIT.
#   2. Mint a short-lived API token DIRECTLY in the remote D1 (SHA-256
#      base64url hash, admin scope), removed on exit via trap.
#   3. Fire a real publish (no-op content update — afterSave runs on
#      status=published) → the page AND the home (tagged with the same entry
#      id) must flip to MISS: that is the purge, observed.
#   4. Positive control: touch the same row DIRECTLY in D1 (bypasses hooks →
#      no purge fires) → the re-warmed cache must STAY on HIT. Without this,
#      step 3's MISS is indistinguishable from a coincidental eviction.
#
# Requires: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (wrangler), network
# reach to the deployed URL. Every verdict prints its vantage.
#
# Usage: scripts/verify-purge.sh [base-url] [d1-name]
set -euo pipefail

BASE="${1:-https://www-serverstartup-io-preview.serverstartup-s-partner-demo-account3612.workers.dev}"
D1_NAME="${2:-www-serverstartup-io-preview}"
PAGE="/comercio-electronico"
SLUG="comercio-electronico"
VANTAGE="$(hostname) ($(uname -s))"
FAIL=0

d1() { npx wrangler d1 execute "$D1_NAME" --remote --json -y --command "$1" 2>/dev/null; }
d1val() { d1 "$1" | python3 -c "import json,sys; r=json.load(sys.stdin)[0]['results']; print(r[0][list(r[0])[0]] if r else '')"; }
status() { curl -s -o /dev/null -w "%{http_code}" -m 15 "$BASE$1"; }
cachestat() { curl -sI -m 15 "$BASE$1" | tr -d '\r' | awk 'tolower($1)=="cf-cache-status:"{print toupper($2)}'; }

echo "vantage: $VANTAGE → $BASE"

# ── 1. warm & stability ──────────────────────────────────────────────────────
echo "── 1. warm the cache"
for path in "$PAGE" "/"; do
	first=$(cachestat "$path"); sleep 1
	second=$(cachestat "$path")
	echo "   $path: $first → $second"
	if [ "$second" != "HIT" ]; then
		echo "FAIL: $path never reached HIT ($first → $second) — nothing to purge, test cannot proceed" >&2
		exit 1
	fi
done

# ── 2. mint a throwaway API token in the remote D1 ──────────────────────────
echo "── 2. mint throwaway token (removed on exit)"
TOK_ID="e2e-357-$(date +%s)"
eval "$(python3 - <<'PYEOF'
import base64, hashlib, secrets
raw = "ec_pat_" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
hsh = base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest()).decode().rstrip("=")
print(f"RAW='{raw}'"); print(f"HASH='{hsh}'"); print(f"PREFIX='{raw[:11]}'")
PYEOF
)"
# The token needs an owner, and the remote may have ZERO users: the deploy
# refresh reproduces a freshly-seeded local D1, and the seed creates none
# (measured: run 32650178974 died on exactly this). A throwaway admin user
# (role 50, the dev-bypass value) makes the test independent of remote state;
# the FK is ON DELETE CASCADE but cleanup removes both anyway.
USER_ID="e2e-357-user-$(date +%s)"
cleanup() {
	d1 "DELETE FROM _emdash_api_tokens WHERE id='$TOK_ID';" >/dev/null 2>&1 || true
	d1 "DELETE FROM users WHERE id='$USER_ID';" >/dev/null 2>&1 || true
	echo "── cleanup: throwaway token and user deleted"
}
trap cleanup EXIT
d1 "INSERT INTO users (id, email, name, role, email_verified) VALUES ('$USER_ID', '$USER_ID@e2e.invalid', 'verify-purge e2e (#357)', 50, 1);" >/dev/null
d1 "INSERT INTO _emdash_api_tokens (id, name, token_hash, prefix, user_id, scopes) VALUES ('$TOK_ID', 'verify-purge e2e (#357)', '$HASH', '$PREFIX', '$USER_ID', '[\"admin\"]');" >/dev/null
echo "   throwaway user + token minted ($USER_ID)"

# ── 3. publish (no-op update) → purge → MISS ────────────────────────────────
echo "── 3. publish fires the purge"
ENTRY_ID=$(d1val "SELECT id FROM ec_services WHERE slug='$SLUG' AND locale='es';")
[ -n "$ENTRY_ID" ] || { echo "FAIL: entry $SLUG not found in remote D1" >&2; exit 1; }
REV=$(npx emdash content get services "$ENTRY_ID" -u "$BASE" -t "$RAW" --raw --json 2>/dev/null \
	| python3 -c "import json,sys; print(json.load(sys.stdin).get('_rev',''))")
[ -n "$REV" ] || { echo "FAIL: could not read _rev via the API (token auth broken?)" >&2; exit 1; }
npx emdash content update services "$ENTRY_ID" -u "$BASE" -t "$RAW" --rev "$REV" --data '{}' >/dev/null
echo "   no-op update applied to $ENTRY_ID (hooks fired)"

page_after=""
for i in $(seq 1 10); do
	sleep 2
	page_after=$(cachestat "$PAGE")
	[ "$page_after" = "MISS" ] && break
done
home_after=$(cachestat "/")
echo "   $PAGE after publish: $page_after (expected MISS)"
echo "   / after publish:     $home_after (expected MISS — home is tagged with the entry it embeds)"
[ "$page_after" = "MISS" ] || { echo "FAIL: $PAGE still $page_after after publish — purge did not reach the edge" >&2; FAIL=1; }
[ "$home_after" = "MISS" ] || { echo "FAIL: / still $home_after after publish — the tag graph did not cover the embedding page" >&2; FAIL=1; }

# ── 4. positive control: hook-less write must NOT purge ─────────────────────
echo "── 4. positive control (D1-direct write, no hooks)"
for i in 1 2; do cachestat "$PAGE" >/dev/null; sleep 1; done
warm=$(cachestat "$PAGE")
[ "$warm" = "HIT" ] || { echo "FAIL: could not re-warm $PAGE for the control ($warm)" >&2; FAIL=1; }
d1 "UPDATE ec_services SET updated_at = updated_at WHERE id='$ENTRY_ID';" >/dev/null
sleep 3
control=$(cachestat "$PAGE")
echo "   $PAGE after hook-less D1 write: $control (expected HIT — nothing purged it)"
[ "$control" = "HIT" ] || { echo "FAIL: control flipped to $control — either something else purges, or the cache is not holding" >&2; FAIL=1; }

if [ "$FAIL" = "0" ]; then
	echo "✅ purge-on-publish verified end-to-end from $VANTAGE"
else
	echo "❌ verify-purge found failures — see lines above" >&2
fi
exit "$FAIL"
