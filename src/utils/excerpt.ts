/**
 * Excerpt rendering helpers.
 *
 * Service excerpts are markdown-lite strings: the voice guide italicizes
 * anglicisms (*partners*) and links proper nouns (#264: [SAP Commerce
 * Cloud](…)) even in the hero lede. Only the hero may render marks — the
 * homepage face-card is itself one big <a> (nested links are invalid HTML)
 * and meta/JSON-LD descriptions must never ship literal asterisks or
 * bracket syntax, so both consume the stripped plain text.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** Plain-text version for face-cards, <meta> descriptions and JSON-LD. */
export function excerptPlain(s: string): string {
	return s
		.replace(LINK, "$1")
		.replace(/`([^`\n]+)`/g, "$1")
		.replace(/\*([^*\n]+)\*/g, "$1");
}

/**
 * HTML version for the hero: escaped, then [t](url) → <a> (house dashed
 * style via CSS), `t` → <code> (stack terms, §14 convention), *t* → <em>
 * (marked anglicisms). A link may wrap a code term: [`SAP Commerce
 * Cloud`](url) — the backtick pass runs after the link pass on purpose.
 */
export function excerptHtml(s: string): string {
	return s
		.replace(/[&<>]/g, (c) => ESC[c])
		.replace(LINK, (_m, text, href) => {
			const external = /^https?:\/\//.test(href);
			const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
			return `<a href="${href}"${attrs}>${text}</a>`;
		})
		.replace(/`([^`\n]+)`/g, "<code>$1</code>")
		.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}
