#!/usr/bin/env bash
# ci-local-stack.sh — boot the built site on a local Workers stack, seeded.
#
# Encodes the emdash-ops runbook (see .agent skill): the dev server must be
# DOWN while seeding the local D1 sqlite (concurrent writes corrupt the FTS
# virtual tables), and seeds are the complete text corpus, so a fresh boot
# from seed.json alone reproduces the whole site.
#
# Usage: scripts/ci-local-stack.sh [port]   (default 8787; assumes astro build ran)
set -euo pipefail

PORT="${1:-8787}"
LOG="${RUNNER_TEMP:-/tmp}/wrangler-ci.log"

wait_http() { # $1 = required status regex ("200" strict, "[0-9]{3}" any response)
	for _ in $(seq 1 60); do
		if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -qE "^$1$"; then
			return 0
		fi
		sleep 2
	done
	echo "ERROR: stack did not answer /$1/ on :$PORT" >&2
	tail -40 "$LOG" >&2 || true
	return 1
}

# 1. First boot creates the D1 schema (EmDash runs its migrations on request).
# The unseeded site legitimately answers 302→/404, so accept any HTTP response.
npx wrangler dev --port "$PORT" >"$LOG" 2>&1 &
WRANGLER_PID=$!
wait_http "[0-9]{3}"

# 2. Seed with the server DOWN (FTS-corruption rule).
kill "$WRANGLER_PID" 2>/dev/null || true
# wrangler spawns workerd children; make sure the port is actually free
sleep 2
lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true
sleep 1
D1_DB=$(find .wrangler -name "*.sqlite" -path "*/d1/*" -not -name "metadata.sqlite" | head -1)
[ -n "$D1_DB" ] || { echo "ERROR: local D1 sqlite not found" >&2; exit 1; }
npx emdash seed seed/seed.json -d "$D1_DB"

# 3. Boot again on the seeded database — now the homepage must be a real 200.
npx wrangler dev --port "$PORT" >>"$LOG" 2>&1 &
wait_http "200"
echo "stack up on :$PORT (seeded from seed/seed.json)"
