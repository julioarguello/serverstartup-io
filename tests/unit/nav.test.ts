/**
 * nav.ts — the canonical order of the six specialties.
 *
 * Its failure mode is the silent kind this suite exists for. The footer used to
 * render whatever the database returned under `created_at`, the seeder inserts
 * two entries inside the same millisecond, and the tie broke differently
 * between two clean reseeds of the SAME seed file (#381). Nothing looked
 * broken: the page rendered, the links worked, and the only symptom was the
 * frozen-copy gate failing on a dozen unrelated pages at once.
 *
 * So these tests pin the property that has to hold — the order comes from the
 * list and from nothing else — rather than the six titles, which are the
 * founder's to change.
 */
import { describe, expect, it } from "vitest";

import { FACE_ORDER, faceRank, sortByFace } from "../../src/utils/nav";

/** The six real ES slugs, in the order the seed happens to declare them. */
const SLUGS = [
	"comercio-electronico",
	"cdn-waf-seguridad-edge-cloudflare",
	"big-data-cloud-analytics",
	"integracion-de-sistemas",
	"desarrollo-greenfield",
	"inteligencia-artificial",
];

const entries = (slugs: string[]) => slugs.map((slug) => ({ id: `svc-${slug}`, slug }));
const slugsOf = (list: { slug?: string; id: string }[]) => list.map((e) => e.slug ?? e.id);

describe("faceRank", () => {
	it("ranks the six specialties by FACE_ORDER", () => {
		const ranks = SLUGS.map(faceRank);
		expect(new Set(ranks).size).toBe(6); // a total order, no ties
		expect(Math.max(...ranks)).toBeLessThan(FACE_ORDER.length);
	});

	it("sends an unmapped slug last, never first", () => {
		expect(faceRank("un-servicio-que-nadie-ha-mapeado")).toBe(FACE_ORDER.length);
		expect(faceRank("un-servicio-que-nadie-ha-mapeado")).toBeGreaterThan(faceRank(SLUGS[0]));
	});
});

describe("sortByFace", () => {
	it("produces the canonical order whatever order it is given", () => {
		const canonical = slugsOf(sortByFace(entries(SLUGS)));
		const reversed = slugsOf(sortByFace(entries([...SLUGS].reverse())));
		const rotated = slugsOf(sortByFace(entries([...SLUGS.slice(3), ...SLUGS.slice(0, 3)])));
		expect(reversed).toEqual(canonical);
		expect(rotated).toEqual(canonical);
	});

	it("agrees with FACE_ORDER — the footer renders the menu's order", () => {
		expect(slugsOf(sortByFace(entries(SLUGS))).map(faceRank)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it("is deterministic for unmapped slugs too", () => {
		// Two unknown slugs tie on rank; without the slug tiebreak the decision
		// would fall back to input order, which is where the clock got in.
		const a = slugsOf(sortByFace(entries(["zeta-desconocida", "alfa-desconocida"])));
		const b = slugsOf(sortByFace(entries(["alfa-desconocida", "zeta-desconocida"])));
		expect(a).toEqual(b);
		expect(a[0]).toBe("alfa-desconocida");
	});

	it("does not mutate its input", () => {
		const given = entries([...SLUGS].reverse());
		const before = slugsOf(given);
		sortByFace(given);
		expect(slugsOf(given)).toEqual(before);
	});

	it("falls back to the id when an entry has no slug", () => {
		const list = [{ id: "inteligencia-artificial" }, { id: "comercio-electronico" }];
		expect(slugsOf(sortByFace(list))).toEqual(["comercio-electronico", "inteligencia-artificial"]);
	});
});
