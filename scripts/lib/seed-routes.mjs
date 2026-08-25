/**
 * seed-routes.mjs — the one derivation of "what routes exist", for the gates.
 *
 * `seed/seed.json` is the source of truth for content (§9 of the project
 * rules), so the route list is not a thing anyone should be maintaining: it is
 * a projection of the seed, exactly as `src/pages/sitemap.xml.ts` builds it.
 *
 * This module exists because that projection had been written out twice in
 * `scripts/` — once in `copy-baseline.mjs`, once in `ci-check-a11y.mjs` — and
 * a copy of a derivation goes stale as quietly as a copy of a list. Worse
 * here than usual: both files ship a positive control whose whole job is to
 * shout when the seed's shape changes, and with two copies that failure had
 * to be fixed twice, each reporting itself blind on its own.
 *
 * `hreflang-sweep.py` and `sitemap.xml.ts` carry the same expression in Python
 * and TypeScript. Those cannot import this and are left alone; these two are
 * both `.mjs` in the same directory, so there is no reason for them to differ.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const SEED = join(REPO, "seed", "seed.json");

export const readSeed = () => JSON.parse(readFileSync(SEED, "utf8"));

/** `/en` for the English entries, `""` for Spanish — the site's whole prefix rule. */
export const localePrefix = (locale) => (locale === "en" ? "/en" : "");

/** The public path of one CMS entry. `home` is the locale's root, not `/home`. */
export function entryPath(collection, entry) {
	const slug = entry.slug ?? entry.id;
	const prefix = localePrefix(entry.locale);
	return collection === "pages" && slug === "home" ? prefix || "/" : `${prefix}/${slug}`;
}

/**
 * Every public route the seed declares, both locales, sorted and deduped.
 * Does NOT include routes no collection declares (search, tags): a caller that
 * wants those appends them, and says why.
 */
export function seedRoutes() {
	const data = readSeed();
	const out = [];
	for (const collection of ["pages", "services"]) {
		for (const entry of data.content[collection] ?? []) {
			out.push(entryPath(collection, entry));
		}
	}
	return [...new Set(out)].sort();
}
