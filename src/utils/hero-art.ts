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
 * Each plate is TWO files: a transparent SVG drawing and, under it, a real
 * NASA photograph. The founder, 2026-08-29: *"que NO pierda los dibujitos…
 * usemos las fotos como background… pero tendrás que quitarles peso."* So the
 * drawing is still the subject and the photograph is only the room it hangs
 * in — darkened, desaturated and cropped at build time so the photograph's
 * own subject lands under the drawing's. Both halves are generated, never
 * hand-edited:
 * `docs/design/hero-rotativo/generate.py` draws the plates and `grounds.py`
 * treats the photographs (and records what each one is and who to credit).
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

/**
 * Two files per ground, and both are needed: AVIF at 2160x1350 is what every
 * device actually downloads, and the 720x450 JPEG is the `<img>` inside the
 * `<picture>` for the browsers that cannot read AVIF. The format is what makes
 * the resolution affordable — nine times the pixels of the old ground for a
 * quarter more weight — and the resolution is what stopped the photograph
 * looking defocused on a retina screen, since a full-bleed band paints far
 * more device pixels than its viewport is wide.
 */
export type HeroGround = { avif: string; jpg: string };

/**
 * face → the photograph that vertical hangs in. Each was chosen because it
 * SAYS what its drawing says — a crowd of stars under a wall of cubes, a deep
 * field under a point cloud — and each crop is then solved so the thing the
 * photograph shows lands under the thing the drawing means. See
 * `docs/design/hero-rotativo/grounds.py` for the anchor of every one.
 */
export const HERO_GROUND: Record<FaceKey, HeroGround> = {
	ec: { avif: "/assets/hero/ground/ec.avif", jpg: "/assets/hero/ground/ec.jpg" },
	cdn: { avif: "/assets/hero/ground/cdn.avif", jpg: "/assets/hero/ground/cdn.jpg" },
	bd: { avif: "/assets/hero/ground/bd.avif", jpg: "/assets/hero/ground/bd.jpg" },
	int: { avif: "/assets/hero/ground/int.avif", jpg: "/assets/hero/ground/int.jpg" },
	gf: { avif: "/assets/hero/ground/gf.avif", jpg: "/assets/hero/ground/gf.jpg" },
	ia: { avif: "/assets/hero/ground/ia.avif", jpg: "/assets/hero/ground/ia.jpg" },
};

/** The plates in the canonical order the home rotates through. */
export const HERO_ART_ORDER: string[] = FACE_ORDER.map((face) => HERO_ART[face]);

/** The grounds in that same order, so slide `i` and ground `i` cross-fade together. */
export const HERO_GROUND_ORDER: HeroGround[] = FACE_ORDER.map((face) => HERO_GROUND[face]);

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

/** The photograph that goes under `heroArtForSlug`, or `null` on the same terms. */
export function heroGroundForSlug(slug: string | undefined): HeroGround | null {
	const face = slug ? FACE_BY_SLUG[slug] : undefined;
	return face ? HERO_GROUND[face] : null;
}
