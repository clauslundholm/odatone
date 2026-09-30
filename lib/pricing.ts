/* ==================================================================== *
 *  Odatone plans
 *
 *  Prices mirror the current odatone.com/priser: 149 / 199 / 249 kr. per
 *  location per month, ex. VAT, with an annual option.
 *
 *  ⚠️ ANNUAL_DISCOUNT_PCT: the current pricing page advertises "Spar
 *  45%" on annual billing. That is unusually deep for a SaaS annual
 *  term — confirm it is the intended number and not a launch offer.
 *  ⚠️ VOLUME_TIERS are a proposal for this redesign; the current site
 *  has no multi-location pricing. Confirm before launch.
 * ==================================================================== */

import type { L10n } from "./i18n";
import type { VenueTypeId } from "./rates";

export const ANNUAL_DISCOUNT_PCT = 45;
export const VAT_PCT = 25;

/* Plan ids are database rows, not a closed set. This was
   `"small" | "medium" | "main"` — the three ids compiled into PLANS below —
   but /admin/products can now create and delete plans, so the real set is
   whatever the `plans` table holds at read time. The union was already
   fiction: six places had to launder a database id through `as PlanId` to
   get past the compiler (lib/plans-row.ts, lib/admin/plans.ts,
   lib/signup.ts). Those casts are gone with it.

   The alias stays because it still says something a bare `string` does not:
   this string is a plan id, not a name or a price. It no longer claims to
   know which ids exist — nothing at compile time can. */
export type PlanId = string;

export type Plan = {
  id: PlanId;
  name: string;
  monthly: number;
  /** Upper bound of customer-facing floor area, m². null = no bound. */
  maxM2: number | null;
  tagline: L10n;
  features: L10n[];
};

export const PLANS: Plan[] = [
  {
    id: "small",
    name: "Small Venue",
    monthly: 149,
    maxM2: 100,
    tagline: {
      da: "Til caféen, salonen og den lille butik.",
      en: "For the café, the salon and the small shop.",
    },
    features: [
      { da: "Op til 100 m² pr. lokation", en: "Up to 100 m² per location" },
      { da: "Hele biblioteket — 4.000+ numre", en: "The full library — 4,000+ tracks" },
      { da: "8 genrer, tempo- og vokalstyring", en: "8 genres, tempo and vocal control" },
      { da: "App til iOS og Android + browser", en: "iOS and Android app + browser" },
      { da: "Alle rettigheder betalt", en: "All rights paid for" },
      { da: "Support på dansk", en: "Support in Danish and English" },
    ],
  },
  {
    id: "medium",
    name: "Medium Stage",
    monthly: 199,
    maxM2: 300,
    tagline: {
      da: "Til restauranten, hotellet og butikskæden.",
      en: "For the restaurant, the hotel and the growing chain.",
    },
    features: [
      { da: "Op til 300 m² pr. lokation", en: "Up to 300 m² per location" },
      { da: "Alt i Small Venue", en: "Everything in Small Venue" },
      { da: "Planlagte stemninger døgnet rundt", en: "Scheduled moods around the clock" },
      { da: "Flere zoner pr. lokation", en: "Multiple zones per location" },
      { da: "Offline-afspilning ved netværkssvigt", en: "Offline playback if the network drops" },
      { da: "Én samlet faktura", en: "One consolidated invoice" },
    ],
  },
  {
    id: "main",
    name: "Main Stage",
    monthly: 249,
    maxM2: null,
    tagline: {
      da: "Til kæden, klubben og de store arealer.",
      en: "For the chain, the club and the big rooms.",
    },
    features: [
      { da: "Ubegrænset areal pr. lokation", en: "Unlimited area per location" },
      { da: "Alt i Medium Stage", en: "Everything in Medium Stage" },
      { da: "Kurateret profil af vores musikredaktion", en: "A profile curated by our music editors" },
      { da: "Fjernstyring af alle lokationer", en: "Remote control of every location" },
      { da: "Fast kontaktperson", en: "A named contact person" },
      { da: "EAN-fakturering og SLA", en: "EAN invoicing and an SLA" },
    ],
  },
];

/** The compiled-in plan of this id, or `undefined` if there is no such plan.

    It used to return `PLANS[0]` — Small Venue, 149 kr. — for any id it did
    not recognise, which was survivable only while those three ids were the
    only ids that could exist: every real id found its own entry and the
    fallback was unreachable. Now that /admin/products can create "Arena
    Stage" at 499 kr., an id this array has never heard of is the ordinary
    case, and returning the cheapest plan would price that subscription at
    149 kr. with nothing to show it had happened — on the dashboard's MRR,
    in the customer's own portal, and on an invoice that cannot be amended
    once issued. Returning `undefined` makes each caller state what it wants
    to happen instead. */
