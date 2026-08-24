/**
 * accent.ts — the highest-value unit test in the repo (#353).
 *
 * The pairing is verified today only because the six CMS colours were
 * measured by hand, once. A NEW colour added in the CMS tomorrow goes through
 * this function with nobody checking, and getting it wrong ships an
 * accessibility failure that looks perfectly fine on screen.
 */
import { describe, expect, it } from "vitest";

import { accentFill, contrast } from "../../src/utils/accent";

const AA = 4.5;
const INK = "#1E1E1E";
const PAPER = "#FFFFFF";

// The palette as the CMS actually holds it (seed.json services.color).
const PALETTE = {
	"e-commerce blue": "#008FD3",
	"integration navy": "#1D4E89",
	"greenfield green": "#3E7D50",
	"ai purple": "#6B4FBB",
	"big data red": "#EA4335",
	"cdn/waf orange": "#F38020",
};

describe("contrast", () => {
	it("is the WCAG ratio, symmetric, bounded by 21:1", () => {
		expect(contrast(INK, PAPER)).toBeCloseTo(contrast(PAPER, INK), 10);
		expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
		expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 6);
	});

	it("reproduces the two ratios that motivated the helper (#304)", () => {
		// Both measured by hand in #304; if these drift the maths changed.
		expect(contrast(PALETTE["cdn/waf orange"], PAPER)).toBeCloseTo(2.65, 1);
		expect(contrast(PALETTE["e-commerce blue"], INK)).toBeCloseTo(4.66, 1);
	});
});

describe("accentFill", () => {
	it.each(Object.entries(PALETTE))("%s clears AA", (_name, hex) => {
		const { label, ratio } = accentFill(hex);
		expect([INK, PAPER]).toContain(label);
		expect(ratio).toBeGreaterThanOrEqual(AA);
	});

	it("keeps the section colour untouched when it can carry a label", () => {
		// Five of six need no shift — the fill must stay exactly the CMS value,
		// or the page stops looking like its own section.
		for (const hex of [PALETTE["e-commerce blue"], PALETTE["integration navy"],
			PALETTE["greenfield green"], PALETTE["ai purple"], PALETTE["cdn/waf orange"]]) {
			expect(accentFill(hex).fill).toBe(hex);
		}
	});

	it("shifts only Big Data's red, and by the smallest step that clears AA", () => {
		const red = PALETTE["big data red"];
		// Raw: ink 4.25, paper 3.92 — neither clears 4.5, hence the shift.
		expect(Math.max(contrast(red, INK), contrast(red, PAPER))).toBeLessThan(AA);
		const { fill, ratio } = accentFill(red);
		expect(fill).not.toBe(red);
		expect(ratio).toBeGreaterThanOrEqual(AA);
		// "Smallest step": the shifted colour must still read as that red, not
		// as some neighbouring hue washed to grey.
		expect(contrast(fill, red)).toBeLessThan(1.3);
	});

	it("handles the extremes without inventing a colour", () => {
		expect(accentFill("#FFFFFF")).toMatchObject({ fill: "#FFFFFF", label: INK });
		expect(accentFill("#000000")).toMatchObject({ fill: "#000000", label: PAPER });
	});

	it("falls back to ink for a missing or malformed colour", () => {
		// A service with no colour must not produce an unreadable button, and
		// must not throw either — the template renders it either way.
		for (const bad of [undefined, null, "", "not-a-colour", "#12345"]) {
			const { label, ratio } = accentFill(bad as string | undefined);
			expect([INK, PAPER]).toContain(label);
			expect(ratio).toBeGreaterThanOrEqual(AA);
		}
	});

	it("clears AA for an arbitrary colour the CMS might gain tomorrow", () => {
		// The whole point of the helper. Sweep the hue circle at the mid
		// lightness where AA is hardest, and demand a readable pair every time.
		for (let h = 0; h < 360; h += 15) {
			const hex = hslToHex(h, 0.6, 0.5);
			const { ratio, label } = accentFill(hex);
			expect([INK, PAPER]).toContain(label);
			expect(ratio, `hue ${h} (${hex})`).toBeGreaterThanOrEqual(AA);
		}
	});
});

function hslToHex(h: number, s: number, l: number): string {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
		: h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
	return "#" + [r, g, b]
		.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
		.join("");
}
