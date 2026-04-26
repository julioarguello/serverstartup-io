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
 *
 * Dynamically iterates all blocks in the aria_labels widget — no hardcoded
 * key whitelist. Adding a new label in the CMS is sufficient.
 */
export async function loadAriaLabels(locale: string = DEFAULT_LOCALE): Promise<TFunction> {
	const labels = await getUiLabels(locale);

	// Build a flat map from ALL blocks in the aria_labels widget dynamically.
	// No whitelist — any _key added in the CMS is automatically available.
	const map = new Map<string, string>();

	// getUiLabels stores entries as "widgetTitle:blockKey" → text.
	// We extract all aria_labels entries by iterating the underlying map.
	// Since UiLabels only exposes get(), we re-query the raw widget data.
	// However, getUiLabels already fetched it — we just need to probe keys.
	// The cleanest approach: extend getUiLabels to expose getAllForWidget().
	// For now, we use the labels.getAll() pattern we'll add to ui-labels.ts.
	const allAriaLabels = labels.getAll("aria_labels");
	for (const [key, value] of Object.entries(allAriaLabels)) {
		map.set(key, value);
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
