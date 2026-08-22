import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import { webhookNotifierPlugin } from "@emdash-cms/plugin-webhook-notifier";
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
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [formsPlugin()],
			sandboxed: [webhookNotifierPlugin()],
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
		build: {
			// 0 = never inline scripts into the HTML. The middleware CSP is
			// script-src 'self' (no hashes, no unsafe-inline), so any script
			// Vite inlines under the default 4 KB threshold is silently blocked
			// by the browser — menu dialog and phone decode died this way.
			assetsInlineLimit: 0,
		},
	},
});
