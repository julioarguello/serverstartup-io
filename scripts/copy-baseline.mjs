#!/usr/bin/env node
/**
 * Rendered-copy baseline — catches text regressions that compile green.
 *
 * Why a browser and not an HTML parser
 * ------------------------------------
 * The first version of this gate parsed HTML and concatenated text nodes. It
 * reported 26 of 26 routes broken on the Astro 7 migration, and every one was
 * a FALSE POSITIVE.
 *
 * The cause, measured 2026-08-21 with both stacks running side by side:
 * `compressHTML: 'jsx'` strips whitespace-only text nodes between sibling
 * elements. Inside a flex container those nodes never rendered in the first
 * place — CSS Flexbox does not render a whitespace-only anonymous item — so
 * removing them changes nothing a reader sees. An HTML parser cannot know
 * that; it turned each one into a space, and then reported the space missing.
 *
 * Measured on `.search-ps` → `.search-chrome`, with the search actually open:
 *
 *     ASTRO 6      ASTRO 7
 *     hueco 9px    hueco 9px     ← identical; the gap is `margin-right: 9px`
 *     1 text node  0 text nodes  ← the only real difference
 *
 * A gate that cries wolf on every route is worse than no gate: it gets
 * re-baselined on sight, and the day it fires for real nobody looks. So the
 * extraction has to be CSS-aware, which means a browser.
 *
 * `document.body.innerText` is exactly the right primitive: it is defined as
 * the rendered text, so it resolves flex whitespace, `display: none`, and
 * `visibility: hidden` the way the reader's eye does. Content that is hidden
 * until interaction (the search prompt) is legitimately absent — it is not
 * copy anyone is reading.
 *
 * What it still catches — the reason the gate exists
 * ---------------------------------------------------
 * Under JSX whitespace rules two expressions on adjacent lines GLUE:
 *
 *     {posts.length}
 *     {posts.length === 1 ? t("article_singular") : t("article_plural")}
 *
 * renders `12artículos`, not `12 artículos`, in normal flow. `innerText` shows
 * that, because it is a real change in rendered text.
 *
 * It also catches the larger failure: if the CMS read path shifts, whole
 * paragraphs go missing rather than words gluing, and the diff shows it as a
 * lost block.
 *
 * Determinism
 * -----------
 * Viewport is pinned: `innerText` is layout-dependent and a different width
 * would re-wrap responsive content. `networkidle0` plus a settle delay, because
 * measuring during a transition captures the start frame — a lesson this repo
 * has already paid for once in the a11y gate.
 *
 * Usage
 * -----
 *     node scripts/copy-baseline.mjs capture --base-url http://localhost:8787
 *     node scripts/copy-baseline.mjs verify  --base-url http://localhost:8787
 *
 * `verify` exits non-zero and names the file and line of the first difference.
 * Re-run `capture` deliberately when copy legitimately changes — that is the
 * maintenance cost of the gate, accepted knowingly.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const BASELINE_DIR = join(REPO, "tests", "copy-baseline");
const SEED = join(REPO, "seed", "seed.json");

/** Pinned: innerText is layout-dependent, so the width is part of the contract. */
const VIEWPORT = { width: 1440, height: 900 };
/** Measuring mid-transition captures the start frame, not the settled page. */
const SETTLE_MS = 500;

/** Every public route, derived from the CMS seed — same source as sitemap.xml.ts. */
function routes() {
	const data = JSON.parse(readFileSync(SEED, "utf8"));
	const out = [];
	for (const collection of ["pages", "services"]) {
		for (const entry of data.content[collection] ?? []) {
			const slug = entry.slug ?? entry.id;
			const prefix = entry.locale === "en" ? "/en" : "";
			out.push(collection === "pages" && slug === "home" ? prefix || "/" : `${prefix}/${slug}`);
		}
	}
	return [...new Set(out)].sort();
}

const fileFor = (route) => (route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "__")) + ".txt";

async function renderText(page, baseUrl, route) {
	const response = await page.goto(baseUrl.replace(/\/$/, "") + route, {
		waitUntil: "networkidle0",
		timeout: 45000,
	});
	if (!response || response.status() !== 200) {
		throw new Error(`${route} returned HTTP ${response ? response.status() : "no response"}`);
	}
	await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
	const text = await page.evaluate(() => document.body.innerText);
	return (
		text
			.split("\n")
			.map((line) => line.replace(/[^\S\n]+/g, " ").trim())
			.filter(Boolean)
			.join("\n") + "\n"
	);
}

