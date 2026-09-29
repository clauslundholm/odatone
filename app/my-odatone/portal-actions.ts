"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { isLocale, type Locale } from "@/lib/i18n";
import { PORTAL_LOCALE_COOKIE } from "@/lib/portal-locale";
import { createClient } from "@/lib/supabase/server";

/** Bound with a fixed locale per button (see components/portal/LocaleSwitch.tsx)
    rather than reading one out of the submitted form — there are exactly two
    buttons, DA and EN, and each already knows which language it is. The
    `isLocale` check is still here because `locale` reaches this function as
    plain form-action data over the wire, not a value the type system can
    vouch for at the call site. */
export async function setPortalLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(PORTAL_LOCALE_COOKIE, locale, {
    path: "/my-odatone",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/my-odatone");
}
