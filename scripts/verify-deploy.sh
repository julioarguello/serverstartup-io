#!/usr/bin/env bash
# verify-deploy.sh — post-deploy smoke battery against a deployed base URL (#196).
#
# The same battery runs after every deploy, preview or production. Each route
# asserts its HTTP 200 AND a page-identifying phrase (the served <title>), so a
# route that answers 200 with the wrong content still fails. Titles were taken
# from the live rendered pages, entity encoding included (&amp;).
#
# Renamed slugs keep a 301 in astro.config.mjs so inbound links survive. Those
# redirects are asserted here too (#328): the promise they make is exactly the
# one nothing else checks, and a redirect that quietly disappears looks like a
# working site until someone follows an old link.
#
# Usage: scripts/verify-deploy.sh <base-url>
set -euo pipefail

BASE="${1:?usage: verify-deploy.sh <base-url>}"
BASE="${BASE%/}"
FAIL=0
TMP="${RUNNER_TEMP:-/tmp}/verify-deploy"
mkdir -p "$TMP"

# ── 1. Routes battery: 26 routes, both locales, status + title ──────────────
ROUTES=(
	"/|Ingeniería de software"
	"/quienes-somos|Quiénes somos"
	"/contacto|Contacto"
	"/comercio-electronico|Comercio electrónico"
	"/integracion-de-sistemas|Integración de sistemas"
	"/big-data-cloud-analytics|Big Data &amp; Cloud Analytics"
	"/cdn-waf-seguridad-edge-cloudflare|CDN, WAF y seguridad edge"
	"/desarrollo-greenfield|Desarrollo greenfield"
	"/deconstruyendo|Deconstruyendo esta web"
	"/politica-de-privacidad|Política de privacidad"
	"/aviso-legal|Aviso legal"
	"/inteligencia-artificial|Inteligencia artificial"
	"/referencias|Referencias"
	"/en|Software engineering"
	"/en/about-us|About us"
	"/en/contact|Contact"
	"/en/e-commerce|E-commerce"
	"/en/systems-integration|Systems Integration"
	"/en/big-data-cloud-analytics|Big Data &amp; Cloud Analytics"
	"/en/cdn-waf-edge-security-cloudflare|CDN, WAF &amp; Edge Security"
	"/en/greenfield-development|Greenfield development"
	"/en/deconstructing|Deconstructing this website"
	"/en/privacy-policy|Privacy policy"
	"/en/legal-notice|Legal notice"
	"/en/artificial-intelligence|Artificial Intelligence"
	"/en/references|References"
)

echo "── routes battery ($BASE)"
for entry in "${ROUTES[@]}"; do
	path="${entry%%|*}"; phrase="${entry##*|}"
	code=$(curl -s -o "$TMP/page.html" -w "%{http_code}" "$BASE$path")
	if [ "$code" != "200" ]; then
		echo "  FAIL $path — HTTP $code (expected 200)" >&2; FAIL=1; continue
	fi
	if ! grep -qF "$phrase" "$TMP/page.html"; then
		echo "  FAIL $path — 200 but phrase not found: $phrase" >&2; FAIL=1; continue
	fi
	echo "  ok   $path"
done

# Unknown path must land on the 404 page with a real 404 status (302 → /404 → 404).
code=$(curl -sL -o "$TMP/page.html" -w "%{http_code}" "$BASE/this-route-does-not-exist")
if [ "$code" = "404" ] && grep -qF "Página no encontrada" "$TMP/page.html"; then
	echo "  ok   /this-route-does-not-exist → 404"
else
	echo "  FAIL unknown route — final HTTP $code (expected 404 with the 404 page)" >&2; FAIL=1
fi

# Two families, one assertion: renamed slugs kept alive by astro.config.mjs,
# and the trailing-slash form of every page, which `trailingSlash: "never"`
# folds onto the canonical one (#334). Both status AND destination — a 301 to
# the wrong page is worse than no redirect at all.
#
# GET, not HEAD, and that is not a detail: Astro answers a trailing-slash
# redirect with 301 to GET and 308 to every other method. Googlebot sends GET,
# so HEAD here would assert a status no crawler ever sees.
# Retired pages must be GONE, not merely unlinked (#337). A page pulled from
# the menu that still answers 200 on some older deploy is indistinguishable
# from one properly retired — until someone finds it.
echo "── retired"
for path in "/partners" "/en/partners"; do
	code=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE$path")
	if [ "$code" = "404" ]; then
		echo "  ok   $path → 404"
	else
		echo "  FAIL $path — HTTP $code (expected 404: this page was retired)" >&2; FAIL=1
	fi
done

