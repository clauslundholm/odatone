import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";

/** The customer portal has no locale segment in its URL — app/my-odatone/*
    are fixed paths (see lib/tenancy.ts's PORTAL prefix), unlike the
    marketing site's /da and /en, because Task 13's invite already points
    at the fixed path /my-odatone and a redesign of that is out of
    scope here. A cookie carries the visitor's choice instead: written by
    setPortalLocale (app/my-odatone/portal-actions.ts) whenever someone
    picks a language, and read here on every server-rendered portal page. */
export const PORTAL_LOCALE_COOKIE = "odatone-portal-locale";

/** Danish is the default for a visitor with no cookie yet — matching
    lib/i18n.ts's own DEFAULT_LOCALE, and this being a Danish business's
    portal. An unrecognised cookie value (a stale build, a hand-edited
    cookie) falls back the same way rather than throwing. */
export async function getPortalLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(PORTAL_LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}
