import { cache } from "react";

import { fetchAllRows } from "@/lib/admin/paginate";
import { latestSubscription } from "@/lib/admin/customers";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { portalRoleLabel } from "@/lib/content/portal";
import { v4 as t } from "@/lib/content/v4";
import { kr } from "@/lib/format";
import { formatDkk, toOre } from "@/lib/money";
import { HTML_LANG, type Locale } from "@/lib/i18n";
import { initials } from "@/lib/initials";
import type { PlanRow } from "@/lib/plans-row";
import { quote, type Billing, type Plan, type Quote } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

/* Routes, tab names and the chrome's shape live in ./account-routes so
   that Shell and AccountChip — both client components — can import them
   without dragging this file's Supabase server client into the browser
   bundle. Re-exported here so server callers have one import to make. */
export {
  ACCOUNT_TABS,
  accountHref,
  listHref,
  type AccountChrome,
  type AccountList,
  type AccountTab,
  type WeekNow,
} from "./account-routes";
import { type AccountChrome, type AccountList, type WeekNow } from "./account-routes";

/* ----------------------------------------------------------------- data */

export type AccountLocation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  venueType: string | null;
  m2: number | null;
};

export type Account = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
  roleLabel: string | undefined;
  /** True only for `owner` — the one role `customers_owner_update` lets
      write the billing details (supabase/migrations/0003_tenancy.sql). */
  canEdit: boolean;
  customer: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    billingEmail: string;
    cvr: string | null;
    address: string | null;
    postcode: string | null;
    city: string | null;
    phone: string | null;
  };
  locations: AccountLocation[];
  /** The customer's own saved lists, oldest first — what the rail shows
      under "Dine lister" and what the Ugeplan drags onto a day. */
  lists: AccountList[];
  subscription: { billing: Billing; status: string; currentPeriodEnd: string | null } | null;
  plan: Plan | null;
  /** The subscription priced against this customer's real location count,
      or null when there is no subscription or no resolvable plan. */
  quote: Quote | null;
  chrome: AccountChrome;
};

