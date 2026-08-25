import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import webhookNotifier from "@emdash-cms/plugin-webhook-notifier";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	site: "https://www.serverstartup.io",
	output: "server",
	// #334: one URL per page. Under the default "ignore" both /contacto and
	// /contacto/ answered 200 and each self-canonicalised, so the canonical
	// tag consolidated nothing — and the hreflang pair did not reciprocate
	// across the two forms, which is the variant the sitemap declared.
	trailingSlash: "never",
	// #264: greenfield slug aligned with its title (old URLs are live in prod)
	redirects: {
		"/ingenieria-greenfield-y-sistemas-criticos": { status: 301, destination: "/desarrollo-greenfield" },
		"/en/greenfield-engineering-critical-systems": { status: 301, destination: "/en/greenfield-development" },
		// #329: the plugin used to emit these two; anything that cached them
		// keeps working instead of meeting a 404.
		"/sitemap-index.xml": { status: 301, destination: "/sitemap.xml" },
		"/sitemap-0.xml": { status: 301, destination: "/sitemap.xml" },
	},
	i18n: {
		defaultLocale: "es",
		locales: ["es", "en"],
		routing: {
			prefixDefaultLocale: false,
		},
	},
	adapter: cloudflare(),
	// #332: the Astro.cache.set(cacheHint) calls only emit through a
	// provider. This one sets Cloudflare-CDN-Cache-Control + Cache-Tag and
	// purges via cache.purge({tags}) from cloudflare:workers. Edge caching
	// itself is opted in from wrangler.jsonc ("cache": { enabled: true });
	// the default-deny policy lives in src/middleware.ts and the
	// purge-on-publish hooks in src/plugins/cache-purge.ts (#357).
	cache: { provider: cacheCloudflare() },
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [
				formsPlugin(),
				// #357: purge-on-publish. In-repo on purpose — plugin settings
				// are not seedable, so an admin-configured alternative would be
				// silently disarmed by every clean rebuild.
				{
					id: "cache-purge",
					version: "1.0.0",
					entrypoint: "/src/plugins/cache-purge.ts",
					format: "standard",
					// Without content:read the runtime SKIPS every content hook —
					// silently, with only a dev-log warn (measured 2026-08-23).
					capabilities: ["content:read"],
				},
			],
			sandboxed: [webhookNotifier],
			sandboxRunner: sandbox(),
			marketplace: "https://marketplace.emdashcms.com",
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Alexandria",
			cssVariable: "--font-sans",
			weights: [300, 400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
	vite: {
		define: {
			// #379: EmDash builds every preview link from one pattern, and its
			// default `/{collection}/{id}` matched our routes only by accident
			// — services 404'd. Point it at the single preview route, which
			// forwards to the page a reader would see.
			"import.meta.env.EMDASH_PREVIEW_PATH_PATTERN":
				JSON.stringify("/preview/{collection}/{id}"),
		},
		build: {
			// 0 = never inline scripts into the HTML. The middleware CSP is
			// script-src 'self' (no hashes, no unsafe-inline), so any script
			// Vite inlines under the default 4 KB threshold is silently blocked
			// by the browser — menu dialog and phone decode died this way.
			assetsInlineLimit: 0,
		},
	},
});
