/**
 * Portable Text → instrument-panel mapping for service pages.
 *
 * Content stays CMS-pure; this module only RESHAPES the blocks each service
 * already has (intro ¶s → first h2 → lead ¶ → list items → closing h2 + ¶s)
 * into the structure the per-discipline renderers consume. No copy lives here.
 */

export interface PanelItem {
	/** Short label: the strong-marked lead of the bullet, or its first sentence. */
	label: string;
	/** The rest of the bullet, plain text. */
	desc: string;
}

export interface PanelSections {
	intro: any[]; // PT blocks before the first h2 (rendered as-is)
	heading: string; // first h2 text (the equation-headline)
	lead: string; // first paragraph after the h2, flattened to plain text
	leadBlocks: any[]; // same paragraphs as PT blocks (marks preserved)
	items: PanelItem[];
	itemBlocks: any[]; // the raw list blocks (marks preserved)
	closerHeading: string; // second h2 text ("" if absent)
	closer: any[]; // PT blocks after the second h2 (rendered as-is)
}

const blockText = (block: any): string =>
	(block?.children || []).map((c: any) => c.text ?? "").join("");

/** Strip markdown residue for plain-text slots (panel labels/descriptions). */
const plain = (s: string): string =>
	s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1");

/**
 * EmDash's markdown→PT conversion leaves single-asterisk emphasis (and, inside
 * list items, backticks) as literal characters. Normalize spans at render time:
 * split each unmarked-run into strong/em/code spans so PortableText renders
 * real marks instead of Markdown residue. Idempotent on clean content.
 */
export function mdNormalize(blocks: any[]): any[] {
	return (blocks || []).map((raw) => {
		// The md→PT converter emits link markDefs without `blank`; the site
		// convention is that absolute (external) links open in a new tab, so
		// stamp it at render time — the Link mark component honors it.
		const b =
			Array.isArray(raw?.markDefs) && raw.markDefs.some((d: any) => d._type === "link")
				? {
						...raw,
						markDefs: raw.markDefs.map((d: any) =>
							d._type === "link" && /^https?:\/\//.test(d.href ?? "") ? { ...d, blank: true } : d,
						),
					}
				: raw;
		if (b?._type !== "block" || !Array.isArray(b.children)) return b;
		const children = b.children.flatMap((span: any) => {
			if (span._type !== "span" || typeof span.text !== "string") return [span];
			if (span.marks?.includes("code")) return [span];
			const parts = span.text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g).filter(Boolean);
			if (parts.length === 1 && !/^(\*|`)/.test(parts[0])) return [span];
			return parts.map((p: string) => {
				const base = { _type: "span", marks: [...(span.marks || [])] };
				if (/^\*\*[^*]+\*\*$/.test(p)) return { ...base, text: p.slice(2, -2), marks: [...base.marks, "strong"] };
				if (/^\*[^*\n]+\*$/.test(p)) return { ...base, text: p.slice(1, -1), marks: [...base.marks, "em"] };
				if (/^`[^`]+`$/.test(p)) return { ...base, text: p.slice(1, -1), marks: [...base.marks, "code"] };
				return { ...base, text: p };
			});
		});
		return { ...b, children };
	});
}

/** Split "Strong lead: rest" or fall back to first-sentence / rest. */
function splitItem(block: any): PanelItem {
	const children: any[] = block?.children || [];
	const full = blockText(block).trim();
	// Leading strong run = the label. The run may span several children when
	// inline code splits it (mdNormalize), so join every leading strong span.
	let lead = "";
	for (const c of children) {
		if (c._type === "span" && c.marks?.includes("strong")) lead += c.text ?? "";
		else break;
	}
	if (lead.trim()) {
		const label = plain(lead.trim()).replace(/[:.]\s*$/, "");
		const desc = plain(full.slice(lead.length)).replace(/^[:.]?\s*/, "");
		return { label, desc };
	}
	const clean = plain(full);
	const m = clean.match(/^(.+?[.!?])\s+(.*)$/s);
	return m
		? { label: m[1].replace(/[.]$/, ""), desc: m[2] }
		: { label: clean.replace(/[.]$/, ""), desc: "" };
}

export function parsePanelSections(content: any[]): PanelSections {
	const blocks = mdNormalize(content || []);
	const h2Idx = blocks
		.map((b, i) => (b._type === "block" && b.style === "h2" ? i : -1))
		.filter((i) => i >= 0);

	if (h2Idx.length === 0) {
		return { intro: blocks, heading: "", lead: "", leadBlocks: [], items: [], itemBlocks: [], closerHeading: "", closer: [] };
	}

	const [first, second] = [h2Idx[0], h2Idx[1] ?? blocks.length];
	const intro = blocks.slice(0, first);
	const body = blocks.slice(first + 1, second);
	const closerHeading = h2Idx[1] != null ? blockText(blocks[h2Idx[1]]) : "";
	const closer = h2Idx[1] != null ? blocks.slice(h2Idx[1] + 1) : [];

	const itemBlocks = body.filter((b) => b.listItem);
	const items = itemBlocks.map(splitItem);
	const leadBlocks = body.filter((b) => !b.listItem && b._type === "block");
	const lead = leadBlocks.map(blockText).join(" ").trim();

	return { intro, heading: blockText(blocks[first]), lead, leadBlocks, items, itemBlocks, closerHeading, closer };
}

/** Which instrument renders each service, by slug (both locales). */
export const INSTRUMENT_BY_SLUG: Record<string, "cart" | "terminal" | "bigquery" | "dashboard" | "javadoc" | "review"> = {
	"comercio-electronico": "cart",
	"e-commerce": "cart",
	"integracion-de-sistemas": "terminal",
	"systems-integration": "terminal",
	"big-data-cloud-analytics": "bigquery",
	"cdn-waf-seguridad-edge-cloudflare": "dashboard",
	"cdn-waf-edge-security-cloudflare": "dashboard",
	"ingenieria-greenfield-y-sistemas-criticos": "javadoc",
	"greenfield-engineering-critical-systems": "javadoc",
	"inteligencia-artificial": "review",
	"artificial-intelligence": "review",
};
