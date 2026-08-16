#!/usr/bin/env bash
# preview.sh — start/restart/reseed the local EmDash preview, reliably.
#
# The dev server (emdash/vite) can wedge after HMR churn: process alive, port
# not answering. The fix is always the same: kill, relaunch, verify by HTTP —
# never trust the PID. D1 state survives restarts; only `reseed` rebuilds it
# (needed after editing seed/seed.json — the seeder skips existing entries).
#
# Usage:
#   scripts/preview.sh [PORT]            start or restart (default 4321)
#   scripts/preview.sh [PORT] reseed     clean D1 rebuild from seed/seed.json
#   scripts/preview.sh [PORT] status     HTTP liveness probe
#
# Parallel sessions (#262 epic): PORT = 8000 + issue number (e.g. 8263).
# Reseed implies ~60-90 s of downtime: the D1 file cannot be written while
# the server runs (FTS corruption).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=4321
CMD=restart
for arg in "$@"; do
	case "$arg" in
		[0-9]*) PORT="$arg" ;;
		restart|reseed|status) CMD="$arg" ;;
		*) echo "usage: scripts/preview.sh [PORT] [restart|reseed|status]"; exit 2 ;;
	esac
done

URL="http://localhost:$PORT/quienes-somos"
LOG="${TMPDIR:-/tmp}/emdash-dev-$PORT.log"

probe() { curl -s -o /dev/null -m 5 -w '%{http_code}' "$URL" 2>/dev/null || echo 000; }

wait_200() {
	for _ in $(seq 1 "$1"); do
		[ "$(probe)" = "200" ] && return 0
		sleep 1
	done
	return 1
}

kill_port() { lsof -ti ":$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true; }

start_server() { nohup npx -y emdash dev -p "$PORT" > "$LOG" 2>&1 & }

fail() { echo "preview FAILED — last log lines ($LOG):"; tail -5 "$LOG"; exit 1; }

case "$CMD" in
	status)
		code=$(probe)
		echo "preview :$PORT -> http=$code"
		[ "$code" = "200" ]
		;;
	restart)
		kill_port; sleep 1
		start_server
		wait_200 90 && echo "preview OK on $URL" || fail
		;;
	reseed)
		kill_port; sleep 1
		rm -rf .wrangler data.db
		start_server
		D1_DB=""
		for _ in $(seq 1 120); do
			D1_DB=$(find .wrangler -name "*.sqlite" -path "*/d1/*" -not -name "metadata.sqlite" 2>/dev/null | head -1)
			[ -n "$D1_DB" ] && [ "$(probe)" != "000" ] && break
			sleep 1
		done
		[ -n "$D1_DB" ] || fail
		kill_port; sleep 1
		npx -y emdash seed seed/seed.json -d "$D1_DB"
		start_server
		wait_200 90 && echo "preview reseeded + OK on $URL" || fail
		;;
esac
