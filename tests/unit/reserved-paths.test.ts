/**
 * `src/fetch.*` is a RESERVED entrypoint in Astro 7 (#359).
 *
 * Advanced Routing gives a file at the source root full control of the
 * request pipeline. The panel that judged #359 kept the 404 locale rewrite,
 * the legacy-slug 301s and the CSP where they are, so this project has no
 * routing entrypoint and does not want one by accident: a file dropped at
 * that path for an unrelated purpose is picked up silently and starts
 * answering every request.
 *
 * Verified against `node_modules/astro/dist/core/fetch/vite-plugin.js`
 * (astro 7.2.4): the stem is `DEFAULT_FETCH_FILE = "fetch"`, resolved as
 * `this.resolve(srcDir + fetchFile)` — so it is Vite that picks the
 * extension. The issue named `src/fetch.ts`; the reserved surface is wider,
 * and this guard rejects the STEM rather than guessing Vite's extension
 * list. `fetchFile` in astro.config.mjs renames it, and `fetchFile: null`
 * disables it — either one makes a file at that path a deliberate act, and
 * the guard steps aside.
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");

/** What a Vite resolve of `<srcDir>/fetch` could pick up, whatever the extension. */
function reservedEntrypoints(root: string, stem = "fetch"): string[] {
	const src = join(root, "src");
	if (!existsSync(src)) return [];
	return readdirSync(src, { withFileTypes: true })
		.filter((e) => (e.isDirectory() ? e.name === stem : parse(e.name).name === stem))
		.map((e) => `src/${e.name}`)
		.sort();
}

/** Does the project's config say the entrypoint is deliberate (renamed or off)? */
function fetchFileDeclared(root: string): boolean {
	const config = join(root, "astro.config.mjs");
	if (!existsSync(config)) return false;
	return /^\s*fetchFile\s*:/m.test(readFileSync(config, "utf8"));
}

function offenders(root: string): string[] {
	return fetchFileDeclared(root) ? [] : reservedEntrypoints(root);
}

/** A throwaway project tree — the control never lives in the repo it guards. */
function fixture(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "reserved-paths-"));
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(root, rel);
		mkdirSync(join(abs, ".."), { recursive: true });
		writeFileSync(abs, body);
	}
	return root;
}

describe("reserved Astro entrypoints", () => {
	it("finds a planted src/fetch.ts — the control that proves the scan reads the tree", () => {
		const root = fixture({ "src/fetch.ts": "export default {};\n", "astro.config.mjs": "export default {};\n" });
		expect(offenders(root)).toEqual(["src/fetch.ts"]);
	});

	it("finds the stem under any extension, and as a directory", () => {
		expect(offenders(fixture({ "src/fetch.js": "" }))).toEqual(["src/fetch.js"]);
		expect(offenders(fixture({ "src/fetch/index.ts": "" }))).toEqual(["src/fetch"]);
	});

	it("steps aside when astro.config.mjs declares fetchFile", () => {
		const root = fixture({
			"src/fetch.ts": "",
			"astro.config.mjs": "export default defineConfig({\n\tfetchFile: null,\n});\n",
		});
		expect(offenders(root)).toEqual([]);
	});

	it("does not fire on a tree that has no such file", () => {
		expect(offenders(fixture({ "src/middleware.ts": "" }))).toEqual([]);
	});

	it("this repository has no routing entrypoint it did not ask for", () => {
		expect(existsSync(join(ROOT, "src"))).toBe(true); // the scan has a tree to read
		expect(offenders(ROOT)).toEqual([]);
	});
});