async function withPage(fn) {
	// Same flags as ci-check-a11y.mjs: the GitHub Actions Ubuntu runner has no
	// usable Chromium sandbox (AppArmor user-namespace restrictions), and
	// /dev/shm is too small for Chromium's default shared-memory usage.
	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	try {
		const page = await browser.newPage();
		await page.setViewport(VIEWPORT);
		return await fn(page);
	} finally {
		await browser.close();
	}
}

async function capture(baseUrl) {
	mkdirSync(BASELINE_DIR, { recursive: true });
	// A route removed from the seed must not leave a stale baseline behind,
	// or `verify` keeps asserting a page the site no longer serves.
	const wanted = new Set(routes().map(fileFor));
	for (const existing of existsSync(BASELINE_DIR) ? readdirSync(BASELINE_DIR) : []) {
		if (existing.endsWith(".txt") && !wanted.has(existing)) {
			console.log(`  removing stale ${existing}`);
			writeFileSync(join(BASELINE_DIR, existing), "");
		}
	}
	return withPage(async (page) => {
		for (const route of routes()) {
			const text = await renderText(page, baseUrl, route);
			writeFileSync(join(BASELINE_DIR, fileFor(route)), text, "utf8");
			console.log(`  captured ${route} (${text.length} chars)`);
		}
		console.log(`\n${routes().length} routes captured into tests/copy-baseline/`);
		return 0;
	});
}

async function verify(baseUrl) {
	if (!existsSync(BASELINE_DIR)) {
		console.error(`ERROR: no baseline at ${BASELINE_DIR} — run \`capture\` first`);
		return 2;
	}
	return withPage(async (page) => {
		let failures = 0;
		for (const route of routes()) {
			const path = join(BASELINE_DIR, fileFor(route));
			if (!existsSync(path)) {
				console.error(`FAIL ${route} — no baseline file (${fileFor(route)})`);
				failures++;
				continue;
			}
			const expected = readFileSync(path, "utf8").split("\n");
			const actual = (await renderText(page, baseUrl, route)).split("\n");
			for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
				const want = i < expected.length ? expected[i] : "<end of file>";
				const got = i < actual.length ? actual[i] : "<end of file>";
				if (want !== got) {
					console.error(`FAIL ${fileFor(route)}:${i + 1}  (${route})`);
					console.error(`  baseline: ${want}`);
					console.error(`  rendered: ${got}`);
					failures++;
					break;
				}
			}
		}
		if (failures) {
			console.error(`\n${failures} route(s) differ from the baseline.`);
			console.error("If the change is intentional, re-run `capture` and commit the new baseline.");
			return 1;
		}
		console.log(`${routes().length} routes match the baseline.`);
		return 0;
	});
}

/*
 * Re-baselining: the procedure, and why it is not optional
 * --------------------------------------------------------
 * `verify` runs as a permanent step of ci.yml (#366). A failure is exactly
 * one of two things, never a third:
 *
 *   1. A REGRESSION — copy changed and nobody meant it. Fix the code.
 *   2. An INTENDED copy change — then re-capture and commit the new baseline
 *      IN THE SAME PR, so the diff is reviewed as content:
 *
 *          scripts/ci-local-stack.sh 8787
 *          node scripts/copy-baseline.mjs capture --base-url http://localhost:8787
 *          git add tests/copy-baseline/   # review this diff like prose
 *
 * What must never happen is a re-capture on a red run "to make it pass". This
 * gate already died once that way: its first version cried wolf on 26 of 26
 * routes, and a gate that always fires is a gate nobody reads on the day it is
 * right. If a diff is not obviously one of the two cases above, it is the
 * first one until proven otherwise.
 */

const [mode] = process.argv.slice(2);
const urlFlag = process.argv.indexOf("--base-url");
const baseUrl = urlFlag > -1 ? process.argv[urlFlag + 1] : "http://localhost:8787";

if (mode !== "capture" && mode !== "verify") {
	console.error("usage: copy-baseline.mjs <capture|verify> [--base-url URL]");
	process.exit(2);
}

try {
	process.exit(await (mode === "capture" ? capture(baseUrl) : verify(baseUrl)));
} catch (error) {
	// The observed fact and where to look — never a guessed cause.
	console.error(`ERROR: could not read ${baseUrl} — ${error.message}`);
	console.error("  Is the stack up?  scripts/ci-local-stack.sh 8787");
	process.exit(2);
}
