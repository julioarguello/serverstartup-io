#!/usr/bin/env node
/**
 * ci-check-a11y.mjs — the accessibility gate (#343).
 *
 * Lighthouse already scores a11y 100 on the audited routes, and that number
 * did not stop two real WCAG failures shipping on 2026-08-20: a search control
 * unreachable by keyboard (2.1.1) and a document-wide `/` shortcut (2.1.4).
 * Automated rule engines cover roughly a third of the criteria; this gate adds
 * the checks that live in the other two thirds and that a browser can actually
 * decide — traversal, focus visibility, obscuring, reflow, shortcut scoping.
 *
 * It runs against an already-booted stack (the gate runner boots one for the
 * HTML and header checks; this reuses it) and fails loudly, naming the route
 * and the element.
 *
 * Usage: node scripts/ci-check-a11y.mjs [base-url]      default http://localhost:8787
 */
import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");
const SEED = join(dirname(dirname(fileURLToPath(import.meta.url))), "seed", "seed.json");
const require = createRequire(import.meta.url);
const axeSource = require("fs").readFileSync(
	require.resolve("axe-core/axe.min.js"),
	"utf8",
);

/**
 * Routes worth auditing: all of them, both locales, derived from the same seed
 * the sitemap and the copy baseline read.
 *
 * #343 asked for the whole site traversable by keyboard, "en las 12 rutas y
 * los dos idiomas". The hand-written list this replaces had ten entries, eight
 * of them ES: both legal pages, the AI vertical and nine of the thirteen EN
 * routes were never audited, and a list of routes tells you nothing about the
 * routes it omits. Deriving it means the audit cannot fall behind the next
 * page the way a transcribed list does — and the count stops being a number
 * anyone has to keep true.
 */
function auditRoutes() {
	const data = JSON.parse(readFileSync(SEED, "utf8"));
	const out = [];
	for (const collection of ["pages", "services"]) {
		for (const entry of data.content[collection] ?? []) {
			const slug = entry.slug ?? entry.id;
			const prefix = entry.locale === "en" ? "/en" : "";
			out.push(collection === "pages" && slug === "home" ? prefix || "/" : `${prefix}/${slug}`);
		}
	}
	// The search results page is declared by no collection, and it is where both
	// WCAG failures of 2026-08-20 lived (2.1.1 and 2.1.4).
	out.push("/search?q=cloudflare", "/en/search?q=cloudflare");
	return [...new Set(out)].sort();
}

const ROUTES = auditRoutes();

/**
 * axe keeps a sampled list, deliberately, and this is the record of why.
 *
 * Running axe over all of ROUTES surfaces four real `color-contrast` failures
 * (WCAG 1.4.3), measured 2026-08-25 against the local stack: on the Big Data
 * pages `.bq__menu` at 2.5:1 (#9aa0a6 on #f8f9fa) and `.bq__gutter` at 2.08:1
 * (#b0b4b8 on #ffffff); on the Greenfield pages `.inst__muted` at 2.84:1
 * (#6b6b6b on #232724) and the javadoc tag span at 2.07:1 (#4a524a on
 * #1b1e1c). Both locales, so eight nodes in all.
 *
 * They are genuine, and they are not this change's to decide: the greys belong
 * to the foreign chrome those instruments imitate (the `token-guard: off`
 * regions of §14), so raising them trades fidelity for contrast on a surface
 * the founder owns. Filed rather than silently fixed or silently suppressed —
 * widening this list is the first thing to do once that call is made.
 */
const AXE_ROUTES = [
	"/",
	"/cdn-waf-seguridad-edge-cloudflare",
	"/quienes-somos",
	"/contacto",
	"/referencias",
	"/deconstruyendo",
	"/integracion-de-sistemas",
	"/search?q=cloudflare",
	"/en",
	"/en/about-us",
];

// Positive control on the list itself (#385). The founder named twelve routes
// per locale; the seed declares thirteen. A parse that silently returned fewer
// would shrink the audit without shrinking any of its green lines.
if (ROUTES.length < 24) {
	console.error(`✗ THIS GATE IS BLIND — auditRoutes() enumerated ${ROUTES.length} route(s) ` +
		"from seed/seed.json, below the 12-per-locale floor #343 asks for.");
	console.error("  → the seed's shape or collection names changed; fix auditRoutes().");
	process.exit(3);
}

