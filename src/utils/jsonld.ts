/**
 * JSON-LD structured data helpers for schema.org SEO.
 *
 * Each function returns a plain object ready to be serialized with JSON.stringify
 * and injected into a <script type="application/ld+json"> tag.
 */

const SITE_URL = "https://www.serverstartup.io";
const SITE_NAME = "Server Startup";
const LOGO_URL = `${SITE_URL}/assets/logo-vertical.png`;

// ─── Shared Organization object ────────────────────────────────────

function organizationSchema(phone?: string, email?: string) {
	return {
		"@type": "Organization",
		name: SITE_NAME,
		url: SITE_URL,
		logo: {
			"@type": "ImageObject",
			url: LOGO_URL,
		},
		...(phone && { telephone: phone }),
		...(email && { contactPoint: [{
			"@type": "ContactPoint",
			telephone: phone,
			email,
			contactType: "customer service",
			availableLanguage: ["Spanish", "English"],
		}] }),
	};
}

// ─── Homepage: Organization + WebSite ──────────────────────────────

export interface HomepageJsonLdOptions {
	description: string;
	locale: string;
	phone?: string;
	email?: string;
}

export function homepageJsonLd(opts: HomepageJsonLdOptions) {
	const localePrefix = opts.locale === "es" ? "" : `/${opts.locale}`;
	return [
		{
			"@context": "https://schema.org",
			...organizationSchema(opts.phone, opts.email),
			description: opts.description,
		},
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			name: SITE_NAME,
			url: `${SITE_URL}${localePrefix}/`,
			inLanguage: opts.locale === "es" ? "es-ES" : "en-US",
			publisher: {
				"@type": "Organization",
				name: SITE_NAME,
			},
		},
	];
}

// ─── Service detail page ───────────────────────────────────────────

export interface ServiceJsonLdOptions {
	name: string;
	description: string;
	slug: string;
	locale: string;
}

export function serviceJsonLd(opts: ServiceJsonLdOptions) {
	const localePrefix = opts.locale === "es" ? "" : `/${opts.locale}`;
	return {
		"@context": "https://schema.org",
		"@type": "Service",
		name: opts.name,
		description: opts.description,
		url: `${SITE_URL}${localePrefix}/${opts.slug}`,
		provider: organizationSchema(),
		areaServed: {
			"@type": "Place",
			name: "Spain",
		},
		availableChannel: {
			"@type": "ServiceChannel",
			serviceUrl: `${SITE_URL}${localePrefix}/${opts.slug}`,
		},
	};
}

// ─── About page ────────────────────────────────────────────────────

export interface AboutJsonLdOptions {
	description: string;
	locale: string;
	members?: { name: string; role?: string; image?: string }[];
}

export function aboutJsonLd(opts: AboutJsonLdOptions) {
	const localePrefix = opts.locale === "es" ? "" : `/${opts.locale}`;
	const aboutPath = opts.locale === "es" ? "/quienes-somos" : "/about-us";
	return {
		"@context": "https://schema.org",
		"@type": "AboutPage",
		name: SITE_NAME,
		description: opts.description,
		url: `${SITE_URL}${localePrefix}${aboutPath}`,
		mainEntity: {
			...organizationSchema(),
			...(opts.members && opts.members.length > 0 && {
				member: opts.members.map((m) => ({
					"@type": "Person",
					name: m.name,
					...(m.role && { jobTitle: m.role }),
					...(m.image && { image: m.image }),
				})),
			}),
		},
	};
}

// ─── Contact page (LocalBusiness) ──────────────────────────────────

export interface ContactJsonLdOptions {
	description: string;
	phone: string;
	email: string;
}

export function contactJsonLd(opts: ContactJsonLdOptions) {
	return {
		"@context": "https://schema.org",
		"@type": "LocalBusiness",
		name: SITE_NAME,
		description: opts.description,
		url: SITE_URL,
		telephone: opts.phone,
		email: opts.email,
		contactPoint: [{
			"@type": "ContactPoint",
			telephone: opts.phone,
			contactType: "customer service",
			availableLanguage: ["Spanish", "English"],
		}],
	};
}

// ─── Blog post (BlogPosting) ───────────────────────────────────────

export interface BlogPostJsonLdOptions {
	title: string;
	description: string;
	slug: string;
	locale: string;
	publishedAt?: Date | null;
	updatedAt?: Date;
	image?: string;
	authors?: { name: string; avatar?: string }[];
}

export function blogPostJsonLd(opts: BlogPostJsonLdOptions) {
	const localePrefix = opts.locale === "es" ? "" : `/${opts.locale}`;
	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: opts.title,
		description: opts.description,
		url: `${SITE_URL}${localePrefix}/posts/${opts.slug}`,
		...(opts.image && { image: opts.image }),
		...(opts.publishedAt && { datePublished: opts.publishedAt.toISOString() }),
		...(opts.updatedAt && { dateModified: opts.updatedAt.toISOString() }),
		publisher: {
			"@type": "Organization",
			name: SITE_NAME,
			logo: {
				"@type": "ImageObject",
				url: LOGO_URL,
			},
		},
		...(opts.authors && opts.authors.length > 0 && {
			author: opts.authors.map((a) => ({
				"@type": "Person",
				name: a.name,
				...(a.avatar && { image: a.avatar }),
			})),
		}),
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": `${SITE_URL}${localePrefix}/posts/${opts.slug}`,
		},
	};
}