export function plan(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** The plan a venue of this size needs.

    `plans` is required, not defaulted to the compiled PLANS, on purpose —
    Task 12's fix round found that a default here is exactly the same trap
    as quote()'s bare-PlanId branch: the safe call (pass the resolved,
    database-backed Plan[]) and the wrong call (fall through to the
    compiled fallback silently) look identical at the call site, and that
    exact shape of bug has already shipped three times on this branch. The
    caller must resolve a `Plan[]` — via lib/plans-server.ts's
    activePlans() on a marketing page, or the compiled PLANS explicitly
    when there genuinely is no database (e.g. a unit test) — and the
    compiler now enforces that every call site makes that choice instead
    of one being able to forget it. */
export function planForM2(m2: number, plans: Plan[]): Plan {
  return plans.find((p) => p.maxM2 === null || m2 <= p.maxM2) ?? plans[plans.length - 1];
}

/** Venue types that usually run louder and longer get bumped a step. */
const LOUD: VenueTypeId[] = ["bar", "fitness"];

/** See planForM2's doc comment for why `plans` is required: a bumped
    recommendation must land on the same database-backed plan objects the
    caller is pricing with, or "bumped one step up from the small plan"
    and "the small plan" could disagree about what the small plan even
    costs. */
export function recommendPlan(m2: number, type: VenueTypeId, plans: Plan[]): Plan {
  const base = planForM2(m2, plans);
  if (!LOUD.includes(type)) return base;
  const i = plans.findIndex((p) => p.id === base.id);
  return plans[Math.min(i + 1, plans.length - 1)];
}

export type VolumeTier = { min: number; discountPct: number; label: L10n };

export const VOLUME_TIERS: VolumeTier[] = [
  { min: 1, discountPct: 0, label: { da: "1 lokation", en: "1 location" } },
  { min: 2, discountPct: 10, label: { da: "2–4 lokationer", en: "2–4 locations" } },
  { min: 5, discountPct: 15, label: { da: "5–9 lokationer", en: "5–9 locations" } },
  { min: 10, discountPct: 20, label: { da: "10+ lokationer", en: "10+ locations" } },
];

export function volumeTier(locations: number): VolumeTier {
  return [...VOLUME_TIERS].reverse().find((t) => locations >= t.min) ?? VOLUME_TIERS[0];
}

export type Billing = "monthly" | "annual";

export type Quote = {
  plan: Plan;
  billing: Billing;
  locations: number;
  /** List price per location per month before any discount. */
  listPerLocation: number;
  /** Effective price per location per month after all discounts. */
  perLocation: number;
  volumeDiscountPct: number;
  annualDiscountPct: number;
  /** What is actually charged, per period. */
  chargeExVat: number;
  chargeIncVat: number;
  /** Normalised for comparison. */
  monthlyExVat: number;
  yearlyExVat: number;
  /** How much the annual term saves versus paying monthly, per year. */
  annualSavingYear: number;
};

/** Prices a resolved Plan object.

    This used to accept a bare `PlanId` as well, and that overload is gone.
    Its id branch looked the id up against the compiled `PLANS` constant and
    never consulted the database, so `quote(id, ...)` and `quote(plan, ...)`
    read identically at the call site while one of them ignored every price
    a staff member had edited. lib/admin/plans.ts records that trap being
    walked into twice — the public pricing page and the dashboard's MRR,
    once each — and now that a plan id may name a row the compiled array has
    never heard of, the same call would not merely serve a stale price but
    invent one. Removing the overload makes the compiler refuse it: a caller
    holding only an id has to resolve it first (lib/admin/plans.ts's
    `resolvePlan`, or lib/plans-server.ts's `activePlans`) and decide for
    itself what an unresolvable id means. Everything past this line is
    unchanged: same rounding, same discounts, same shape. */
export function quote(p: Plan, billing: Billing, locations: number): Quote {
  const n = Math.max(1, Math.round(locations));
  const vol = volumeTier(n);
  const annualPct = billing === "annual" ? ANNUAL_DISCOUNT_PCT : 0;

  const afterVolume = p.monthly * (1 - vol.discountPct / 100);
  const perLocation = round2(afterVolume * (1 - annualPct / 100));

  const monthlyExVat = round2(perLocation * n);
  const yearlyExVat = round2(monthlyExVat * 12);
  const chargeExVat = billing === "annual" ? yearlyExVat : monthlyExVat;

  const monthlyIfPaidMonthly = round2(afterVolume * n) * 12;

  return {
    plan: p,
    billing,
    locations: n,
    listPerLocation: p.monthly,
    perLocation,
    volumeDiscountPct: vol.discountPct,
    annualDiscountPct: annualPct,
    chargeExVat,
    chargeIncVat: round2(chargeExVat * (1 + VAT_PCT / 100)),
    monthlyExVat,
    yearlyExVat,
    annualSavingYear: Math.max(0, round2(monthlyIfPaidMonthly - yearlyExVat)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
