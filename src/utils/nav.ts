/**
 * Wayfinding nav geometry (#211/#214) — the STRUCTURAL side of the menu:
 * which face of the unfolded cube each section occupies and which pictogram
 * it carries. Labels and colors are CMS-driven (service entries + site
 * menus); this file only knows shapes, the same way panels.ts knows which
 * instrument a service renders.
 *
 * Both locales' slugs map to the same face key: the cross never reorders.
 */

export type FaceKey = "ec" | "int" | "bd" | "cdn" | "gf" | "ia";
export type SiteKey = "home" | "quienes" | "ref" | "dec" | "contacto" | "legal";

/** service slug (ES or EN) → face of the specialties cross */
export const FACE_BY_SLUG: Record<string, FaceKey> = {
	"comercio-electronico": "ec",
	"e-commerce": "ec",
	"integracion-de-sistemas": "int",
	"systems-integration": "int",
	"big-data-cloud-analytics": "bd",
	"cdn-waf-seguridad-edge-cloudflare": "cdn",
	"cdn-waf-edge-security-cloudflare": "cdn",
	"desarrollo-greenfield": "gf",
	"greenfield-development": "gf",
	"inteligencia-artificial": "ia",
	"artificial-intelligence": "ia",
};

/** site path (either locale) → face of the site cross */
export const SITE_BY_PATH: Record<string, SiteKey> = {
	// the menu filters site items by this map — an unmapped path is dropped
	// silently, which is how the site shipped with no way back home (#273)
	"/": "home",
	"/en": "home",
	"/quienes-somos": "quienes",
	"/en/about-us": "quienes",
	"/referencias": "ref",
	"/en/references": "ref",
	"/deconstruyendo": "dec",
	"/en/deconstructing": "dec",
	"/contacto": "contacto",
	"/en/contact": "contacto",
	// The legal pages are not in the menu — no menu item points at these keys,
	// so they never render as entries. They are here so the pages get their
	// emblem detail like every other page (#350).
	"/aviso-legal": "legal",
	"/en/legal-notice": "legal",
	"/politica-de-privacidad": "legal",
	"/en/privacy-policy": "legal",
};

/**
 * Pictograms, 24×24 line-icon space, drawn with the face color.
 * "ia" is special-cased in the renderer: a lettered `AI` glyph in the house
 * mono (neutral across locales) instead of a path.
 */
export const ICON_BY_KEY: Record<string, string> = {
	ec: "M4 6h2.2l1.8 9h9l1.8-6.6H8.2 M9.5 19a1.3 1.3 0 1 0 0-.01 M15.5 19a1.3 1.3 0 1 0 0-.01",
	int: "M4.5 9h11 M12.5 6l3 3-3 3 M19.5 15h-11 M11.5 12l-3 3 3 3",
	bd: "M5 19v-6 M10 19V5.5 M15 19v-9 M20 19v-3.4 M3.5 19h18.5",
	cdn: "M12 3.5l7 2.8v4.9c0 4.1-2.9 6.9-7 9.3-4.1-2.4-7-5.2-7-9.3V6.3z",
	gf: "M12 20v-6.5 M12 13.5C12 9.5 9.5 8 5.8 8c0 4 2.5 5.5 6.2 5.5 M12 15.5c0-4 2.5-5.5 6.2-5.5 0 4-2.5 5.5-6.2 5.5",
	home: "M4 11.2L12 4.5l8 6.7 M6.6 9.8V19h10.8V9.8 M10.2 19v-5.2h3.6V19",
	quienes: "M12 4.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8 M5 20c1.2-3.8 4-5.6 7-5.6s5.8 1.8 7 5.6",
	ref: "M5 5h6v6H5z M13 5h6v6h-6z M5 13h6v6H5z M13 13h6v6h-6z",
	legal: "M7 3.5h6.5L17 7v13.5H7z M13.5 3.5V7H17 M9.5 12h5 M9.5 15.5h5",
	dec: "M5 5h14v14H5z",
	contacto: "M3.5 6h17v12h-17z M4 7l8 6 8-6",
};

/* ── The living-logo die (#211 v29 / #231) ───────────────────────────────
 * Which 3D face of the die each specialty owns (mirrors the old unfolded
 * cross, folded), and how each site link plays in the grey world: a face
 * to spin to plus its coin — quiénes somos pastes the three initials on
 * the faces visible after its quarter turn; deconstruyendo also opens
 * the plates and lifts the die. */

export type DieSlot = "front" | "right" | "back" | "left" | "top" | "bottom";

/** Menu order of the specialties — the list renders it and the roll walks it. */
export const FACE_ORDER: FaceKey[] = ["ec", "int", "bd", "cdn", "gf", "ia"];

export const DIE_FACE: Record<FaceKey, DieSlot> = {
	int: "front",
	ec: "left",
	cdn: "right",
	gf: "back",
	bd: "top",
	ia: "bottom",
};

export interface SiteDieFx {
	face: FaceKey;
	/** faceKey → initial letter pasted on it (quiénes somos: D·I·J) */
	triple?: Record<string, string>;
	/** ICON_BY_KEY key for the single grey coin */
	icon?: SiteKey;
	/** deconstruyendo: plates open, die lifts */
	dec?: boolean;
}

export const SITE_DIE: Record<SiteKey, SiteDieFx> = {
	// home is where the die rests: the e-commerce face, its own house coin
	home: { face: "ec", icon: "home" },
	quienes: { face: "int", triple: { int: "D", bd: "I", cdn: "J" } },
	ref: { face: "gf", icon: "ref" },
	contacto: { face: "cdn", icon: "contacto" },
	dec: { face: "bd", icon: "dec", dec: true },
	legal: { face: "gf", icon: "legal" },
};
