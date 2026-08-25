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
 * `<details>` is the exception, and it is opened before reading. A collapsed
 * panel IS copy someone reads, one click away, and it is CMS-authored like the
 * rest; leaving it out would have quietly exempted the six layer panels of
 * /deconstruyendo from the gate the moment they shipped — measured 2026-08-24,
 * the baseline captured none of their text. A guard with a hole that shape
 * looks exactly like a guard.
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
import { readSeed, localePrefix, seedRoutes } from "./lib/seed-routes.mjs";
import { stackDiagnosis } from "./lib/stack-probe.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const BASELINE_DIR = join(REPO, "tests", "copy-baseline");

/** Pinned: innerText is layout-dependent, so the width is part of the contract. */
const VIEWPORT = { width: 1440, height: 900 };
/** Measuring mid-transition captures the start frame, not the settled page. */
const SETTLE_MS = 500;

/** Every public route, derived from the CMS seed — same source as sitemap.xml.ts. */
const routes = seedRoutes;

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
	// One shared function for capture and verify, so the two halves cannot
	// disagree about what counts as rendered copy.
	const opened = await page.evaluate(() => {
		const all = [...document.querySelectorAll("details")];
		for (const d of all) d.open = true;
		return all.length;
	});
	if (opened > 0) await new Promise((resolve) => setTimeout(resolve, 150));
	const text = await page.evaluate(() => document.body.innerText);
	return (
		text
			.split("\n")
			.map((line) => line.replace(/[^\S\n]+/g, " ").trim())
			.filter(Boolean)
			.join("\n") + "\n"
	);
}

/**
 * The first line where two captures disagree, or null when they are identical.
 * Extracted so the positive control can exercise the very comparator `verify`
 * uses — a control that reimplements the comparison agrees with itself, not
 * with the gate.
 */
function firstDifference(expected, actual) {
	for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
		const want = i < expected.length ? expected[i] : "<end of file>";
		const got = i < actual.length ? actual[i] : "<end of file>";
		if (want !== got) return { line: i + 1, want, got };
	}
	return null;
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


/*
 * Positive control (#385)
 * -----------------------
 * Three ways this gate can go quiet while still printing "26 routes match the
 * baseline": the route list stops enumerating anything, `renderText` stops
 * returning text (a selector change, a page that renders empty), or the
 * comparator stops finding differences. All three look identical from the
 * outside — a green line — so the run proves each of them false before it
 * trusts a single route.
 *
 * The fixture is a mutation of what the browser just rendered, held in
 * memory. Nothing is planted in `tests/copy-baseline/`: a canary living in the
 * tree it guards is how the citability gate died the second time (#347).
 */
async function positiveControl(page, baseUrl) {
	const blind = [];
	const list = routes();

	// Reported before anything is fetched: with no routes there is nothing to
	// render, and the browser's own "invalid URL" would bury the real cause.
	//
	// The floor is the BASELINES ON DISK, not a number written here. A count
	// like `< 2` passes a derivation that has quietly lost most of the site:
	// renaming one collection in the seed dropped 12 of 26 routes and this
	// still printed "14 routes match the baseline" — verifying half a site and
	// calling it clean. `tests/copy-baseline/` is committed and regenerated by
	// `capture`, so it is the recorded inventory to check against, and a
	// non-empty file no route claims means that route stopped being verified.
	// (An intentional deletion leaves an EMPTY file: `capture` truncates the
	// baselines of routes the seed no longer declares.)
	const orphans = (existsSync(BASELINE_DIR) ? readdirSync(BASELINE_DIR) : [])
		.filter((f) => f.endsWith(".txt"))
		.filter((f) => !list.map(fileFor).includes(f))
		.filter((f) => readFileSync(join(BASELINE_DIR, f), "utf8").trim() !== "");
	if (list.length < 2 || orphans.length) {
		console.error("THIS GATE IS BLIND — routes() enumerated " +
			`${list.length} route(s) from seed/seed.json, but ` +
			`${orphans.length} committed baseline(s) belong to no route:`);
		for (const f of orphans.slice(0, 8)) console.error(`    ${f}`);
		console.error("  → the seed's collection names or shape changed, and the routes still");
		console.error("    have baselines but are no longer being compared. Fix routes().");
		console.error("    If a page was deliberately removed, re-run `capture` — it empties");
		console.error("    the baseline of a route the seed no longer declares.");
		return false;
	}

	const rendered = await renderText(page, baseUrl, list[0]);
	const lines = rendered.split("\n");
	if (lines.filter(Boolean).length < 5) {
		blind.push(`${list[0]} rendered ${lines.filter(Boolean).length} line(s) of copy — ` +
			"innerText is returning nothing to compare");
	}

	// a lost line, a changed word, and a truncated capture — the three shapes
	// a real regression takes
	const mutations = [
		["a deleted line", lines.filter((_, i) => i !== 1)],
		["a changed word", lines.map((l, i) => (i === 1 ? l + " CANARIO" : l))],
		["a truncated capture", lines.slice(0, Math.max(1, lines.length - 2))],
	];
	for (const [what, mutated] of mutations) {
		if (!firstDifference(lines, mutated)) blind.push(`the comparator did not notice ${what}`);
	}
	if (firstDifference(lines, [...lines])) {
		blind.push("the comparator reported a difference between a capture and itself");
	}

	if (blind.length) {
		console.error("THIS GATE IS BLIND — it can no longer tell a changed page from an");
		console.error("unchanged one, so 'routes match the baseline' would mean nothing:");
		for (const b of blind) console.error(`  ${b}`);
		console.error("  → check routes(), renderText() and firstDifference() before");
		console.error("    trusting any result, and do NOT re-capture to make it pass.");
		return false;
	}
	console.log(`  ok   positive control — ${list.length} routes enumerated, ` +
		`${lines.filter(Boolean).length} lines read from ${list[0]}, ` +
		"3 planted differences all found");
	return true;
}


