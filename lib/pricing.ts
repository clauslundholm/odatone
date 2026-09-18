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

export type PlanId = "small" | "medium" | "main";

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

export function plan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** The plan a venue of this size needs.

    Accepts an optional, already-resolved plan list — the same
    database-backed `Plan[]` lib/plans-server.ts's activePlans() returns,
    ordered by `sort` — so a staff edit to a plan's `max_m2` moves the
    recommendation the calculator and signup flow make, not just its price.
    Defaults to the compiled PLANS so every existing caller (and every
    non-marketing caller with no database in reach, e.g. tests) still works
    unchanged. */
export function planForM2(m2: number, plans: Plan[] = PLANS): Plan {
  return plans.find((p) => p.maxM2 === null || m2 <= p.maxM2) ?? plans[plans.length - 1];
}

/** Venue types that usually run louder and longer get bumped a step. */
const LOUD: VenueTypeId[] = ["bar", "fitness"];

/** See planForM2's doc comment for why `plans` is a parameter, not always
    the compiled PLANS: a bumped recommendation must land on the same
    database-backed plan objects the caller is pricing with, or "bumped
    one step up from the small plan" and "the small plan" could disagree
    about what the small plan even costs. */
export function recommendPlan(m2: number, type: VenueTypeId, plans: Plan[] = PLANS): Plan {
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

/** Accepts either a plan id (looked up against the compiled PLANS, exactly as
    before) or an already-resolved Plan object (so a caller holding a
    database-backed Plan — see lib/plans-server.ts — doesn't have to round-trip
    through the compiled id lookup just to price it). Everything past this line
    is unchanged: same rounding, same discounts, same shape. */
export function quote(planOrId: PlanId | Plan, billing: Billing, locations: number): Quote {
  const p = typeof planOrId === "string" ? plan(planOrId) : planOrId;
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
