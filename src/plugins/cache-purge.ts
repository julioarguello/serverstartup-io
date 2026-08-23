/**
 * cache-purge — in-repo trusted EmDash plugin (#357).
 *
 * Purges the Workers Cache tags of an entry the moment it is published,
 * unpublished, deleted or restored, so a content withdrawal is enforced at
 * the edge instead of waiting out the TTL. EmDash never calls the cache
 * provider's purge itself (upstream emdash#2042).
 *
 * It lives in the repo deliberately: plugin settings are not part of
 * seed.json, so anything configured through the admin UI (the
 * webhook-notifier route to the same goal) would be silently disarmed by
 * every clean rebuild. Code in git survives all of them.
 *
 * Tag scheme: EmDash's cacheHints tag every cached page with the collection
 * name plus the row ids it rendered, and the Cloudflare provider adds a
 * per-path tag. Purging [collection, id] therefore also catches pages that
 * embed the entry (home, menus rendered from collections, listings).
 *
 * Menus and site settings have NO hooks in EmDash 0.34 (checked against
 * HookNameV2 in the installed dist) — their staleness is bounded by the
 * 1-hour edge TTL set in src/middleware.ts, not by this plugin.
 */

type ContentHookPayload = {
	content: Record<string, unknown>;
	collection: string;
	isNew?: boolean;
};

type PluginContext = {
	log?: { info?: (msg: string) => void; error?: (msg: string) => void };
};

async function purgeEntry(payload: ContentHookPayload, ctx?: PluginContext): Promise<void> {
	const id = payload.content?.id == null ? "" : String(payload.content.id);
	const tags = [payload.collection, id].filter(Boolean);
	if (tags.length === 0) return;
	const { cache } = await import("cloudflare:workers");
	if (typeof cache?.purge !== "function") {
		// The local dev emulator (miniflare 5.2026xx) does not implement
		// Workers Cache purge at all — measured 2026-08-23, zero purge refs in
		// its dist. A concise warn instead of a scary FAILED keeps the real
		// alarm below meaningful: on the deployed runtime this branch firing
		// would mean purge is structurally off.
		console.warn(`[cache-purge] runtime lacks cache.purge (local dev emulator?) — purge of [${tags.join(", ")}] skipped`);
		return;
	}
	try {
		await cache.purge({ tags });
		ctx?.log?.info?.(`[cache-purge] purged tags: ${tags.join(", ")}`);
	} catch (error) {
		// Loud, never swallowed: a purge that silently fails is indistinguishable
		// from one that worked, and #357 exists precisely because of that. The
		// hook's errorPolicy keeps the editor unblocked; this line keeps the
		// failure visible in Workers Logs / wrangler tail.
		console.error(`[cache-purge] FAILED for tags [${tags.join(", ")}]:`, error);
		throw error;
	}
}

const hook = {
	priority: 100,
	timeout: 10_000,
	errorPolicy: "continue" as const,
	handler: purgeEntry,
};

export default {
	hooks: {
		// afterSave covers edits to an ALREADY-published entry — afterPublish
		// only fires on status transitions, and an edited published page must
		// not stay stale until the TTL. Draft saves purge nothing.
		"content:afterSave": {
			...hook,
			handler: async (payload: ContentHookPayload & { content: { status?: unknown } }, ctx?: PluginContext) => {
				if (payload.content?.status === "published") await purgeEntry(payload, ctx);
			},
		},
		"content:afterPublish": hook,
		"content:afterUnpublish": hook,
		"content:afterDelete": hook,
		"content:afterRestore": hook,
	},
};