echo "── redirects"
REDIRECTS=(
	"/ingenieria-greenfield-y-sistemas-criticos|/desarrollo-greenfield"
	"/en/greenfield-engineering-critical-systems|/en/greenfield-development"
	"/en/|/en"
	"/contacto/|/contacto"
	"/en/about-us/|/en/about-us"
	"/desarrollo-greenfield/|/desarrollo-greenfield"
)
for entry in "${REDIRECTS[@]}"; do
	from="${entry%%|*}"; to="${entry##*|}"
	read -r code location < <(curl -s "$BASE$from" \
		-w '%{http_code} %{redirect_url}\n' -o /dev/null)
	if [ "$code" != "301" ]; then
		echo "  FAIL $from — HTTP $code (expected 301)" >&2; FAIL=1; continue
	fi
	# Same-host destinations print as a path, off-host ones keep their full URL
	# (the prefix does not strip) — which is the difference worth seeing.
	landed="${location#"$BASE"}"
	if [ "$landed" != "$to" ]; then
		echo "  FAIL $from — 301 to ${landed:-<empty>} (expected $to)" >&2; FAIL=1; continue
	fi
	echo "  ok   $from → $to (301)"
done

# ── 2. Security headers + security.txt (the #164 suite) ─────────────────────
echo "── security headers"
"$(dirname "$0")/ci-check-headers.sh" "$BASE" || FAIL=1

# ── 3. robots.txt, sitemap, canonical/hreflang spot-check ───────────────────
echo "── discovery"
if curl -s "$BASE/robots.txt" | grep -q "^Sitemap:"; then
	echo "  ok   /robots.txt (declares Sitemap)"
else
	echo "  FAIL /robots.txt — missing or no Sitemap line" >&2; FAIL=1
fi
# Sitemap coverage, BOTH ways (#329). Checking only that the file answers 200
# is what let it declare 16 URLs while the site served 26 for months: a guard
# that cannot find a problem and one that finds none look identical.
#   → every declared URL must answer 200 and must NOT carry noindex
#   → every public, indexable page must be declared
# The second half is the one that would have caught it.
code=$(curl -s -o "$TMP/sitemap.xml" -w "%{http_code}" "$BASE/sitemap.xml")
if [ "$code" != "200" ]; then
	echo "  FAIL /sitemap.xml — HTTP $code" >&2; FAIL=1
else
	# -E throughout: `\?` is a GNU extension that BSD sed reads as a literal
	# `?`, so the origin survived and every path became BASE + full URL
	# EmDash injects its own /sitemap.xml, generic and wrong for this routing.
	# Ours wins by precedence today; Astro warns that will become a hard error.
	# Assert the OUTCOME rather than trust the precedence: <urlset> is ours,
	# <sitemapindex> is theirs.
	if grep -q "<sitemapindex" "$TMP/sitemap.xml"; then
		echo "  FAIL /sitemap.xml is serving EmDash's generic index, not the site's own" >&2
		echo "       (route collision resolved the wrong way — see src/pages/sitemap.xml.ts)" >&2
		FAIL=1
	fi
	declared=$(grep -oE "<loc>[^<]*</loc>" "$TMP/sitemap.xml" \
		| sed -E -e 's#</?loc>##g' -e 's#^https?://[^/]+##' -e 's#^$#/#' | sort -u)
	n=$(echo "$declared" | grep -c . || true)
	echo "  ok   /sitemap.xml ($n URLs)"

	# a) declared → reachable and indexable
	for path in $declared; do
		hdr=$(curl -s -o "$TMP/p.html" -w "%{http_code}" "$BASE$path")
		if [ "$hdr" != "200" ]; then
			echo "  FAIL sitemap declares $path — HTTP $hdr" >&2; FAIL=1
		elif grep -qiE '<meta name="robots"[^>]*noindex' "$TMP/p.html"; then
			echo "  FAIL sitemap declares $path — the page carries noindex" >&2; FAIL=1
		fi
	done

	# b) public and indexable → declared. The battery's own route table is the
	#    inventory: it is the list of pages this site promises to serve.
	for entry in "${ROUTES[@]}"; do
		path="${entry%%|*}"
		curl -s -o "$TMP/p.html" "$BASE$path"
		# explicit ifs: `grep -q … && continue` returns non-zero on no-match,
		# which under `set -e` kills the script mid-inventory — and a truncated
		# inventory reports far fewer problems than exist
		if grep -qiE '<meta name="robots"[^>]*noindex' "$TMP/p.html"; then
			continue
		fi
		if ! echo "$declared" | grep -qxF "$path"; then
			echo "  FAIL $path is public and indexable but NOT in the sitemap" >&2; FAIL=1
		fi
	done
	# c) The two lists must agree in BOTH directions, and this is the check that
	#    keeps the inventory honest. The sitemap is DERIVED from the CMS, so it
	#    grows by itself; ROUTES is hand-maintained, so it does not. Without
	#    this, (b) silently degrades: it can only miss what ROUTES forgot, and
	#    ROUTES had forgotten /aviso-legal — proven by deleting that URL from
	#    the sitemap and watching the battery pass.
	for path in $declared; do
		found=0
		for entry in "${ROUTES[@]}"; do
			[ "${entry%%|*}" = "$path" ] && found=1
		done
		if [ "$found" = "0" ]; then
			echo "  FAIL sitemap declares $path — the battery does not know that route" >&2
			echo "       (add it to ROUTES: a page nobody asserted is a page nobody checks)" >&2
			FAIL=1
		fi
	done
	if [ "$FAIL" = "0" ]; then echo "  ok   sitemap and route inventory agree, both ways"; fi
