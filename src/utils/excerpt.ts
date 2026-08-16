/**
 * Excerpt rendering helpers.
 *
 * Service excerpts are plain strings, but the voice guide italicizes
 * anglicisms (*cloud*, *on-premise*) even in the hero lede (#265). The hero
 * renders `*…*` as <em>; meta tags and JSON-LD get the stripped plain text —
 * a description must never ship literal asterisks.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/** Plain-text version for <meta> descriptions and JSON-LD. */
export function excerptPlain(s: string): string {
	return s.replace(/\*([^*\n]+)\*/g, "$1");
}

/** HTML version for the hero: escaped, then *…* becomes <em>. */
export function excerptHtml(s: string): string {
	return s.replace(/[&<>]/g, (c) => ESC[c]).replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}
