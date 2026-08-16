/**
 * Site-level type extensions.
 *
 * - SiteSettings: matches seed.json "settings" schema
 * - App.Locals: adds request-scoped `t` translation function
 */
import type { TFunction } from "./i18n/ui";

/** Typed site settings matching seed.json "settings" schema */
export interface SiteSettings {
	title?: string;
	tagline?: string;
	phone?: string;
	phoneDisplay?: string;
	/* Base64-encoded contact endpoints — decoded on click so the number never
	   appears in static HTML, JSON-LD or the committed seed in plain text. */
	phoneEncoded?: string;
	repoUrl?: string;
	whatsappEncoded?: string;
	email?: string;
	/* EN-locale address (hello@); ES pages and the shared footer use `email`. */
	emailEn?: string;
	whatsapp?: string;
	defaultCtaLabel?: string;
	contactWhatsappLabel?: string;
	contactPhoneLabel?: string;
	contactEmailLabel?: string;
}

declare global {
	namespace App {
		interface Locals {
			t: TFunction;
		}
	}
}
