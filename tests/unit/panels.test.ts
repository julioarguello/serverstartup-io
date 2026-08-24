/**
 * panels.ts — the instrument parser, whose failures read perfectly (#353).
 *
 * The javadoc instrument pairs bullets with `jd_tags` BY POSITION: §14 warns
 * that if the order slips, every @param describes the wrong rule. That is
 * mislabelled content a visual review cannot catch and a table test can.
 *
 * The mdNormalize block below doubles as the removal test #361 asked for. Its
 * verdict, measured against the live 0.34 converter on 2026-08-23: still
 * load-bearing. See the comment there.
 */
import { describe, expect, it } from "vitest";

import { INSTRUMENT_BY_SLUG, mdNormalize, parsePanelSections } from "../../src/utils/panels";

const span = (text: string, marks: string[] = []) => ({ _type: "span", text, marks });
const block = (children: any[], extra: Record<string, unknown> = {}) =>
	({ _type: "block", style: "normal", children, ...extra });

describe("mdNormalize — the #361 removal test, kept as a test", () => {
	/*
	 * Measured against EmDash 0.34's own converter (a real service body pushed
	 * through `emdash content update`, PT read back, 2026-08-23):
	 *
	 *   **bold**  → converted natively        (0 literals left)
	 *   *em*      → 3 literals left in spans
	 *   `code`    → 1 literal left in a span
	 *   link markDefs with blank:true → 0 of 1
	 *
	 * So 0.34 fixed bold upstream and nothing else. Removing mdNormalize would
	 * put literal asterisks around "*middleware*" on a live page and drop
	 * target="_blank" from every external link. Verdict: KEEP.
	 */
	it("converts the em the 0.34 converter still leaves literal", () => {
		const [out] = mdNormalize([block([span("todo a medida vive en un *middleware* propio")])]);
		expect(out.children.map((c: any) => c.text)).toEqual([
			"todo a medida vive en un ", "middleware", " propio",
		]);
		expect(out.children[1].marks).toContain("em");
	});

	it("converts a literal code span, and inside a strong run too", () => {
		// The strong case is the one 0.34 leaves behind: it marks the whole
		// line strong and does not descend into the nested marks.
		const [out] = mdNormalize([block([span("Interfaces con `S/4HANA` y TPV.", ["strong"])])]);
		const code = out.children.find((c: any) => c.marks.includes("code"));
		expect(code.text).toBe("S/4HANA");
		expect(code.marks).toContain("strong"); // the outer mark survives
	});

	it("stamps blank on external links only — the converter never does", () => {
		const [out] = mdNormalize([
			{
				...block([span("ver")]),
				markDefs: [
					{ _type: "link", _key: "a", href: "https://www.cloudflare.com/" },
					{ _type: "link", _key: "b", href: "/contacto" },
				],
			},
		]);
		expect(out.markDefs[0].blank).toBe(true);
		expect(out.markDefs[1].blank).toBeUndefined();
	});

	it("never re-parses inside an existing code span", () => {
		// A code term containing an asterisk must survive verbatim, or a shell
		// snippet like `rm *` silently becomes italics.
		const [out] = mdNormalize([block([span("rm -rf *", ["code"])])]);
		expect(out.children).toHaveLength(1);
		expect(out.children[0].text).toBe("rm -rf *");
	});

	it("leaves plain text and non-blocks untouched", () => {
		const plain = block([span("Tres ingenieros. Los mismos tres.")]);
		expect(mdNormalize([plain])[0].children[0].text).toBe("Tres ingenieros. Los mismos tres.");
		expect(mdNormalize([{ _type: "image", src: "/x.png" } as any])[0]).toMatchObject({ _type: "image" });
		expect(mdNormalize([])).toEqual([]);
	});
});

describe("parsePanelSections", () => {
	const doc = [
		block([span("Lede de entrada.")]),
		block([span("Instrumento")], { style: "h2" }),
		block([span("Prosa antes del panel.")]),
		block([span("pila", ["strong"]), span(": Java y Camel.")], { listItem: "bullet" }),
		block([span("contrato", ["strong"]), span(": OpenAPI primero.")], { listItem: "bullet" }),
		block([span("Cierre")], { style: "h2" }),
		block([span("Un equipo.")]),
	];

	it("splits intro, lead, items and closer around the two h2s", () => {
		const s = parsePanelSections(doc);
		expect(s.intro).toHaveLength(1);
		expect(s.heading).toBe("Instrumento");
		expect(s.lead).toBe("Prosa antes del panel.");
		expect(s.items).toHaveLength(2);
		expect(s.closerHeading).toBe("Cierre");
		expect(s.closer).toHaveLength(1);
	});

	it("keeps bullet ORDER — this is what jd_tags pair against (§14)", () => {
		// The javadoc instrument zips these with jd_tags by index. If the order
		// ever stopped being document order, every @param would label the wrong
		// rule and the page would still look right.
		expect(parsePanelSections(doc).items.map((i) => i.label)).toEqual(["pila", "contrato"]);
		expect(parsePanelSections(doc).items.map((i) => i.desc))
			.toEqual(["Java y Camel.", "OpenAPI primero."]);
	});

	it("survives a body with no h2 instead of mislabelling one", () => {
		const s = parsePanelSections([block([span("Sólo prosa.")])]);
		expect(s.heading).toBe("");
		expect(s.items).toEqual([]);
		expect(s.intro).toHaveLength(1);
	});

	it("treats a single h2 as heading + body, with no closer", () => {
		const s = parsePanelSections(doc.slice(0, 5));
		expect(s.heading).toBe("Instrumento");
		expect(s.closerHeading).toBe("");
		expect(s.closer).toEqual([]);
	});

	it("tolerates empty and undefined content", () => {
		expect(parsePanelSections([]).items).toEqual([]);
		expect(parsePanelSections(undefined as unknown as any[]).items).toEqual([]);
	});
});

describe("INSTRUMENT_BY_SLUG", () => {
	it("maps both locales of every service to the same instrument", () => {
		const pairs: [string, string][] = [
			["comercio-electronico", "e-commerce"],
			["integracion-de-sistemas", "systems-integration"],
			["cdn-waf-seguridad-edge-cloudflare", "cdn-waf-edge-security-cloudflare"],
			["desarrollo-greenfield", "greenfield-development"],
			["inteligencia-artificial", "artificial-intelligence"],
		];
		for (const [es, en] of pairs) {
			expect(INSTRUMENT_BY_SLUG[es], es).toBeDefined();
			expect(INSTRUMENT_BY_SLUG[es]).toBe(INSTRUMENT_BY_SLUG[en]);
		}
		// big-data has one slug shared by both locales.
		expect(INSTRUMENT_BY_SLUG["big-data-cloud-analytics"]).toBe("bigquery");
	});
});