fi
# Canonical always points at the production origin (site in astro.config),
# also from preview — asserting the prefix catches a broken site setting.
curl -s "$BASE/" -o "$TMP/home.html"
if grep -q 'rel="canonical" href="https://www.serverstartup.io/"' "$TMP/home.html"; then
	echo "  ok   canonical → production origin"
else
	echo "  FAIL canonical missing or not pointing at https://www.serverstartup.io/" >&2; FAIL=1
fi
if [ "$(grep -c 'hreflang=' "$TMP/home.html")" -ge 2 ]; then
	echo "  ok   hreflang alternates present"
else
	echo "  FAIL hreflang alternates missing on home" >&2; FAIL=1
fi

# ── 4. FTS search — a real query, not a row count (#365) ────────────────────
# The 0.6→0.34 migration rebuilt the FTS5 tables, and equal row counts do not
# prove the inverted index answers. Structure-based on purpose: the <article>
# cards ARE the result list (measured 2026-08-23: 6 on "cloudflare", 0 on the
# control), so CMS label changes cannot break the assertion.
echo "── FTS search"
for path in "/search?q=cloudflare" "/en/search?q=cloudflare"; do
	code=$(curl -s -o "$TMP/s.html" -w "%{http_code}" "$BASE$path")
	hits=$(grep -c "<article" "$TMP/s.html" || true)
	if [ "$code" = "200" ] && [ "$hits" -gt 0 ]; then
		echo "  ok   $path — $hits result cards"
	else
		echo "  FAIL $path — HTTP $code, $hits result cards (the FTS index answered nothing)" >&2; FAIL=1
	fi
done
# Negative control: a query that must return zero proves the page can say no.
# Without it, a page rendering cards unconditionally would pass the positive.
code=$(curl -s -o "$TMP/s.html" -w "%{http_code}" "$BASE/search?q=zzzqxcontrolnegativo")
hits=$(grep -c "<article" "$TMP/s.html" || true)
if [ "$code" = "200" ] && [ "$hits" = "0" ]; then
	echo "  ok   negative control (zero-hit query) — 0 cards"
else
	echo "  FAIL negative control — HTTP $code, $hits cards (expected 200 with zero)" >&2; FAIL=1
fi

# ── 5. W3C Nu spot-check (2 pages, one per locale) ──────────────────────────
# Real markup errors fail the battery; an unreachable validator only warns
# (external dependency downtime must not block a deploy pipeline).
echo "── W3C Nu spot-check"
for path in "/" "/en/e-commerce"; do
	curl -s "$BASE$path" -o "$TMP/nu-in.html"
	if ! curl -s --max-time 30 -H "Content-Type: text/html; charset=utf-8" \
		--data-binary "@$TMP/nu-in.html" \
		"https://validator.w3.org/nu/?out=json" -o "$TMP/nu-out.json"; then
		echo "  warn $path — validator unreachable, skipping (not a deploy failure)"
		continue
	fi
	errors=$(python3 -c "
import json,sys
try:
    msgs = json.load(open('$TMP/nu-out.json')).get('messages', [])
except Exception:
    print(-1); sys.exit()
print(sum(1 for m in msgs if m.get('type') == 'error'))
")
	if [ "$errors" = "-1" ]; then
		echo "  warn $path — validator answered non-JSON, skipping"
	elif [ "$errors" = "0" ]; then
		echo "  ok   $path — 0 Nu errors"
	else
		echo "  FAIL $path — $errors Nu error(s)" >&2; FAIL=1
	fi
done

if [ "$FAIL" = "0" ]; then
	echo "verify-deploy: ALL GREEN ($BASE)"
fi
exit $FAIL
