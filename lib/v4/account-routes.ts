import type { Locale } from "@/lib/i18n";

/**
 * The account area's routes and the shape of the chrome that hangs off
 * them — the part of lib/v4/account.ts a client component may import.
 *
 * Split out for exactly that reason: Shell and AccountChip are client
 * components, and importing anything from account.ts drags
 * lib/supabase/server.ts (and `next/headers` with it) into the browser
 * bundle, which the build refuses outright. Nothing here touches a
 * request, a cookie or a database.
 */

/** The four tabs, by the name the code calls them. The URL each one gets
    is localised below — a Danish customer is on /da/konto/fakturering,
    not /da/konto/billing. */
export const ACCOUNT_TABS = ["summary", "billing", "locations", "settings"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** The account area's own path segment, per language — the same shape
    /spilleplan and /saesoner already take (lib/i18n.ts's SLUGS is for the
    marketing pages under (site), which these are not). */
const ROOT: Record<Locale, string> = { da: "konto", en: "account" };

const SUB: Record<Exclude<AccountTab, "summary">, Record<Locale, string>> = {
  billing: { da: "fakturering", en: "billing" },
  locations: { da: "lokationer", en: "locations" },
  settings: { da: "indstillinger", en: "settings" },
};

export function accountHref(locale: Locale, tab: AccountTab = "summary"): string {
  const base = `/${locale}/${ROOT[locale]}`;
  return tab === "summary" ? base : `${base}/${SUB[tab][locale]}`;
}

/** One of the customer's own saved lists, as the rail draws it and the
    Ugeplan drags it. The same three fields `playlists` stores beyond its
    rules (0015_playlists_and_schedule.sql). */
export type AccountList = { id: string; name: string; basedOn: string | null };

/** The list editor, per language: /da/liste/<id>, /en/list/<id>. */
export function listHref(locale: Locale, id: string): string {
  return `/${locale}/${locale === "da" ? "liste" : "list"}/${id}`;
}

/**
 * What the signed-in front page's hero says: which room, what the week
 * has playing in it at this moment, and the three figures under it.
 *
 * `playing` carries the list's rules rather than its tracks, because a
 * list IS its rules (0015_playlists_and_schedule.sql) — the hero's play
 * button hands them straight to the player's own filters.
 */
export type WeekNow = {
  locationName: string | null;
  playing: {
    id: string;
    name: string;
    genres: string[];
    bpm: [number, number];
    vox: boolean | null;
    /** Empty = any language, as on Filters. */
    langs: string[];
  } | null;
  /** Blocks across every room, and the hours they add up to. */
  blocks: number;
  plannedHours: number;
  locationCount: number;
};

/** Everything Shell needs to dress itself for a signed-in visitor: the
    header chip in place of the Log ind / trial pair, and the rail's plan
    card in place of the "from {price}" pitch. Pre-formatted on the server
    because Shell is a client component and these figures come from the
    database and a locale-aware formatter. */
export type AccountChrome = {
  /** The company name, shown beside the monogram and again at the head
      of the menu, where the design puts the signed-in identity. */
  name: string;
  initials: string;
  /** Who is signed in, under the company name in the menu. */
  email: string | null;
  roleLabel?: string;
  /** Null for an account with no subscription yet — the card then says
      so rather than quoting a price nobody is being charged. */
  plan: { name: string; line: string; renews: string | null } | null;
};
