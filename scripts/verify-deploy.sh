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
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/sitemap-index.xml")
if [ "$code" = "200" ]; then
	echo "  ok   /sitemap-index.xml"
else
	echo "  FAIL /sitemap-index.xml — HTTP $code" >&2; FAIL=1
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

# ── 4. W3C Nu spot-check (2 pages, one per locale) ──────────────────────────
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