/*
 * The menu is NOT in the frozen-copy contract — and why (#384)
 * ------------------------------------------------------------
 * The whole site row of the menu — Inicio, Quiénes somos, Referencias,
 * Contacto, Deconstruyendo — vanished from both locales on every page and
 * shipped to main (#382). Fourteen gates ran on every one of those commits and
 * none could have caught it: `innerText` is defined as the RENDERED text, the
 * menu lives in a `<dialog>` that is closed at rest, and a closed dialog
 * renders nothing. The baseline for all 26 routes is byte-identical whether
 * the menu has eleven links, six, or none.
 *
 * The obvious repair — open the dialog before reading, the way `<details>` is
 * opened — was rejected, and this is the record of why:
 *
 *   · `showModal()` makes the rest of the document inert and moves focus, so
 *     the capture would no longer be of the page a reader sees;
 *   · the menu carries the die and the search prompt, so its text would join
 *     the baseline of all 26 routes — a large one-time recapture, and every
 *     future menu edit would touch 26 files for a change to one component.
 *     That coupling has already cost a manual revert once (#381).
 *
 * So the menu gets its own, much smaller assertion, and it is a STRUCTURAL one
 * rather than a copy one: the links the seed declares must be the links the
 * menu renders. That is stronger than counting rows. Both `FACE_BY_SLUG` and
 * `SITE_BY_PATH` drop an unmapped entry SILENTLY — the mechanism behind the
 * site shipping with no way back home (#273) — and comparing against the seed
 * catches a dropped entry, a renamed slug and a whole missing row alike, with
 * no number for anyone to keep up to date.
 */

/** What the seed says each locale's menu must contain. */
function menuExpectation() {
	const data = readSeed();
	const out = {};
	for (const locale of ["es", "en"]) {
		const prefix = localePrefix(locale);
		const spec = (data.content.services ?? [])
			.filter((e) => (e.locale ?? "es") === locale)
			.map((e) => `${prefix}/${e.slug ?? e.id}`);
		const menu = (data.menus ?? []).find((m) => (m.name ?? m.id) === `site_${locale}`);
		const site = (menu?.items ?? []).map((i) => i.url).filter(Boolean);
		out[locale] = { spec, site, entry: prefix || "/" };
	}
	return out;
}

/** Open the menu the way a reader does, and read both rows out of it. */
async function readMenu(page, baseUrl, route) {
	const response = await page.goto(baseUrl.replace(/\/$/, "") + route, {
		waitUntil: "networkidle0",
		timeout: 45000,
	});
	if (!response || response.status() !== 200) {
		throw new Error(`${route} returned HTTP ${response ? response.status() : "no response"}`);
	}
	await page.click("#menu-trigger");
	await page.waitForFunction(() => document.getElementById("menu-dialog")?.open === true,
		{ timeout: 5000 });
	return page.evaluate(() => {
		const read = (sel) => [...document.querySelectorAll(sel)].map((a) => ({
			href: new URL(a.getAttribute("href"), location.origin).pathname,
			text: a.textContent.replace(/\s+/g, " ").trim(),
		}));
		return { spec: read(".menu-spec a"), site: read(".menu-site a") };
	});
}

/**
 * Structured rather than a list of strings, so the control below can assert the
 * one number that means something — how many expected links went MISSING —
 * instead of a total that also moves when a slug is renamed or a label empties.
 */
function compareRow(expected, rendered) {
	const got = new Set(rendered.map((l) => l.href));
	return {
		missing: expected.filter((href) => !got.has(href)),
		unexpected: rendered.filter((l) => !expected.includes(l.href)).map((l) => l.href),
		unlabelled: rendered.filter((l) => !l.text).map((l) => l.href),
	};
}

function rowProblems(where, cmp) {
	return [
		...cmp.missing.map((href) => `${where}: the menu does not render ${href}`),
		...cmp.unexpected.map((href) => `${where}: unexpected link ${href}`),
		...cmp.unlabelled.map((href) => `${where}: ${href} renders with no label`),
	];
}