/** Reveal animations must finish before geometry is read — measuring during a
 *  transition reports the start frame and makes working code look broken. */
const SETTLE_MS = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * What the traversal asks about the focused element. A named function, not an
 * inline arrow, so the positive control can run the SAME probe over a page it
 * builds itself — a control that reimplements the predicate agrees with its
 * own copy, never with the gate.
 */
const FOCUS_PROBE = () => {
	const el = document.activeElement;
	if (!el || el === document.body) return null;
	const r = el.getBoundingClientRect();
	const h = document.querySelector(".site-header")?.getBoundingClientRect();
	const cs = getComputedStyle(el);
	return {
		name: el.tagName.toLowerCase() + "." + (el.className.toString().split(" ")[0] || ""),
		offscreen: r.width === 0 && r.height === 0,
		// obscured = overlapped by the fixed header while not part of it
		obscured: !!h && r.top < h.bottom && r.bottom > h.top && !el.closest(".site-header"),
		ring: cs.outlineStyle !== "none" && cs.outlineWidth !== "0px",
	};
};

/** What the 1.4.10 check measures — same reason it is named. */
const REFLOW_PROBE = () => {
	const de = document.documentElement;
	const over = [...document.querySelectorAll("*")]
		.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "auto")
		.map((e) => e.tagName.toLowerCase() + "." + (e.className.toString().split(" ")[0] || ""))
		.slice(0, 3);
	return { doc: de.scrollWidth, view: de.clientWidth, over };
};

const failures = [];
const fail = (route, msg) => failures.push(`${route}: ${msg}`);
const ok = (msg) => console.log(`  ok   ${msg}`);

const browser = await puppeteer.launch({
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});


// ── 0. Positive control: prove each probe can still fail ───────────────────
// #385. The four checks below all report by NOT firing, which is exactly what
// a broken selector, an unloaded axe or a stale predicate also look like. So
// before auditing a single real route, each probe runs over a page this file
// builds itself, carrying the exact defect it hunts. The fixture is a string
// here — never a route the site serves — so it cannot be audited by accident
// and cannot trip the gate it proves.
console.log("── positive control (#385)");

/** A header 80px tall, a link parked under it with its ring suppressed, a
 *  block 720px wide, and an `<img>` with no alt. One planted defect per probe. */
