import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
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
		sitemap({
			i18n: {
				defaultLocale: "es",
				locales: { es: "es-ES", en: "en-US" },
			},
			// #335: the admin, plus routes that must not be offered to the index —
			// internal search results, and blog indexes with no posts (soft-404
			// candidates until #340 gives them content). A sitemap declares the
			// URLs you WANT indexed; these carry noindex, so listing them would
			// be asking Google to crawl what we just told it to skip.
			filter: (page) =>
				!page.includes("/_emdash/") &&
				!/\/(en\/)?(search|posts)\/?$/.test(new URL(page).pathname),
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
