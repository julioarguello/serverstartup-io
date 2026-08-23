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

export const onRequest = defineMiddleware(async ({ locals, currentLocale, url, cache }, next) => {
	const locale = currentLocale || "es";
	const t = await loadAriaLabels(locale);
	locals.t = t;
	const response = await next();

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
			response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
		}
	} else if (!response.headers.has("Cache-Control")) {
		response.headers.set("Cache-Control", "no-store");
	}

	// Leave the CMS admin UI alone — it ships its own scripts/styles.
	if (!url.pathname.startsWith("/_emdash")) {
		for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
			response.headers.set(k, v);
		}
	}
	return response;
});
