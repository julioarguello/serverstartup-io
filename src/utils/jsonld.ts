/**
 * JSON-LD structured data helpers for schema.org SEO.
 *
 * Each function returns a plain object ready to be serialized with JSON.stringify
 * and injected into a <script type="application/ld+json"> tag.
 *
 * `siteUrl` is always passed from the calling page via `Astro.site?.origin`
 * (configured in astro.config.mjs) — never hardcoded here.
 */

const SITE_NAME = "Server Startup";

// ─── Shared Organization object ────────────────────────────────────

function organizationSchema(siteUrl: string, phone?: string, email?: string) {
	return {
		"@type": "Organization",
		name: SITE_NAME,
		url: siteUrl,
		logo: {
			"@type": "ImageObject",
			url: `${siteUrl}/assets/logo-vertical.png`,
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
	siteUrl: string;
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
			...organizationSchema(opts.siteUrl, opts.phone, opts.email),
			description: opts.description,
		},
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			name: SITE_NAME,
			url: `${opts.siteUrl}${localePrefix}/`,
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
	siteUrl: string;
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
		url: `${opts.siteUrl}${localePrefix}/${opts.slug}`,
		provider: organizationSchema(opts.siteUrl),
		areaServed: {
			"@type": "Place",
			name: "Spain",
		},
		availableChannel: {
			"@type": "ServiceChannel",
			serviceUrl: `${opts.siteUrl}${localePrefix}/${opts.slug}`,
		},
	};
}

// ─── About page ────────────────────────────────────────────────────

export interface AboutJsonLdOptions {
	siteUrl: string;
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
		url: `${opts.siteUrl}${localePrefix}${aboutPath}`,
		mainEntity: {
			...organizationSchema(opts.siteUrl),
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
	siteUrl: string;
	description: string;
	/* Deliberately optional and normally omitted: a phone in JSON-LD is
	   indexed by search engines, defeating the click-to-decode obfuscation. */
	phone?: string;
	email: string;
}

export function contactJsonLd(opts: ContactJsonLdOptions) {
	return {
		"@context": "https://schema.org",
		"@type": "LocalBusiness",
		name: SITE_NAME,
		description: opts.description,
		url: opts.siteUrl,
		...(opts.phone && { telephone: opts.phone }),
		email: opts.email,
		contactPoint: [{
			"@type": "ContactPoint",
			...(opts.phone && { telephone: opts.phone }),
			contactType: "customer service",
			availableLanguage: ["Spanish", "English"],
		}],
	};
}

// ─── Blog post (BlogPosting) ───────────────────────────────────────

export interface BlogPostJsonLdOptions {
	siteUrl: string;
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
		url: `${opts.siteUrl}${localePrefix}/posts/${opts.slug}`,
		...(opts.image && { image: opts.image }),
		...(opts.publishedAt && { datePublished: opts.publishedAt.toISOString() }),
		...(opts.updatedAt && { dateModified: opts.updatedAt.toISOString() }),
		publisher: {
			"@type": "Organization",
			name: SITE_NAME,
			logo: {
				"@type": "ImageObject",
				url: `${opts.siteUrl}/assets/logo-vertical.png`,
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
			"@id": `${opts.siteUrl}${localePrefix}/posts/${opts.slug}`,
		},
	};
}

export interface BreadcrumbJsonLdOptions {
	siteUrl: string;
	locale: string;
	/** Ordered trail AFTER home, e.g. [{ name: "Comercio electrónico", path: "/comercio-electronico" }] */
	trail: Array<{ name: string; path: string }>;
	homeName: string;
}

/** BreadcrumbList backing the header prompt breadcrumb (#211). */
export function breadcrumbJsonLd(opts: BreadcrumbJsonLdOptions) {
	const localePrefix = opts.locale === "es" ? "" : `/${opts.locale}`;
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: opts.homeName,
				item: `${opts.siteUrl}${localePrefix}/`,
			},
			...opts.trail.map((t, i) => ({
				"@type": "ListItem",
				position: i + 2,
				name: t.name,
				item: `${opts.siteUrl}${t.path}`,
			})),
		],
	};
}
