/**
 * UI Labels helper — extracts translatable strings from the ui_labels widget area.
 *
 * Widget structure: each widget in the "ui_labels" area has a title (e.g. "footer_headings")
 * and content blocks with _key identifiers (e.g. "trust_title", "services_title").
 *
 * Usage:
 *   const labels = await getUiLabels();
 *   labels.get("footer_headings", "trust_title")  // → "Confían en nosotros"
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

/**
 * Builds a lookup map from the ui_labels widget area.
 * Returns a helper with .get(widgetTitle, blockKey, fallback?) method.
 */
export async function getUiLabels() {
	const area = await getWidgetArea("ui_labels");
	const widgets: Widget[] = (area?.widgets as Widget[]) ?? [];

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

	return {
		/**
		 * Get a UI label by widget title and block key.
		 * @param widgetTitle - The widget's title (e.g. "footer_headings")
		 * @param blockKey - The block's _key (e.g. "trust_title")
		 * @param fallback - Optional fallback if the label is not found
		 */
		get(widgetTitle: string, blockKey: string, fallback = ""): string {
			return map.get(`${widgetTitle}:${blockKey}`) || fallback;
		},
	};
}
