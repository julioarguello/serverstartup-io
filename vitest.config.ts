import { defineConfig } from "vitest/config";

// Pure modules only (#353). The site's real verification is integration —
// 11 gates against a booted stack plus a 26-route smoke battery — and no unit
// test would have caught the sitemap missing 14 routes or the search results
// 404ing. What these cover is the opposite shape: rules whose failure is
// SILENT, where the page renders perfectly with the wrong value.
export default defineConfig({
	test: {
		include: ["tests/unit/**/*.test.ts"],
		environment: "node",
	},
});
