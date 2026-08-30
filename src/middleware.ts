import { defineMiddleware } from "astro:middleware";
import { getEmDashCollection } from "emdash";
import { loadAriaLabels, type TFunction } from "./i18n/ui";

/**
 * Request-scoped i18n middleware.
 *
 * Loads locale-specific aria labels from CMS and stores the
 * translation function on Astro.locals.t — available in all
 * pages and components without prop drilling.
 *
 * This eliminates the module-level mutable state race condition
 * that existed when t() was a global function.
 */
/**
 * Security headers (#164). Applied to every SSR response.
 *
 * CSP notes:
 * - style-src needs 'unsafe-inline': Astro emits component styles as inline
 *   <style> tags (framework behavior, documented trade-off — costs a notch on
 *   Observatory, hashes are the future upgrade path).
 * - script-src stays 'self': all scripts are bundled external modules; inline
 *   JSON-LD <script type="application/ld+json"> is a non-executable data block
 *   and is not subject to script-src.
 * - Static assets in public/ are served by the asset layer (no middleware);
 *   /demo/ keeps its own external fonts and stays outside this policy.
 */
const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy": [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		// upgrade-insecure-requests deliberately omitted: Cloudflare's
		// Always-Use-HTTPS enforces the scheme at the edge, and the directive
		// breaks style/script loading on the http-only local wrangler preview.
	].join("; "),
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
	"X-Frame-Options": "DENY",
	"Cross-Origin-Opener-Policy": "same-origin",
};

/**
 * Apply this middleware's headers to a response whose own headers may be
 * IMMUTABLE, rebuilding it if they are.
 *
 * `caches.default.match()` hands back a Response with a frozen `Headers`, and
 * every `.set()` on it throws `TypeError: Can't modify immutable headers` —
 * which Astro turns into a 500 with an empty body. The Cloudflare adapter's
 * `/_image` endpoint caches through `caches.default`, so once #323 routed every
 * image through it, the SECOND request for each transformed image 500'd and the
 * first did not (#405). Two things hid it: the page renders correctly on the
 * visit that fills the cache, and a `curl -I` answers 200 because a HEAD has no
 * body to fail on.
 *
 * Rebuilding rather than skipping, because that endpoint's `cache.put` runs
 * BEFORE this middleware: the cached copy never carried the #164 headers, so a
 * hit that kept its own would serve an image with no CSP at all.
 */
function applyHeaders(response: Response, patch: [string, string][]): Response {
	try {
		for (const [k, v] of patch) response.headers.set(k, v);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		for (const [k, v] of patch) headers.set(k, v);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

export const onRequest = defineMiddleware(async ({ locals, currentLocale, url, cache }, next) => {
	const locale = currentLocale || "es";
	const t = await loadAriaLabels(locale);
	locals.t = t;

	// The path the visitor actually asked for, kept here for /404 (#418). A miss
	// that arrives through `Astro.rewrite("/404")` re-enters this middleware with
	// the rewritten URL, so only the FIRST pass may write it: without the guard
	// the trace on the 404 page prints `/404` for every one-segment miss.
	if (!locals.requestedPath) locals.requestedPath = url.pathname;
	const response = await next();

	// Collected, not written: `response` may be an immutable one straight out of
	// the Workers cache, and the first `.set()` on those throws. applyHeaders
	// below writes in place when it can and rebuilds when it cannot.
	const patch: [string, string][] = [];

	// ── Edge cache policy (#332/#357): default-deny, opt-in only ──
	// With Workers Cache enabled, a 200 without Cache-Control is heuristically
	// cacheable for ~2h (RFC 9111) — admin pages included. So: pages that
	// opted in through a CMS cacheHint (their accumulated tags prove it) get
	// a 1h edge TTL, which also bounds the staleness of menu/site-settings
	// changes (EmDash 0.34 has no publish hooks for those); everything else
	// gets an explicit no-store. Purge-on-publish: src/plugins/cache-purge.ts.
	if (cache.enabled && cache.tags.length > 0 && !url.pathname.startsWith("/_emdash")) {
		// Footer tags (services cards, partners, the references banner render on
		// every page). Their cache.set calls inside Base/components run
		// mid-stream, AFTER headers — measured: they never reached the edge.
		// Here, post-next() but pre-applyCacheHeaders, is the last moment that
		// counts. Only for pages that opted in themselves: adding tags to
		// /search etc. would silently flip them cacheable.
		const [svc, part, refs] = await Promise.all([
			getEmDashCollection("services", { limit: 1, locale }),
			getEmDashCollection("partners", { limit: 1, locale }),
			getEmDashCollection("references", { limit: 1, locale }),
		]);
		for (const r of [svc, part, refs]) {
			if (r.cacheHint) cache.set(r.cacheHint);
		}
		cache.set({ maxAge: 3600, swr: 60 });
		if (!response.headers.has("Cache-Control")) {
			// browsers revalidate; the edge TTL travels in Cloudflare-CDN-Cache-Control
			patch.push(["Cache-Control", "public, max-age=0, must-revalidate"]);
		}
	} else if (!response.headers.has("Cache-Control")) {
		patch.push(["Cache-Control", "no-store"]);
	}

	// Leave the CMS admin UI alone — it ships its own scripts/styles.
	if (!url.pathname.startsWith("/_emdash")) {
		for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
			patch.push([k, v]);
		}
	}
	return applyHeaders(response, patch);
});
