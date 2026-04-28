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
	email?: string;
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
