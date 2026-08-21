/**
 * Alternate-locale URL resolution (#291).
 *
 * ES and EN slugs are translated (/inteligencia-artificial ↔
 * /en/artificial-intelligence), so the alternate URL can never be derived
 * by adding/stripping the /en prefix — that guess produced hreflang pairs
 * and switcher links pointing at 404s. The CMS is the single source of
 * truth: `translationOf` groups the locale variants of an entry, and
 * getTranslations() returns each variant with its own slug.
 *
 * Two layers, one consumer chain (Base.astro → SiteHeader → LanguageSwitcher):
 *  - entryAlternatePath(): async, CMS-backed — for any page that renders a
 *    CMS entry. Pages pass the result to <Base altPath={...}>.
 *  - routeAlternatePath(): sync prefix swap — only correct for routes whose
 *    path is locale-invariant (home, /posts, /tag, /category, /search;
 *    posts share slugs across locales by design). Base's default when a
 *    page passes nothing.
 */
import { getTranslations } from "emdash";

/** Prefix swap for locale-invariant routes. */
export function routeAlternatePath(pathname: string, locale: string): string {
	return locale === "es"
		? `/en${pathname === "/" ? "/" : pathname}`
		: pathname.replace(/^\/en/, "") || "/";
}

/**
 * Resolve the alternate-locale URL of a CMS entry, or null when no
 * published counterpart exists (Base then emits no hreflang set and the
 * switcher falls back to the alternate homepage).
 *
 * `idOrSlug` should be the entry's id (`entry.data.id`) — unambiguous even
 * where both locales share a slug (e.g. `big-data-cloud-analytics`).
 */
export async function entryAlternatePath(
	collection: "services" | "pages",
	idOrSlug: string,
	currentLocale: string,
): Promise<string | null> {
	const target = currentLocale === "es" ? "en" : "es";
	const { translations, error } = await getTranslations(collection, idOrSlug);
	if (error || !translations.length) return null;
	const alt = translations.find(
		(tr) => tr.locale === target && tr.status === "published",
	);
	if (!alt) return null;
	// The pages entry `home` is served by /, not /home
	if (collection === "pages" && alt.slug === "home") {
		return target === "en" ? "/en" : "/";
	}
	return target === "en" ? `/en/${alt.slug}` : `/${alt.slug}`;
}
