/**
 * Hero art (#413) — one drawn plate per vertical, keyed by the face it owns.
 *
 * The six images are the SAME object: the brand cube, with each trade doing
 * something different to it (repeats it, wraps it round the world, draws it
 * out of data, pierces it, builds it, lights it from inside). That is why the
 * key is the FACE, not the slug: slugs are translated and there are two per
 * vertical, while the cross never reorders — the same map the menu, the
 * emblem and the die already share (`FACE_BY_SLUG` in nav.ts).
 *
 * The files are SVG on purpose. The repository has no photography beyond
 * three team snapshots, and buying stock would trade a distinctive identity
 * for a generic one; drawn plates cost 46 KB for all six over the wire
 * (gzipped), which is less than one stock photograph, and they are
 * resolution-free. They are generated, not hand-drawn: the deterministic
 * Python that emits them is in `docs/design/hero-rotativo/generate.py` —
 * change the composition there and re-run it, never by editing the SVG.
 *
 * They live in `public/assets/` rather than the CMS for the reason §7 of the
 * project rules gives for team photos and logos: R2 media is not seedable, so
 * a clean rebuild would lose them and every environment would need a manual
 * upload.
 */
import { FACE_BY_SLUG, FACE_ORDER, type FaceKey } from "./nav";

/** face → the plate that vertical wears. */
export const HERO_ART: Record<FaceKey, string> = {
	ec: "/assets/hero/ec.svg",
	cdn: "/assets/hero/cdn.svg",
	bd: "/assets/hero/bd.svg",
	int: "/assets/hero/int.svg",
	gf: "/assets/hero/gf.svg",
	ia: "/assets/hero/ia.svg",
};

/** The plates in the canonical order the home rotates through. */
export const HERO_ART_ORDER: string[] = FACE_ORDER.map((face) => HERO_ART[face]);

/**
 * The plate a service slug wears, in either locale — `null` for anything that
 * is not one of the six verticals, which is how a plain CMS page (contacto,
 * quiénes somos) keeps the ordinary light hero instead of silently borrowing
 * a vertical's image.
 */
export function heroArtForSlug(slug: string | undefined): string | null {
	const face = slug ? FACE_BY_SLUG[slug] : undefined;
	return face ? HERO_ART[face] : null;
}
