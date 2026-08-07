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
			filter: (page) => !page.includes("/_emdash/"),
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
