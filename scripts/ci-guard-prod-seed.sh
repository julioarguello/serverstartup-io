#!/usr/bin/env bash
# ci-guard-prod-seed.sh — refuse to wipe a production D1 that holds content (#358).
#
# `seed_d1` in deploy-production.yml overwrites the production database from
# seed/seed.json. Until now the only thing standing between that switch and a
# day's CMS edits was the word "pre-launch only" in an input description — a
# string in a form, checked by nobody. The migration (#355) moves that switch
# from never-used to used, which is exactly when the guard has to exist.
#
# The condition is the database's own state, not a ceremony:
#
#   content rows == 0  → pre-launch. Allow: there is nothing to lose.
#   content rows  > 0  → REFUSE, unless the operator typed the confirmation
#                        string, which makes overwriting live content a
#                        deliberate act instead of a checkbox.
#
# The counts are printed on every run, allowed or refused — the record the
# panel asked for, taken BEFORE anything is written.
#
# Usage:
#   ci-guard-prod-seed.sh <d1-name> [confirmation]   # query + decide
#   ci-guard-prod-seed.sh --decide <count> [confirmation]   # decision only
#
# `--decide` exists so the decision table can be proven without a database.
# It authorizes nothing: it never touches D1, and the workflow always calls
# the query path.
set -euo pipefail

CONFIRMATION="OVERWRITE PRODUCTION CONTENT"

decide() {
	local count="$1" typed="${2:-}"
	if [ "$count" -eq 0 ]; then
		echo "ALLOW: the database holds 0 content rows — pre-launch, nothing to lose."
		return 0
	fi
	if [ "$typed" = "$CONFIRMATION" ]; then
		echo "ALLOW: $count content row(s) present, and the confirmation string was typed."
		echo "       Overwriting them is the operator's stated intent."
		return 0
	fi
	# Observed fact + where to look. Never a guessed cause.
	echo "REFUSE: the target database holds $count content row(s)." >&2
	echo "        seed_d1 would delete them and replace them with seed/seed.json." >&2
	echo "        If they matter, export them first: the admin UI at /_emdash/admin," >&2
	echo "        or 'npx wrangler d1 execute <db> --remote --command \"SELECT …\"'." >&2
	echo "        If overwriting them is genuinely intended, re-dispatch the" >&2
	echo "        workflow with seed_d1_confirm set to exactly: $CONFIRMATION" >&2
	return 1
}

if [ "${1:-}" = "--decide" ]; then
	decide "${2:?usage: --decide <count> [confirmation]}" "${3:-}"
	exit $?
fi

D1_NAME="${1:?usage: ci-guard-prod-seed.sh <d1-name> [confirmation]}"
TYPED="${2:-}"

# Count rows across every content table. A collection table that does not exist
# yet contributes nothing rather than aborting the guard: a database too young
# to have the table is, by definition, empty of its content.
# `|| true`, deliberately: under `set -e` a failing wrangler would abort the
# script here and the diagnostic below would never print — a refusal message
# that cannot be reached is the same dead-guard shape this file exists to fix.
TABLES=$(npx wrangler d1 execute "$D1_NAME" --remote --json -y \
	--command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ec\\_%' ESCAPE '\\';" 2>/dev/null \
	| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s)[0].results.map(r=>r.name).join(' '))}catch{console.log('')}})" || true)

if [ -z "$TABLES" ]; then
	echo "REFUSE: could not read the table list from '$D1_NAME'." >&2
	echo "        Not 'the database is empty' — the query returned nothing at all," >&2
	echo "        which is what a wrong name or a missing token also looks like." >&2
	echo "        Check: npx wrangler d1 info $D1_NAME" >&2
	exit 1
fi

TOTAL=0
echo "content rows in '$D1_NAME' (measured before any write, from $(hostname)):"
for t in $TABLES; do
	n=$(npx wrangler d1 execute "$D1_NAME" --remote --json -y \
		--command "SELECT count(*) AS c FROM \"$t\";" 2>/dev/null \
		| node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s)[0].results[0].c)}catch{console.log(-1)}})" || true)
	[ -n "$n" ] || n=-1
	if [ "$n" -lt 0 ]; then
		echo "REFUSE: could not count rows in '$t' — refusing on an unknown state." >&2
		exit 1
	fi
	printf "  %-28s %s\n" "$t" "$n"
	TOTAL=$((TOTAL + n))
done
echo "  ── total                     $TOTAL"

decide "$TOTAL" "$TYPED"