type ProfileRow = { customer_id: string | null; full_name: string | null; role: string | null };
type CustomerRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  billing_email: string;
  cvr: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  phone: string | null;
};
type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  venue_type: string | null;
  m2: number | null;
};
type PlaylistRow = { id: string; name: string; based_on: string | null };
type SubscriptionRow = {
  plan_id: string;
  billing: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

/**
 * Who is signed in and what they are paying for, or null for a visitor
 * with no session.
 *
 * Every page that renders the product shell calls this, because the
 * header chip and the rail's plan card are chrome and have to agree
 * everywhere. That makes two properties load-bearing:
 *
 *  - **Signed out costs nothing.** `getClaims()` verifies a JWT that is
 *    either in the cookie jar or isn't; with no session this returns
 *    before a single query runs, so the landing page a visitor sees is
 *    one Supabase call that touches no table.
 *  - **Signed in costs one round trip.** React's `cache()` means the
 *    shell and the page body share one load per render, and the five
 *    reads below go out together rather than in sequence.
 *
 * Nothing here uses the service role, and no `customer_id` of this
 * function's own construction appears in any query below the profile
 * read: RLS (0003_tenancy.sql) already narrows `customers`,
 * `locations` and `subscriptions` to the caller's own customer, the same
 * discipline app/my-odatone/billing/page.tsx documents at length. The one
 * id read explicitly is the caller's own `auth.uid()`, because
 * `profiles_read_own` scopes that table to `id = auth.uid()` and there is
 * no bare "give me my profile" query without it.
 *
 * `plans` is read in full, active or not: a customer still paying for a
 * plan staff have since deactivated must be priced from the stored row
 * rather than `quote()`'s compiled fallback, which is what
 * 0009_customer_plan_visibility.sql exists to allow.
 */
export const loadAccount = cache(async (locale: Locale): Promise<Account | null> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) return null;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("customer_id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) console.error("[account] failed to read profile", profileError);
  const profile = profileRow as ProfileRow | null;

  /* Staff have no customer_id by constraint (profiles_tenancy_ck,
     0001_core.sql), and an admin browsing the public site is signed in
     without being a customer. Chrome that is not theirs simply does not
     appear, rather than erroring. */
  if (!profile?.customer_id) return null;

  const [
    { data: customerRow, error: customerError },
    locationsResult,
    { data: playlistRows, error: playlistError },
    { data: subscriptionRows, error: subscriptionError },
    { data: planRows, error: planError },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, status, created_at, billing_email, cvr, address, postcode, city, phone")
      .maybeSingle(),
    fetchAllRows<LocationRow>(
      (from, to) =>
        supabase
          .from("locations")
          .select("id, name, address, city, venue_type, m2", { count: "exact" })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      "account: locations",
    ),
    supabase.from("playlists").select("id, name, based_on").order("created_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select("plan_id, billing, status, current_period_end, created_at"),
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  for (const [label, error] of [
    ["customer", customerError],
    ["locations", locationsResult.error],
    ["playlists", playlistError],
    ["subscriptions", subscriptionError],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[account] failed to read ${label}`, error);
  }

  if (!customerRow) return null;
  const customer = customerRow as CustomerRow;

  const planById = planMap((planRows ?? []) as PlanRow[]);
  const row = latestSubscription((subscriptionRows ?? []) as SubscriptionRow[]);
  const plan: Plan | null = row ? (resolvePlan(row.plan_id, planById, "account") ?? null) : null;

  const locations: AccountLocation[] = locationsResult.rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    venueType: r.venue_type,
    m2: r.m2,
  }));

  const billing = (row?.billing === "annual" ? "annual" : "monthly") as Billing;
  const q = row && plan ? quote(plan, billing, locations.length) : null;

  const email = typeof claims?.email === "string" ? claims.email : null;

  return {
    userId,
    email,
    fullName: profile.full_name,
    role: profile.role,
    roleLabel: portalRoleLabel(profile.role, locale),
    canEdit: profile.role === "owner",
    customer: {
      id: customer.id,
      name: customer.name,
      status: customer.status,
      createdAt: customer.created_at,
      billingEmail: customer.billing_email,
      cvr: customer.cvr,
      address: customer.address,
      postcode: customer.postcode,
      city: customer.city,
      phone: customer.phone,
    },
    locations,
    lists: ((playlistRows ?? []) as PlaylistRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      basedOn: r.based_on,
    })),
    subscription: row
      ? { billing, status: row.status, currentPeriodEnd: row.current_period_end }
      : null,
    plan,
    quote: q,
    chrome: chromeFor(
      locale,
      customer.name,
      email,
      portalRoleLabel(profile.role, locale),
      plan,
      q,
      locations.length,
      row?.current_period_end ?? null,
    ),
  };
});

function chromeFor(
  locale: Locale,
  name: string,
  email: string | null,
  roleLabel: string | undefined,
  plan: Plan | null,
  q: Quote | null,
  locationCount: number,
  periodEnd: string | null,
): AccountChrome {
  const a = t.account.rail;
  const who = { name, initials: initials(name), email, roleLabel };

  if (!plan || !q) {
    return { ...who, plan: null };
  }

  /* The figure on the card is what this account pays a month, whatever
     term it is on: an annual subscription's own charge is the yearly sum
     (quote()'s chargeExVat), and putting that beside "/md." would read as
     a twelve-fold price rise. */
  const price = kr(Math.round(q.monthlyExVat), locale);
  const line = (locationCount === 1 ? a.locationsOne : a.locations)[locale]
    .replace("{n}", String(locationCount))
    .replace("{price}", price);

  return {
    ...who,
    plan: {
      name: plan.name,
      line,
      renews: periodEnd ? a.renews[locale].replace("{date}", shortDate(periodEnd, locale)) : null,
    },
  };
}

/* ----------------------------------------------------------------- dates */

/** "1. nov. 2026" — the form the rail's plan card and the stat tiles use,
    where a full month name would wrap the card. */
export function shortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(HTML_LANG[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** "1. november 2026" — the form the panels use, where there is room. */
export function longDate(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(HTML_LANG[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/* ---------------------------------------------------------- the figures */

/**
 * "398 kr./md. ekskl. moms" — what this subscription actually charges on
 * the term it is on. An annual subscription's own charge is the yearly
 * sum (quote()'s chargeExVat), and putting that beside "/md." would read
 * as a twelve-fold price rise; the two forms are separate strings rather
 * than one with a swapped suffix for exactly that reason.
 */
export function priceExVat(account: Account, locale: Locale): string | null {
  const q = account.quote;
  if (!q || !account.subscription) return null;
  const s = t.account.stats;
  return account.subscription.billing === "annual"
    ? s.perYearExVat[locale].replace("{price}", kr(Math.round(q.chargeExVat), locale))
    : s.perMonthExVat[locale].replace("{price}", kr(Math.round(q.monthlyExVat), locale));
}

/** What the next invoice comes to, VAT included — the figure a customer
    recognises from their bank statement, not the ex-VAT one the plan is
    quoted in. Kept to the øre, because 25 % of 398 is not a round number. */
export function chargeIncVat(account: Account, locale: Locale): string | null {
  const q = account.quote;
  if (!q) return null;
  return formatDkk(toOre(q.chargeIncVat), locale);
}

/** The VAT on this term, as its own figure. */
export function vatAmount(account: Account, locale: Locale): string | null {
  const q = account.quote;
  if (!q) return null;
  return formatDkk(toOre(q.chargeIncVat) - toOre(q.chargeExVat), locale);
}

/** How many of this customer's rooms are larger than the plan allows per
    location. Zero on an unbounded plan — there is nothing to exceed. */
export function overPlan(account: Account): number {
  const max = account.plan?.maxM2 ?? null;
  if (max === null) return 0;
  return account.locations.filter((x) => typeof x.m2 === "number" && x.m2 > max).length;
}

/* ------------------------------------------------------------- the week */

/**
 * What the week has playing right now, and how much of it there is.
 *
 * Read for the signed-in front page's hero, which the design gives its
 * own headline — "Fredag kl. 17 spiller. Resten passer sig selv." — in
 * place of the marketing one. That sentence is only true if something
 * actually is scheduled at this moment, so it is resolved here against
 * `schedule_blocks` rather than asserted.
 *
 * "Now" is the server's clock. Odatone is a Danish business running
 * Danish rooms, and the schedule is stored as a weekday plus minutes
 * past midnight with no zone of its own (0016_schedule_per_location.sql)
 * — so the only clock that can answer "what is playing in the shop" is
 * the one in the shop's own time, which is what the server runs on.
 *
 * Everything is RLS-scoped as the caller, so a visitor with no session
 * reads an empty week rather than being refused.
 */
export async function loadWeekNow(account: Account): Promise<WeekNow> {
  const room = account.locations[0] ?? null;
  const empty: WeekNow = {
    locationName: room?.name ?? null,
    playing: null,
    blocks: 0,
    plannedHours: 0,
    locationCount: account.locations.length,
  };
  if (!room) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("id, location_id, playlist_id, weekday, from_min, to_min");

  if (error) {
    /* A database without 0016 applied has no location_id and no minute
       columns. The hero then falls back to its empty state rather than
       taking the front page down with it. */
    console.error("[account] failed to read the week", error);
    return empty;
  }

  type Block = {
    location_id: string | null;
    playlist_id: string;
    weekday: number;
    from_min: number;
    to_min: number;
  };
  const blocks = (data ?? []) as Block[];

  const minutes = blocks.reduce((sum, b) => sum + Math.max(0, b.to_min - b.from_min), 0);

  /* weekday is 0 = Monday (0015); JavaScript's getDay() is 0 = Sunday. */
  const now = new Date();
  const weekday = (now.getDay() + 6) % 7;
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();

  const live = blocks.find(
    (b) =>
      b.location_id === room.id &&
      b.weekday === weekday &&
      b.from_min <= minuteOfDay &&
      minuteOfDay < b.to_min,
  );

  if (!live) {
    return { ...empty, blocks: blocks.length, plannedHours: Math.round(minutes / 60) };
  }

  const { data: listRow, error: listError } = await supabase
    .from("playlists")
    .select("id, name, genres, bpm_low, bpm_high, vox, langs")
    .eq("id", live.playlist_id)
    .maybeSingle();

  if (listError) console.error("[account] failed to read the playing list", listError);

  const row = listRow as
    | {
        id: string;
        name: string;
        genres: string[] | null;
        bpm_low: number;
        bpm_high: number;
        vox: boolean | null;
        langs: string[] | null;
      }
    | null;

  return {
    locationName: room.name,
    playing: row
      ? {
          id: row.id,
          name: row.name,
          genres: row.genres ?? [],
          bpm: [row.bpm_low, row.bpm_high],
          vox: row.vox,
          langs: row.langs ?? [],
        }
      : null,
    blocks: blocks.length,
    plannedHours: Math.round(minutes / 60),
    locationCount: account.locations.length,
  };
}
