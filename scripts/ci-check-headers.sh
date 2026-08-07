#!/usr/bin/env bash
# ci-check-headers.sh — assert the #164 security-header suite on a base URL.
# Usage: scripts/ci-check-headers.sh http://localhost:8787
set -euo pipefail

BASE="${1:?usage: ci-check-headers.sh <base-url>}"
FAIL=0

check() { # path, header, required-substring
	local hdrs
	hdrs=$(curl -sI "$BASE$1")
	if echo "$hdrs" | grep -i "^$2:" | grep -qi -- "$3"; then
		echo "  ok   $1 $2"
	else
		echo "  FAIL $1 $2 (expected to contain: $3)" >&2
		FAIL=1
	fi
}

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
