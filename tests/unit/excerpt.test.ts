/**
 * excerpt.ts — markdown-lite, and its edge cases were a note in a rule (#353).
 *
 * The hero renders marks; face-cards, meta descriptions and JSON-LD must get
 * the stripped text (a face-card is one big <a>, and a meta description with
 * literal asterisks is what a reader sees in Google).
 */
import { describe, expect, it } from "vitest";

import { excerptHtml, excerptPlain } from "../../src/utils/excerpt";

describe("excerptPlain", () => {
	it("strips every mark, keeping the words", () => {
		expect(excerptPlain("Más de veinte años dentro de `SAP Commerce Cloud`."))
			.toBe("Más de veinte años dentro de SAP Commerce Cloud.");
		expect(excerptPlain("el *middleware* que conecta")).toBe("el middleware que conecta");
		expect(excerptPlain("[Cloudflare](https://cloudflare.com) en el edge"))
			.toBe("Cloudflare en el edge");
	});

	it("leaves nothing that could ship into a <meta> description", () => {
		const out = excerptPlain("[`SAP Commerce Cloud`](https://sap.com) y *feeds* con `S/4HANA`");
		expect(out).toBe("SAP Commerce Cloud y feeds con S/4HANA");
		expect(out).not.toMatch(/[*`\[\]()]/);
	});

	it("passes plain text through untouched", () => {
		expect(excerptPlain("Tres ingenieros. Los mismos tres.")).toBe("Tres ingenieros. Los mismos tres.");
	});
});

describe("excerptHtml", () => {
	it("renders the three marks the voice guide uses", () => {
		expect(excerptHtml("el *middleware*")).toBe("el <em>middleware</em>");
		expect(excerptHtml("con `WAF`")).toBe("con <code>WAF</code>");
		expect(excerptHtml("[Contacto](/contacto)")).toBe('<a href="/contacto">Contacto</a>');
	});

	it("opens external links in a new tab, internal ones in place (§14)", () => {
		expect(excerptHtml("[Cloudflare](https://www.cloudflare.com/es-es/)"))
			.toBe('<a href="https://www.cloudflare.com/es-es/" target="_blank" rel="noopener noreferrer">Cloudflare</a>');
		expect(excerptHtml("[Servicios](/comercio-electronico)")).not.toContain("target=");
	});

	it("lets a link wrap a code term — the #264 case the pass order exists for", () => {
		expect(excerptHtml("[`SAP Commerce Cloud`](https://www.sap.com/)"))
			.toBe('<a href="https://www.sap.com/" target="_blank" rel="noopener noreferrer"><code>SAP Commerce Cloud</code></a>');
	});

	it("escapes HTML before doing anything else", () => {
		// Copy arrives from the CMS; an editor writing < or & must not be able
		// to inject markup into the hero.
		expect(excerptHtml("stock < 0 & alertas")).toBe("stock &lt; 0 &amp; alertas");
		expect(excerptHtml("<script>alert(1)</script>")).not.toContain("<script>");
	});

	it("mangles a link inside bold — the §14 limit, pinned as it really behaves", () => {
		// §14 says "a link inside **bold** renders literally", which undersells
		// it: there is no bold pass here, so the *em* regex eats the INNER pair
		// of asterisks and leaves a stray one on each side plus a spurious <em>.
		// Measured, not assumed — the first version of this test asserted the
		// rule's wording and failed.
		//
		// Not fixed here on purpose: excerpts are markdown-LITE by design (no
		// bold), the copy convention already says keep links outside bold, and
		// widening the grammar is a content decision, not a test's to take.
		// Pinned so the day someone adds a bold pass, this fails and they
		// decide deliberately.
		expect(excerptHtml("**[Un equipo](/quienes-somos)**"))
			.toBe('*<em><a href="/quienes-somos">Un equipo</a></em>*');
	});

	it("leaves a lone asterisk alone", () => {
		// The em regex needs a closing mark; an unpaired one is literal text,
		// which is what a price like "3 * 4" or a footnote marker relies on.
		expect(excerptHtml("3 * 4 unidades")).toBe("3 * 4 unidades");
	});
});
