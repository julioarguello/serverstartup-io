/**
 * doc-sections — split a CMS body into intro + one section per heading (#305).
 *
 * Three pages now needed the same loop: `HomepageContent.astro`,
 * `quienes-somos.astro`, and the deconstructing document. The first two keep
 * their inline copies for now — moving them here in a content PR would put
 * four more copy baselines at risk — but new callers use this one.
 *
 * Two things it does that a naive split does not:
 *
 * 1. It runs `mdNormalize` first. The md→PortableText converter still leaves
 *    `*em*` and `` `code` `` as literal text inside spans, and never stamps
 *    `blank` on external links (measured against EmDash 0.34, #361). Without
 *    this, a document page renders asterisks.
 *
 * 2. It reads BY POSITION, never by heading text. Matching on the words of a
 *    heading silently dropped a whole section the day one was renamed (#273):
 *    the page still rendered, just without that part. Position is the only
 *    key the CMS cannot invalidate by an edit that looks harmless.
 */
import { mdNormalize } from "./panels";

export interface DocSection {
	/** Flattened heading text — the block itself is NOT in `blocks`. */
	heading: string;
	/** Everything between this heading and the next one. */
	blocks: any[];
}

export interface DocContent {
	/** Blocks before the first heading. */
	intro: any[];
	sections: DocSection[];
}

const textOf = (block: any): string =>
	(block?.children || [])
		.map((c: any) => c?.text ?? "")
		.join("")
		.trim();

/**
 * @param content PortableText blocks straight from the CMS entry
 * @param style   heading style that opens a section (default `h2`)
 */
export function splitByHeading(content: any[], style = "h2"): DocContent {
	const blocks = mdNormalize(content || []);
	const intro: any[] = [];
	const sections: DocSection[] = [];

	for (const block of blocks) {
		const isHeading = block?._type === "block" && block.style === style;
		if (isHeading) {
			sections.push({ heading: textOf(block), blocks: [] });
		} else if (sections.length === 0) {
			intro.push(block);
		} else {
			sections[sections.length - 1].blocks.push(block);
		}
	}

	return { intro, sections };
}
