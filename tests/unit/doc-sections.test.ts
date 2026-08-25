/**
 * doc-sections.ts — the splitter the deconstructing document renders from.
 *
 * Its failure mode is the silent kind this suite exists for: a wrong split
 * pairs a diagram with the wrong section, and the page still renders
 * perfectly. That is why the contract is positional and why these tests pin
 * the position, not the words.
 */
import { describe, expect, it } from "vitest";

import { splitByHeading } from "../../src/utils/doc-sections";

const span = (text: string, marks: string[] = []) => ({ _type: "span", text, marks });
const p = (text: string) => ({ _type: "block", style: "normal", children: [span(text)] });
const h2 = (text: string) => ({ _type: "block", style: "h2", children: [span(text)] });

describe("splitByHeading", () => {
	it("puts everything before the first heading in intro", () => {
		const { intro, sections } = splitByHeading([p("uno"), p("dos")]);
		expect(intro).toHaveLength(2);
		expect(sections).toEqual([]);
	});

	it("returns one section per heading, in document order", () => {
		const { intro, sections } = splitByHeading([
			p("apertura"),
			h2("La arquitectura"), p("a1"), p("a2"),
			h2("Contenido como código"), p("b1"),
			h2("Los agentes"), p("c1"),
			h2("Los números"), p("d1"),
			h2("El taller"), p("e1"),
		]);
		expect(intro).toHaveLength(1);
		expect(sections.map((s) => s.heading)).toEqual([
			"La arquitectura", "Contenido como código", "Los agentes", "Los números", "El taller",
		]);
		expect(sections[0].blocks).toHaveLength(2);
		expect(sections[1].blocks).toHaveLength(1);
	});

	it("does not put the heading block back into its own blocks", () => {
		// The template renders the heading itself from `heading`; leaving the
		// block in `blocks` too would print it twice.
		const { sections } = splitByHeading([h2("Título"), p("cuerpo")]);
		expect(sections[0].blocks).toHaveLength(1);
		expect(sections[0].blocks[0].style).toBe("normal");
	});

	it("keeps a section that has a heading and no body", () => {
		// An empty section must still occupy its INDEX, or every instrument
		// after it pairs with the wrong section.
		const { sections } = splitByHeading([h2("vacía"), h2("con cuerpo"), p("x")]);
		expect(sections).toHaveLength(2);
		expect(sections[0].blocks).toEqual([]);
		expect(sections[1].blocks).toHaveLength(1);
	});

	it("converts the marks the 0.34 converter leaves literal (#361)", () => {
		// mdNormalize runs first, or the page renders asterisks. This is the
		// only reason the splitter touches the blocks at all.
		const { sections } = splitByHeading([
			h2("t"),
			{ _type: "block", style: "normal", children: [span("vive en un *middleware* propio")] },
		]);
		const kids = sections[0].blocks[0].children;
		expect(kids.map((c: any) => c.text)).toEqual(["vive en un ", "middleware", " propio"]);
		expect(kids[1].marks).toContain("em");
	});

	it("stamps blank on external links, so the document opens them in a new tab", () => {
		const { sections } = splitByHeading([
			h2("t"),
			{
				_type: "block", style: "normal", children: [span("ver")],
				markDefs: [
					{ _type: "link", _key: "a", href: "https://developers.cloudflare.com/" },
					{ _type: "link", _key: "b", href: "/contacto" },
				],
			},
		]);
		expect(sections[0].blocks[0].markDefs[0].blank).toBe(true);
		expect(sections[0].blocks[0].markDefs[1].blank).toBeUndefined();
	});

	it("tolerates empty and undefined content", () => {
		expect(splitByHeading([])).toEqual({ intro: [], sections: [] });
		expect(splitByHeading(undefined as unknown as any[])).toEqual({ intro: [], sections: [] });
	});

	it("can split on a different heading style when asked", () => {
		const { sections } = splitByHeading(
			[{ _type: "block", style: "h3", children: [span("sub")] }, p("x")], "h3",
		);
		expect(sections.map((s) => s.heading)).toEqual(["sub"]);
	});
});