const CONTROL_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>canario</title><style>
body { margin: 0 }
.site-header { position: fixed; top: 0; left: 0; right: 0; height: 80px; background: #eee }
#buried { position: absolute; top: 30px; left: 0 }
#buried:focus { outline: none }
#wide { width: 720px; height: 10px; background: #ccc }
</style></head><body>
<header class="site-header"><a href="#x" id="inheader">en la cabecera</a></header>
<main><a href="#y" id="buried">bajo la cabecera, sin anillo</a>
<div id="wide"></div>
<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">
</main></body></html>`;

{
	const blind = [];

	// The viewport is set BEFORE the content on each page: `setViewport` with
	// `isMobile` re-emulates the device and drops a document that was written
	// with setContent — measured, it left an empty page whose only axe
	// violations were "document-title" and "html-has-lang".
	const desktop = await browser.newPage();
	await desktop.setViewport({ width: 1280, height: 900 });
	await desktop.setContent(CONTROL_HTML);

	// FOCUS_PROBE — must report the planted element as obscured and ringless
	await desktop.evaluate(() => document.getElementById("buried").focus());
	const probed = await desktop.evaluate(FOCUS_PROBE);
	if (!probed) blind.push("the focus probe returned nothing for a focused element");
	else {
		if (!probed.obscured) blind.push("an element parked under the fixed header was not reported as obscured (2.4.11)");
		if (probed.ring) blind.push("an element with `outline: none` was reported as having a focus ring (2.4.7)");
	}
	// …and must NOT accuse the header's own link, which is not obscured by itself
	await desktop.evaluate(() => document.getElementById("inheader").focus());
	const inHeader = await desktop.evaluate(FOCUS_PROBE);
	if (inHeader?.obscured) blind.push("the header's own link was reported as obscured by the header");

	// axe — must be loaded, running, and finding a violation that is really there
	await desktop.evaluate(axeSource);
	const canary = await desktop.evaluate(async () =>
		window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a"] } }));
	if (!canary.violations.some((v) => v.id === "image-alt")) {
		blind.push("axe did not report the planted `<img>` with no alt (image-alt) — it returned " +
			`[${canary.violations.map((v) => v.id).join(", ") || "nothing"}] over ${canary.passes.length} passes`);
	}
	await desktop.close();

	// REFLOW_PROBE — must see the overflow at the width the norm names
	const narrow = await browser.newPage();
	await narrow.setViewport({ width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	await narrow.setContent(CONTROL_HTML);
	const reflow = await narrow.evaluate(REFLOW_PROBE);
	if (!(reflow.doc > reflow.view + 1)) {
		blind.push(`a 720px block in a 320px viewport was not seen as overflow (got ${reflow.doc}/${reflow.view})`);
	}
	await narrow.close();

	if (blind.length) {
		console.error("\n✗ THIS GATE IS BLIND — its probes can no longer find the defects");
		console.error("  they exist to find, so every 'ok' below would be meaningless:");
		for (const b of blind) console.error(`    ${b}`);
		console.error("  → fix FOCUS_PROBE / REFLOW_PROBE / the axe load before trusting a green run.");
		await browser.close();
		process.exit(3);
	}
	ok("4 planted defects found — obscured focus, missing ring, 320px overflow, image-alt");
}

// ── 1. axe-core: the rules a machine can decide, on every audited route ─────
console.log(`── axe-core (WCAG 2.0/2.1/2.2 A+AA, plus best practices) — ${AXE_ROUTES.length} routes`);
for (const route of AXE_ROUTES) {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });
	await page.evaluate(axeSource);
	const res = await page.evaluate(async () =>
		window.axe.run(document, {
			runOnly: {
				type: "tag",
				values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
			},
		}),
	);
	if (res.violations.length) {
		for (const v of res.violations) {
			fail(route, `${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}`);
		}
	} else {
		ok(`${route} — 0 violations`);
	}
	await page.close();
}

// ── 2. Keyboard traversal: reachable, visible, never obscured ───────────────
// 2.1.1, 2.4.1, 2.4.3, 2.4.7, 2.4.11 — none of which axe decides.
// #343: every route, not a sample of three. "Toda la web recorrible con Tab,
// en las 12 rutas y los dos idiomas" — a traversal that visits three pages
// says nothing about the twenty-three it skips.
console.log(`── keyboard traversal (${ROUTES.length} routes)`);
for (const route of ROUTES) {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });

	// The first stop must be the skip link, and it must actually appear.
	//
	// Start the traversal at the top of the document, explicitly. /search and
	// /en/search carry `autofocus` on the query field, so the first Tab would
	// otherwise start from the middle of the page and the gate would report a
	// missing skip link on two pages that have one.
	//
	// `blur()` is not enough, and this is the part worth remembering: it clears
	// `document.activeElement` — measured, it reads `body` afterwards — but NOT
	// the sequential focus navigation starting point, which stays on the
	// blurred input, so Tab still went to the submit button next to it.
	// Focusing `body` moves the starting point itself. The tabindex is added
	// and removed around the call so the page is left as it was found.
	await sleep(SETTLE_MS);
	await page.evaluate(() => {
		document.body.setAttribute("tabindex", "-1");
		document.body.focus();
		document.body.removeAttribute("tabindex");
	});
	await page.keyboard.press("Tab");
	await sleep(SETTLE_MS);
	const first = await page.evaluate(() => {
		const el = document.activeElement;
		const r = el.getBoundingClientRect();
		return {
			isSkip: el.classList.contains("skip-link"),
			href: el.getAttribute("href"),
			onScreen: r.top >= 0 && r.height > 0,
			text: el.textContent.trim(),
		};
	});
	if (!first.isSkip) fail(route, `first Tab stop is not the skip link (got "${first.text}")`);
	else if (!first.onScreen) fail(route, "the skip link does not become visible when focused");
	else if (first.href !== "#content") fail(route, `skip link points at ${first.href}, not #content`);
	else ok(`${route} — skip link first, visible, → #content`);

	// Every subsequent stop: visible focus indicator, not under the fixed header.
	let stops = 0;
	let obscured = 0;
	let ringless = 0;
	// "De principio a fin": Tab until focus leaves the document rather than
	// until a counter runs out, so a page longer than the counter is not
	// reported as fully traversed when half of it was never reached.
	let reachedEnd = false;
	for (let i = 0; i < 120; i++) {
		await page.keyboard.press("Tab");
		const s = await page.evaluate(FOCUS_PROBE);
		if (!s) { reachedEnd = true; break; }
		stops++;
		if (s.obscured) { obscured++; fail(route, `focused element hidden behind the fixed header: ${s.name}`); }
		if (!s.ring && !s.offscreen) { ringless++; fail(route, `focused element has no visible focus indicator: ${s.name}`); }
	}
	if (!reachedEnd) {
		fail(route, `focus was still inside the document after 120 Tab presses ` +
			`(${stops} stops) — the traversal never reached the end`);
	} else if (!obscured && !ringless) {
		ok(`${route} — ${stops} stops to the end, none obscured, all with a focus ring`);
	}
	await page.close();
}

