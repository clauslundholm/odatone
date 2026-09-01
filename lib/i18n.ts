export const LOCALES = ["da", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "da";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** A string that exists in both languages. */
export type L10n = Record<Locale, string>;
/** Any value that exists in both languages. */
export type L10nOf<T> = Record<Locale, T>;

export const LOCALE_LABEL: Record<Locale, string> = { da: "Dansk", en: "English" };
export const LOCALE_SHORT: Record<Locale, string> = { da: "DA", en: "EN" };
export const HTML_LANG: Record<Locale, string> = { da: "da-DK", en: "en-GB" };

/* ------------------------------------------------------------------ *
 *  Routing
 *
 *  Every page is identified by a stable key. Slugs are localised, so a
 *  Danish visitor gets /da/priser and a British one /en/pricing. The
 *  language switcher resolves key -> slug in the other locale, which is
 *  why nothing anywhere hard-codes a path.
 * ------------------------------------------------------------------ */

export const PAGE_KEYS = [
  "player",
  "savings",
  "pricing",
  "artists",
  "about",
  "contact",
  "signup",
  "privacy",
  "terms",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const SLUGS: Record<PageKey, L10n> = {
  player: { da: "afspiller", en: "player" },
  savings: { da: "besparelse", en: "savings" },
  pricing: { da: "priser", en: "pricing" },
  artists: { da: "artister", en: "artists" },
  about: { da: "om-odatone", en: "about" },
  contact: { da: "kontakt", en: "contact" },
  signup: { da: "kom-i-gang", en: "get-started" },
  privacy: { da: "privatliv", en: "privacy" },
  terms: { da: "betingelser", en: "terms" },
};

const SLUG_LOOKUP: Record<Locale, Record<string, PageKey>> = {
  da: {},
  en: {},
};
for (const key of PAGE_KEYS) {
  for (const locale of LOCALES) {
    SLUG_LOOKUP[locale][SLUGS[key][locale]] = key;
  }
}

export function keyFromSlug(locale: Locale, slug: string): PageKey | null {
  return SLUG_LOOKUP[locale][slug] ?? null;
}

/** Canonical href for a page in a given language. `null` = the home page. */
export function href(locale: Locale, key: PageKey | null, hash?: string): string {
  const base = key === null ? `/${locale}` : `/${locale}/${SLUGS[key][locale]}`;
  return hash ? `${base}#${hash}` : base;
}

/** Same page, other language. */
export function switchLocale(to: Locale, key: PageKey | null): string {
  return href(to, key);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "da" ? "en" : "da";
}
