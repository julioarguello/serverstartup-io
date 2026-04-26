/**
 * i18n helper for UI accessibility strings (aria-labels, alt text, etc.)
 *
 * Reads from CMS widget areas (ui_labels_{locale} → aria_labels widget)
 * rather than static JSON files — single editing surface for translators.
 *
 * Two-step usage in layouts:
 *   1. In Base.astro (once): await loadAriaLabels(locale);
 *   2. In any component:     t("go_home")   // sync, no await needed
 *
 * Interpolation:
 *   t("view_service", { title: "Cloud Hosting" })
 *   // → "Ver Cloud Hosting" (es) or "View Cloud Hosting" (en)
 */
import { getUiLabels } from "../utils/ui-labels";

const DEFAULT_LOCALE = "es";

/** In-memory label cache — loaded once per request by Base.astro */
let _labels: Map<string, string> = new Map();

/**
 * Load aria_labels from the locale-scoped CMS widget area.
 * Must be called once in the layout before any t() calls.
 */
export async function loadAriaLabels(locale: string = DEFAULT_LOCALE): Promise<void> {
	const labels = await getUiLabels(locale);
	_labels = new Map();

	// Pre-populate from the aria_labels widget
	// We pull all keys from the widget and cache them
	const area = await import("emdash").then((m) => m.getWidgetArea(`ui_labels_${locale}`));
	const widgets = (area?.widgets as any[]) ?? [];
	const ariaWidget = widgets.find((w: any) => w.title === "aria_labels");

	if (ariaWidget?.content) {
		for (const block of ariaWidget.content) {
			const key = block._key || "";
			const text = block.children?.map((c: any) => c.text || "").join("") || "";
			if (key) {
				_labels.set(key, text);
			}
		}
	}

	// Fallback: if locale widget was empty, try default
	if (_labels.size === 0 && locale !== DEFAULT_LOCALE) {
		const fallbackArea = await import("emdash").then((m) =>
			m.getWidgetArea(`ui_labels_${DEFAULT_LOCALE}`),
		);
		const fbWidgets = (fallbackArea?.widgets as any[]) ?? [];
		const fbAriaWidget = fbWidgets.find((w: any) => w.title === "aria_labels");

		if (fbAriaWidget?.content) {
			for (const block of fbAriaWidget.content) {
				const key = block._key || "";
				const text = block.children?.map((c: any) => c.text || "").join("") || "";
				if (key) {
					_labels.set(key, text);
				}
			}
		}
	}
}

/**
 * Translate a key using the loaded aria labels.
 * Sync — must call loadAriaLabels() first in the layout.
 *
 * @param key - Block _key (e.g. "open_menu", "go_home")
 * @param params - Optional interpolation params (e.g. { title: "Cloud" })
 * @returns The translated string, or the key itself if not found
 */
export function t(key: string, params?: Record<string, string>): string {
	let value = _labels.get(key) ?? key;

	if (params) {
		for (const [k, v] of Object.entries(params)) {
			value = value.replace(`{${k}}`, v);
		}
	}

	return value;
}