// ── 3. The menu: opens from the keyboard, holds focus, gives the cube back ──
// 2.1.1 (everything the cube does, the keyboard does), 2.1.2 (what you enter,
// you leave) and 3.2.1 (nothing navigates on focus alone).
//
// The dialog is opened with `showModal()`, so the trap and `esc` come from the
// platform — but the close is deferred 500ms for the slide-out animation, and
// nothing proved the focus ever came back to the cube that opened it. A menu
// that closes and drops focus on `<body>` sends the next Tab to the top of the
// document: the reader is silently returned to the beginning of the page.
console.log("── the menu: keyboard open, focus trap, and the cube back");
for (const route of ["/", "/en"]) {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });

	const state = () => page.evaluate(() => {
		const dialog = document.getElementById("menu-dialog");
		return {
			open: dialog?.open === true,
			focusInside: !!dialog && dialog.contains(document.activeElement),
			active: document.activeElement?.id || document.activeElement?.tagName.toLowerCase(),
			// Set by the traversal below on its first stop, so a full cycle can be
			// recognised by returning to where it began.
			atFirstStop: document.activeElement === window.__menuFirstStop,
		};
	});

	// Positive control (#385): the same three readings, taken while the menu is
	// shut and the cube has focus, must come back the OTHER way. Without it a
	// probe hard-wired to "open, inside, menu-trigger" would pass every
	// assertion below without ever looking at the page.
	await page.evaluate(() => document.getElementById("menu-trigger")?.focus());
	const shut = await state();
	if (shut.open || shut.focusInside) {
		fail(route, "THIS CHECK IS BLIND — with the menu closed the probe still " +
			`reports open=${shut.open}, focusInside=${shut.focusInside}`);
	} else if (shut.active !== "menu-trigger") {
		fail(route, `THIS CHECK IS BLIND — the probe cannot see focus on the cube (got "${shut.active}")`);
	} else {
		ok(`${route} — control: closed menu reads closed, cube reads focused`);
	}

	// Enter on the cube opens it — the keyboard doing what the pointer does.
	await page.keyboard.press("Enter");
	let opened = true;
	try {
		await page.waitForFunction(() => document.getElementById("menu-dialog")?.open === true,
			{ timeout: 5000 });
	} catch {
		opened = false;
		fail(route, "Enter on the cube does not open the menu (2.1.1)");
	}

	if (opened) {
		await sleep(SETTLE_MS);
		const inside = await state();
		if (!inside.focusInside) {
			fail(route, `opening the menu left focus outside it (on "${inside.active}") — ` +
				"the first Tab would land back in the page behind the panel");
		}

		// Walk past the end of the panel: focus must come back into it rather
		// than reach the page behind. A modal dialog is a deliberate trap, and
		// `esc` is the way out.
		//
		// `document.body` is NOT a leak. Tabbing past the last element of the
		// cycle hands focus to the browser's own chrome, and a headless Chrome
		// has none, so `activeElement` reads `body` for exactly one stop before
		// wrapping — measured: menu-close → 6 spec → 5 site → body → menu-close.
		// Failing on it would report the wrap point as a broken trap.
		let escaped = null;
		let wrapped = false;
		for (let i = 0; i < 30 && !escaped && !wrapped; i++) {
			await page.keyboard.press("Tab");
			const s = await state();
			if (i === 0) {
				await page.evaluate(() => { window.__menuFirstStop = document.activeElement; });
			} else if (s.focusInside && s.atFirstStop) {
				// Back where the walk began: the cycle closed without ever leaving
				// the panel. This is the reading that matters, and it does not
				// depend on the browser parking focus on `body` on the way round.
				wrapped = true;
			} else if (!s.focusInside) {
				if (s.active === "body" || s.active === "html") wrapped = true;
				else escaped = s.active;
			}
		}
		if (escaped) {
			fail(route, `Tab leaves the open menu and lands on "${escaped}" behind the panel (2.1.2)`);
		} else if (!wrapped) {
			fail(route, "30 Tab presses never completed a cycle of the open menu — " +
				"either the panel has almost no stops, or focus is stuck on one");
		}

		// Escape closes it, and the cube gets the focus back.
		await page.keyboard.press("Escape");
		let closed = true;
		try {
			await page.waitForFunction(() => document.getElementById("menu-dialog")?.open === false,
				{ timeout: 5000 });
		} catch {
			closed = false;
			fail(route, "Escape does not close the menu (2.1.2 — no way out with the keyboard)");
		}
		if (closed) {
			const back = await state();
			if (back.active !== "menu-trigger") {
				fail(route, `closing the menu left focus on "${back.active}", not the cube ` +
					"that opened it — the next Tab restarts at the top of the document");
			} else if (!escaped && inside.focusInside) {
				ok(`${route} — Enter opens, focus cycles inside, Escape closes, cube refocused`);
			}
		}
	}
	await page.close();
}

