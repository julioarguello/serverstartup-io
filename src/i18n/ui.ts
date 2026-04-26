/**
 * i18n helper for UI accessibility strings (aria-labels, alt text, etc.)
 *
 * Reads from CMS widget areas (ui_labels_{locale} → aria_labels widget).
 * Request-scoped via explicit passing — no module-level mutable state.
 *
 * Usage in Base.astro:
 *   const t = await loadAriaLabels(locale);
 *   // pass t via <Component t={t} /> or use directly
 *
 * Interpolation:
 *   t("view_service", { title: "Cloud Hosting" })
 */
import { getUiLabels } from "../utils/ui-labels";

const DEFAULT_LOCALE = "es";

export type TFunction = (key: string, params?: Record<string, string>) => string;

/**
 * Load aria_labels from the locale-scoped CMS widget area.
 * Returns a request-scoped translation function — no global state.
 */
export async function loadAriaLabels(locale: string = DEFAULT_LOCALE): Promise<TFunction> {
	const labels = await getUiLabels(locale);

	// Build a flat map from the aria_labels widget
	const map = new Map<string, string>();

	// getUiLabels already parsed all widgets — just extract aria_labels keys
	// We use the same labels helper to read from the aria_labels widget
	// This avoids a second getWidgetArea() call
	const ariaKeys = [
		"go_home", "open_menu", "close_menu", "main_menu", "main_nav",
		"trust_section", "trust_logos", "hero_intro", "content",
		"cta_section", "cf_partner", "team_section", "values_section",
		"view_service", "toc",
	];

	for (const key of ariaKeys) {
		const value = labels.get("aria_labels", key);
		if (value) {
			map.set(key, value);
		}
	}

	return function t(key: string, params?: Record<string, string>): string {
		let value = map.get(key) ?? key;

		if (params) {
			for (const [k, v] of Object.entries(params)) {
				value = value.replace(`{${k}}`, v);
			}
		}

		return value;
	};
}