/**
 * Assert the menu of both locales, on two routes each — the home and a deep
 * page, because the menu is shared chrome injected by Base and a page that
 * passed it a different list would only show up on that page.
 */
async function verifyMenu(page, baseUrl) {
	const expected = menuExpectation();
	const problems = [];
	let links = 0;

	for (const [locale, want] of Object.entries(expected)) {
		if (!want.spec.length || !want.site.length) {
			problems.push(`the seed declares ${want.spec.length} specialty and ` +
				`${want.site.length} site links for ${locale} — there is nothing to compare ` +
				"against, so this check would pass over any menu at all");
			continue;
		}
		for (const route of [want.entry, want.spec[0]]) {
			// A menu that cannot be opened is the very regression class this
			// check exists for — a missing #menu-trigger, a dialog that never
			// opens. Left to throw it would reach the top-level handler, which
			// reports "could not read <url> — is the stack up?" and exits 2,
			// skipping all 26 baseline comparisons behind a cause that is not
			// the real one.
			let menu;
			try {
				menu = await readMenu(page, baseUrl, route);
			} catch (error) {
				const gone = await stackDiagnosis(baseUrl);
				problems.push(
					`${route}: the menu could not be opened and read — ${error.message}` +
						(gone ? `\n${gone}` : ""),
				);
				continue;
			}
			problems.push(...rowProblems(`${route} · specialties`, compareRow(want.spec, menu.spec)));
			problems.push(...rowProblems(`${route} · site`, compareRow(want.site, menu.site)));
			links += menu.spec.length + menu.site.length;

			// Positive control, on this very page: delete every link the menu
			// rendered and require the comparison to then report EVERY link the
			// seed declares as missing. A selector that stopped matching would
			// otherwise report an empty menu as "no problems" — the shape of
			// blindness this check exists to end.
			//
			// The invariant is the missing COUNT after the deletion, not a delta
			// against the count before it. An earlier version subtracted the two,
			// and a genuine regression — a renamed slug, which produces one
			// missing link AND one unexpected one — made the arithmetic disagree
			// and the control accuse itself while the check was working perfectly.
			const removed = await page.evaluate(() => {
				const row = [...document.querySelectorAll(".menu-spec a, .menu-site a")];
				row.forEach((a) => a.remove());
				return row.length;
			});
			const gone = await page.evaluate(() => {
				const read = (sel) => [...document.querySelectorAll(sel)].map((a) => ({
					href: new URL(a.getAttribute("href"), location.origin).pathname,
					text: a.textContent.trim(),
				}));
				return { spec: read(".menu-spec a"), site: read(".menu-site a") };
			});
			const after = compareRow(want.spec, gone.spec).missing.length
				+ compareRow(want.site, gone.site).missing.length;
			const declared = want.spec.length + want.site.length;
			if (removed === 0) {
				problems.push(`the control could not run on ${route}: the page had no menu ` +
					"links to delete, so nothing here proves the comparison still works");
			} else if (after !== declared) {
				problems.push(`THIS CHECK IS BLIND on ${route}: every rendered link was ` +
					`deleted (${removed}) and the comparison reported ${after} of the ` +
					`${declared} declared links missing`);
			}
		}
	}

	if (problems.length) {
		console.error("FAIL menu — the rendered menu does not match seed/seed.json:");
		for (const p of problems) console.error(`  ${p}`);
		console.error("  The menu lives in a closed <dialog>, so the copy baselines above");
		console.error("  cannot see it: this is the only gate that can. If the change is");
		console.error("  intentional, it belongs in seed/seed.json (menus.site_es/site_en)");
		console.error("  or in the services collection — not in the template.");
		return false;
	}
	console.log(`  ok   menu — ${links} links across 4 pages match seed/seed.json, ` +
		"both locales, and deleting them was seen every time");
	return true;
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
		if (!(await positiveControl(page, baseUrl))) return 3;
		// #384: the menu, which no baseline below can see.
		const menuOk = await verifyMenu(page, baseUrl);
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
			const diff = firstDifference(expected, actual);
			if (diff) {
				console.error(`FAIL ${fileFor(route)}:${diff.line}  (${route})`);
				console.error(`  baseline: ${diff.want}`);
				console.error(`  rendered: ${diff.got}`);
				failures++;
			}
		}
		// Both results are always reported, whichever failed. A menu failure used
		// to swallow the route outcome, so a run could not tell "the baselines
		// were never compared" from "they compared clean".
		if (failures) {
			console.error(`\n${failures} route(s) differ from the baseline.`);
			console.error("If the change is intentional, re-run `capture` and commit the new baseline.");
			// Re-capturing does NOT apply to the menu check: its expectation is
			// the seed, so there is no baseline to refresh.
		} else {
			console.log(`${routes().length} routes match the baseline.`);
		}
		return failures || !menuOk ? 1 : 0;
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
	console.error(
		(await stackDiagnosis(baseUrl)) ||
			"  The stack IS answering, so a dead stack is not the cause.",
	);
	console.error("  Boot it with:  scripts/ci-local-stack.sh 8787");
	process.exit(2);
}