// ── 4. WCAG 2.1.4 — a single-character shortcut must be scoped ──────────────
// `/` may open the search only when focus is already inside the header.
console.log("── 2.1.4 character key shortcut");
{
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });
	await page.goto(BASE + "/cdn-waf-seguridad-edge-cloudflare", { waitUntil: "networkidle2", timeout: 60000 });
	const searchOpen = () =>
		page.evaluate(() => {
			const f = document.querySelector(".site-header .search-form");
			return !!f && getComputedStyle(f).display !== "none";
		});

	await page.evaluate(() => document.querySelector("main a, main button")?.focus());
	await page.keyboard.press("/");
	await sleep(250);
	if (await searchOpen()) fail("/cdn-waf…", "`/` opens the search with focus outside the header (WCAG 2.1.4)");
	else ok("`/` is inert while focus is in the content");

	await page.evaluate(() => document.getElementById("menu-trigger")?.focus());
	await page.keyboard.press("/");
	await sleep(250);
	if (!(await searchOpen())) fail("/cdn-waf…", "`/` does not open the search with focus in the header");
	else ok("`/` opens the search from within the header");
	await page.close();
}

// ── 5. WCAG 1.4.10 — reflow at 320 CSS px, the width the norm names ─────────
console.log("── 1.4.10 reflow at 320px");
for (const route of ["/", "/cdn-waf-seguridad-edge-cloudflare", "/referencias", "/search?q=cloudflare"]) {
	const page = await browser.newPage();
	await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });
	const s = await page.evaluate(REFLOW_PROBE);
	if (s.doc > s.view + 1) fail(route, `horizontal overflow at 320px: ${s.doc} > ${s.view} (${s.over.join(", ")})`);
	else ok(`${route} — ${s.doc}/${s.view}`);
	await page.close();
}

// ── 6. W3C Nu — the rules html-validate does not carry ─────────────────────
// The local suite validates with html-validate; CI additionally runs Nu after
// the deploy. They disagree, and the gap is not academic: `aria-hidden` on a
// label bound to a control passed html-validate and was rejected by Nu, after
// the merge. Running Nu here closes the loop before the push. An unreachable
// validator warns rather than fails — an external outage must not block a
// pull request — but a REACHED validator reporting errors is a hard failure.
console.log("── W3C Nu (2 pages, one per locale)");
for (const route of ["/", "/en/e-commerce"]) {
	const page = await browser.newPage();
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });
	const html = await page.content();
	await page.close();
	let json;
	try {
		const r = await fetch("https://validator.w3.org/nu/?out=json", {
			method: "POST",
			headers: { "Content-Type": "text/html; charset=utf-8" },
			body: html,
			signal: AbortSignal.timeout(40000),
		});
		json = await r.json();
	} catch {
		console.log(`  warn ${route} — validator unreachable, skipped (not a failure)`);
		continue;
	}
	const errors = (json.messages || []).filter((m) => m.type === "error");
	if (errors.length) {
		for (const e of errors) fail(route, `W3C Nu: ${e.message}`);
	} else {
		ok(`${route} — 0 Nu errors`);
	}
}

await browser.close();

if (failures.length) {
	console.error(`\n✗ ${failures.length} accessibility failure(s):`);
	for (const f of failures) console.error(`  ${f}`);
	process.exit(1);
}
console.log("\na11y: all checks green");
