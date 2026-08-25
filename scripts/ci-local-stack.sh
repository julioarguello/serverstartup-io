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

# Astro 7's `/_astro/status` was evaluated as a replacement for this polling
# and rejected (#367). Two independent reasons, both measured 2026-08-25:
# it is a Vite dev-server middleware, and this stack runs `wrangler dev` over
# the BUILT output, where Vite is not in the picture at all; and even under
# `astro dev` it answered 200 at 6.2s while `/` did not answer until 15.0s,
# returning the constant `{"ok":true}` with no state behind it. That is a
# liveness probe, not a readiness one — adopting it would trade a signal that
# knows when the site works for one that does not.
wait_http() { # $1 = required status regex ("200" strict, "[0-9]{3}" any response)
	for _ in $(seq 1 60); do
		if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -qE "^$1$"; then
			return 0
		fi
		# A dead server and a slow one look identical from the port. wrangler
		# writes its reason (`Address already in use`, an unresolved import)
		# within a second and exits; polling on regardless turns that instant
		# error into two minutes of HTTP 000, which is what sent three separate
		# investigations chasing the wrong cause on 2026-08-21.
		if ! kill -0 "$WRANGLER_PID" 2>/dev/null; then
			echo "ERROR: wrangler (pid $WRANGLER_PID) exited before answering on :$PORT" >&2
			tail -40 "$LOG" >&2 || true
			return 1
		fi
		sleep 2
	done
	echo "ERROR: stack did not answer /$1/ on :$PORT within 120s" >&2
	tail -40 "$LOG" >&2 || true
	return 1
}

# 1. First boot creates the D1 schema (EmDash runs its migrations on request).
# The unseeded site legitimately answers 302→/404, so accept any HTTP response.
npx wrangler dev --port "$PORT" >"$LOG" 2>&1 &
WRANGLER_PID=$!
wait_http "[0-9]{3}"

# 2. Seed with the server DOWN (FTS-corruption rule).
#
# The supervisor dies FIRST, then its children. wrangler 4.125 supervises its
# workerd children and respawns one the instant you kill it, so killing the
# child first only produces a fresh child that retakes the port. Measured
# 2026-08-21 while migrating to Astro 7: after each `kill -9` the workerd on
# the port came back with an `etime` of seconds, and one supervisor survived
# with PPID 1 between runs, holding the port across invocations.
#
# And the wait is a CONDITION, not a duration. The previous `sleep 2` could
# not express "the port is free": under 4.84 the race happened to be won, and
# under 4.125 it is lost — the second boot then fails with `Address already in
# use` while wait_http keeps polling, presenting an instant error as minutes of
# HTTP 000.
# The supervisor is a GRANDCHILD, not a child: `npx` → node → wrangler → workerd.
# `pkill -P` reaches only direct children, so the real supervisor survived and
# kept respawning workerd — which is how CI failed with "port still has a
# listener 30s after stopping the stack" while the tree looked dead.
#
# Matching on the command line rather than walking the tree, for two reasons.
# `ps -o comm` shows these supervisors as plain `node` (the word "wrangler" is
# only in the args), so a comm-based filter reports zero and reads like success.
# And a recursive tree walk spawns one `ps` per node, which is slow enough to
# look like a hang.
#
# The pattern is `dev --port $PORT`, not `wrangler dev --port $PORT`, because
# the process that actually supervises workerd does not carry the word
# "wrangler" next to "dev" at all. Measured:
#
#   node .../node_modules/.bin/wrangler dev --port 8787          ← the parent
#   node --no-warnings .../wrangler-dist/cli.js dev --port 8787  ← the supervisor
#
# A pattern matching only the first leaves the second alive, respawning workerd
# forever — and `pkill` then reports nothing to kill, which reads like success.
# `dev --port $PORT` matches both and is still port-scoped, so it cannot reach
# another project's stack.
stop_stack() {
	local holders pid
	pkill -TERM -f "dev --port $PORT" 2>/dev/null || true
	pkill -KILL -f "dev --port $PORT" 2>/dev/null || true
	# With nothing left alive to spawn more, whatever still holds the port is an
	# orphan and stays dead once killed. `xargs -r` is a GNU extension BSD xargs
	# lacks, so iterate instead.
	for _ in $(seq 1 45); do
		# `|| true` is load-bearing: lsof exits 1 when it finds nothing, and under
		# `set -euo pipefail` that failing pipeline kills the script through the
		# assignment — silently, and precisely in the SUCCESS case (port free).
		holders="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
		if [ -z "$holders" ]; then
			return 0
		fi
		for pid in $holders; do
			kill -KILL "$pid" 2>/dev/null || true
		done
		sleep 1
	done
	# Observed fact and where to look — never a guessed cause.
	echo "ERROR: port $PORT still has a listener 30s after stopping the stack" >&2
	lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2 || true
	ps -eo pid=,ppid=,etime=,comm= | grep -iE "workerd|wrangler" >&2 || true
	return 1
}
stop_stack
D1_DB=$(find .wrangler -name "*.sqlite" -path "*/d1/*" -not -name "metadata.sqlite" | head -1)
[ -n "$D1_DB" ] || { echo "ERROR: local D1 sqlite not found" >&2; exit 1; }
npx emdash seed seed/seed.json -d "$D1_DB"

# 3. Boot again on the seeded database — now the homepage must be a real 200.
npx wrangler dev --port "$PORT" >>"$LOG" 2>&1 &
WRANGLER_PID=$!
wait_http "200"
echo "stack up on :$PORT (seeded from seed/seed.json)"
