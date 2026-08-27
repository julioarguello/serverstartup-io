import type { ImageMetadata } from "astro";

/**
 * The team photographs, imported so the BUILD can see them (#407).
 *
 * They are read out of `public/` rather than moved into `src/assets/`, which
 * needs saying because it looks like a mistake: Vite resolves the glob by path,
 * so the files stay exactly where the CMS points at them — `featured_image.src`
 * keeps resolving over HTTP, the admin thumbnail keeps working, and the seed
 * does not change. The import is what matters, not the directory: an imported
 * image is emitted into `_astro/` and referenced by PATH, and a path is the one
 * thing the image endpoint can read without a subrequest (#407).
 *
 * Temporary by construction. #410 moves these into the EmDash media library,
 * where the bytes are read from the storage binding and none of this applies.
 */
const photos = import.meta.glob<{ default: ImageMetadata }>(
	"../../public/assets/team/*.jpg",
	{ eager: true },
);

/** The imported asset for a CMS media path, or undefined if the repo has no such file. */
export function teamPhoto(src?: string): ImageMetadata | undefined {
	if (!src) return undefined;
	const file = src.split("/").pop();
	return photos[`../../public/assets/team/${file}`]?.default;
}
