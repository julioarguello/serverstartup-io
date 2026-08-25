#!/usr/bin/env bash
# ci-check-headers.sh — assert the #164 security-header suite on a base URL.
# Usage: scripts/ci-check-headers.sh http://localhost:8787
#
# Positive control (#385)
# -----------------------
# The matcher runs first against two responses this script writes itself: one
# that carries the header and one that does not. Without it, a `grep` that
# stops matching — a changed separator, a header renamed, `curl -I` returning
# nothing at all — prints the same "ok" lines over a site serving no security
# headers whatsoever, and a scan that CANNOT fail looks exactly like a clean
# one. The fixtures are strings in this file, never a served route.
set -euo pipefail

BASE="${1:?usage: ci-check-headers.sh <base-url>}"
FAIL=0

# The matcher, separated from where the headers came from — that is the whole
# point: the control feeds it a blob instead of a URL, and exercises the same
# code the real run does.
matches() { # blob, header, required-substring
	echo "$1" | grep -i "^$2:" | grep -qi -- "$3"
}

check() { # path, header, required-substring
	local hdrs
	hdrs=$(curl -sI "$BASE$1")
	if matches "$hdrs" "$2" "$3"; then
		echo "  ok   $1 $2"
	else
		echo "  FAIL $1 $2 (expected to contain: $3)" >&2
		FAIL=1
	fi
}

# ── positive control: the matcher must say yes to one and no to the other ────
CONTROL_PRESENT=$'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Security-Policy: default-src \'self\'; frame-ancestors \'none\'\r\nX-Frame-Options: DENY\r\n'
CONTROL_ABSENT=$'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nX-Powered-By: nothing-in-particular\r\n'
CONTROL_WRONG=$'HTTP/1.1 200 OK\r\nContent-Security-Policy: default-src *\r\n'

blind=""
matches "$CONTROL_PRESENT" "Content-Security-Policy" "default-src 'self'" \
	|| blind="$blind\n    a header that IS present was not matched"
matches "$CONTROL_ABSENT" "Content-Security-Policy" "default-src 'self'" \
	&& blind="$blind\n    a MISSING header was reported as present"
matches "$CONTROL_WRONG" "Content-Security-Policy" "default-src 'self'" \
	&& blind="$blind\n    a header present with the WRONG value was accepted"
if [ -n "$blind" ]; then
	echo "  THIS GATE IS BLIND — the header matcher no longer decides anything," >&2
	echo "  so every 'ok' below would be meaningless:" >&2
	printf "%b\n" "${blind#\\n}" >&2
	exit 3
fi
echo "  ok   positive control — the matcher accepts a present header, rejects an absent and a wrong one"

for path in "/" "/comercio-electronico"; do
	check "$path" "Content-Security-Policy" "default-src 'self'"
	check "$path" "Content-Security-Policy" "frame-ancestors 'none'"
	check "$path" "Strict-Transport-Security" "max-age="
	check "$path" "X-Content-Type-Options" "nosniff"
	check "$path" "Referrer-Policy" "strict-origin-when-cross-origin"
	check "$path" "Permissions-Policy" "camera=()"
	check "$path" "X-Frame-Options" "DENY"
	check "$path" "Cross-Origin-Opener-Policy" "same-origin"
done

# security.txt must be served
if curl -s "$BASE/.well-known/security.txt" | grep -q "^Contact: mailto:"; then
	echo "  ok   /.well-known/security.txt"
else
	echo "  FAIL /.well-known/security.txt" >&2
	FAIL=1
fi

exit $FAIL
