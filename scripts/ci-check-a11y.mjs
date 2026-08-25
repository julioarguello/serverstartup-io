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
import { createRequire } from "node:module";

const BASE = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");
const require = createRequire(import.meta.url);
const axeSource = require("fs").readFileSync(
	require.resolve("axe-core/axe.min.js"),
	"utf8",
);

/** Routes worth auditing: both locales, a vertical, a site page, a utility. */
const ROUTES = [
	"/",
	"/cdn-waf-seguridad-edge-cloudflare",
	"/quienes-somos",
	"/contacto",
	"/referencias",
	// #305: the layered document carries more bespoke markup than any other
	// page — a custom diagram plus four instrument panels — and it was not
	// audited until it did.
	"/deconstruyendo",
	// The terminal instrument's own page: adding /deconstruyendo surfaced a
	// contrast failure in a component this page has rendered all along, and
	// no route using it was ever audited (#305).
	"/integracion-de-sistemas",
	"/search?q=cloudflare",
	"/en",
	"/en/about-us",
];

/** Reveal animations must finish before geometry is read — measuring during a
 *  transition reports the start frame and makes working code look broken. */
const SETTLE_MS = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const fail = (route, msg) => failures.push(`${route}: ${msg}`);
const ok = (msg) => console.log(`  ok   ${msg}`);

const browser = await puppeteer.launch({
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ── 1. axe-core: the rules a machine can decide, on every audited route ─────
console.log("── axe-core (WCAG 2.0/2.1/2.2 A+AA, plus best practices)");
for (const route of ROUTES) {
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
console.log("── keyboard traversal");
for (const route of ["/", "/cdn-waf-seguridad-edge-cloudflare", "/en"]) {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });

	// The first stop must be the skip link, and it must actually appear.
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
	for (let i = 0; i < 40; i++) {
		await page.keyboard.press("Tab");
		const s = await page.evaluate(() => {
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
		});
		if (!s) break;
		stops++;
		if (s.obscured) { obscured++; fail(route, `focused element hidden behind the fixed header: ${s.name}`); }
		if (!s.ring && !s.offscreen) { ringless++; fail(route, `focused element has no visible focus indicator: ${s.name}`); }
	}
	if (!obscured && !ringless) ok(`${route} — ${stops} stops, none obscured, all with a focus ring`);
	await page.close();
}

// ── 3. WCAG 2.1.4 — a single-character shortcut must be scoped ──────────────
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

// ── 4. WCAG 1.4.10 — reflow at 320 CSS px, the width the norm names ─────────
console.log("── 1.4.10 reflow at 320px");
for (const route of ["/", "/cdn-waf-seguridad-edge-cloudflare", "/referencias", "/search?q=cloudflare"]) {
	const page = await browser.newPage();
	await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });
	const s = await page.evaluate(() => {
		const de = document.documentElement;
		const over = [...document.querySelectorAll("*")]
			.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "auto")
			.map((e) => e.tagName.toLowerCase() + "." + (e.className.toString().split(" ")[0] || ""))
			.slice(0, 3);
		return { doc: de.scrollWidth, view: de.clientWidth, over };
	});
	if (s.doc > s.view + 1) fail(route, `horizontal overflow at 320px: ${s.doc} > ${s.view} (${s.over.join(", ")})`);
	else ok(`${route} — ${s.doc}/${s.view}`);
	await page.close();
}

// ── 5. W3C Nu — the rules html-validate does not carry ─────────────────────
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
