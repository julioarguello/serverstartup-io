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
 * in — defocused, darkened and tinted at build time, which is also why the
 * six grounds together weigh 53 KB: an out-of-focus sky has nothing left to
 * encode. Both halves are generated, never hand-edited:
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
 * face → the photograph that vertical hangs in. Each was chosen because it
 * already IS roughly that vertical's colour in the archive — measured hue,
 * not a tint applied afterwards — and because its own subject can be cropped
 * into the left of the frame, where the scrim eats it, leaving the
 * right-centre quiet for the drawing to stand on.
 */
export const HERO_GROUND: Record<FaceKey, string> = {
	ec: "/assets/hero/ground/ec.jpg",
	cdn: "/assets/hero/ground/cdn.jpg",
	bd: "/assets/hero/ground/bd.jpg",
	int: "/assets/hero/ground/int.jpg",
	gf: "/assets/hero/ground/gf.jpg",
	ia: "/assets/hero/ground/ia.jpg",
};

/** The plates in the canonical order the home rotates through. */
export const HERO_ART_ORDER: string[] = FACE_ORDER.map((face) => HERO_ART[face]);

/** The grounds in that same order, so slide `i` and ground `i` cross-fade together. */
export const HERO_GROUND_ORDER: string[] = FACE_ORDER.map((face) => HERO_GROUND[face]);

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
export function heroGroundForSlug(slug: string | undefined): string | null {
	const face = slug ? FACE_BY_SLUG[slug] : undefined;
	return face ? HERO_GROUND[face] : null;
}
