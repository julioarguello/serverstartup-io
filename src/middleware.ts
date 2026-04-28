import { defineMiddleware } from "astro:middleware";
import { loadAriaLabels, type TFunction } from "./i18n/ui";

/**
 * Request-scoped i18n middleware.
 *
 * Loads locale-specific aria labels from CMS and stores the
 * translation function on Astro.locals.t — available in all
 * pages and components without prop drilling.
 *
 * This eliminates the module-level mutable state race condition
 * that existed when t() was a global function.
 */
export const onRequest = defineMiddleware(async ({ locals, currentLocale }, next) => {
	const locale = currentLocale || "es";
	const t = await loadAriaLabels(locale);
	locals.t = t;
	return next();
});
