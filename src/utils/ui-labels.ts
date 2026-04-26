/**
 * UI Labels helper — extracts translatable strings from locale-scoped widget areas.
 *
 * Widget area naming convention: ui_labels_{locale} (e.g. ui_labels_es, ui_labels_en).
 * Each widget has a title (e.g. "footer_headings", "aria_labels") and
 * content blocks with _key identifiers (e.g. "trust_title", "go_home").
 *
 * Usage:
 *   const labels = await getUiLabels("es");
 *   labels.get("footer_headings", "trust_title")  // → "Confían en nosotros"
 *   labels.get("aria_labels", "go_home")           // → "Server Startup — Ir al inicio"
 */
import { getWidgetArea } from "emdash";

type WidgetBlock = {
	_type: string;
	_key?: string;
	children?: Array<{ _type: string; text?: string }>;
};

type Widget = {
	title?: string;
	content?: WidgetBlock[];
};

export type UiLabels = {
	/**
	 * Get a UI label by widget title and block key.
	 * @param widgetTitle - The widget's title (e.g. "footer_headings", "aria_labels")
	 * @param blockKey - The block's _key (e.g. "trust_title", "go_home")
	 * @param fallback - Optional fallback if the label is not found
	 */
	get(widgetTitle: string, blockKey: string, fallback?: string): string;
	/**
	 * Get all labels for a widget as a key→value record.
	 * @param widgetTitle - The widget's title (e.g. "aria_labels")
	 */
	getAll(widgetTitle: string): Record<string, string>;
};

const DEFAULT_LOCALE = "es";

/**
 * Builds a lookup map from the locale-scoped widget area.
 * Falls back to the default locale (es) if the requested locale is not found.
 */
export async function getUiLabels(locale: string = DEFAULT_LOCALE): Promise<UiLabels> {
	const areaName = `ui_labels_${locale}`;
	const area = await getWidgetArea(areaName);

	// Fallback to default locale if not found
	let widgets: Widget[] = (area?.widgets as Widget[]) ?? [];
	if (widgets.length === 0 && locale !== DEFAULT_LOCALE) {
		const fallbackArea = await getWidgetArea(`ui_labels_${DEFAULT_LOCALE}`);
		widgets = (fallbackArea?.widgets as Widget[]) ?? [];
	}

	// Build a flat map: "widgetTitle:blockKey" → text
	const map = new Map<string, string>();
	for (const widget of widgets) {
		const wTitle = widget.title || "";
		for (const block of widget.content || []) {
			const key = block._key || "";
			const text =
				block.children?.map((c) => c.text || "").join("") || "";
			if (key) {
				map.set(`${wTitle}:${key}`, text);
			}
		}
	}

	const prefix = (widgetTitle: string) => `${widgetTitle}:`;

	return {
		get(widgetTitle: string, blockKey: string, fallback = ""): string {
			return map.get(`${widgetTitle}:${blockKey}`) || fallback;
		},
		getAll(widgetTitle: string): Record<string, string> {
			const result: Record<string, string> = {};
			const p = prefix(widgetTitle);
			for (const [key, value] of map.entries()) {
				if (key.startsWith(p)) {
					result[key.slice(p.length)] = value;
				}
			}
			return result;
		},
	};
}
