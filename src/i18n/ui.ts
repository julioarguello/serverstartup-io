/**
 * i18n helper for UI accessibility strings (aria-labels, alt text, etc.)
 *
 * Uses static JSON dictionaries (es.json, en.json) — not CMS widgets.
 * These are technical UI strings that rarely change and benefit from
 * type-safe keys and zero-latency lookups.
 *
 * Usage in .astro files:
 *   import { t } from "../i18n/ui";
 *   <nav aria-label={t("aria.main_nav")}>
 *
 * Interpolation:
 *   t("aria.view_service", { title: "Cloud Hosting" })
 *   // → "Ver Cloud Hosting" (es) or "View Cloud Hosting" (en)
 */
import es from "./es.json";
import en from "./en.json";

type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = { es, en };

/** Default locale — matches Astro's i18n defaultLocale when configured */
const DEFAULT_LOCALE = "es";

/** Current locale — will use Astro.currentLocale once i18n routing is enabled (#18) */
let _currentLocale: string = DEFAULT_LOCALE;

/**
 * Set the active locale for the current request.
 * Call this once in your layout before rendering:
 *   setLocale(Astro.currentLocale ?? "es");
 */
export function setLocale(locale: string): void {
	_currentLocale = locale;
}

/**
 * Translate a key using the current locale dictionary.
 *
 * @param key - Dot-notation key (e.g. "aria.open_menu")
 * @param params - Optional interpolation params (e.g. { title: "Cloud" })
 * @returns The translated string, or the key itself if not found
 */
export function t(key: string, params?: Record<string, string>): string {
	const dict = dictionaries[_currentLocale] ?? dictionaries[DEFAULT_LOCALE];
	let value = dict[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;

	if (params) {
		for (const [k, v] of Object.entries(params)) {
			value = value.replace(`{${k}}`, v);
		}
	}

	return value;
}
