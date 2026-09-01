/* ==================================================================== *
 *  ⚠️  RATE CARD — VERIFY BEFORE LAUNCH
 *
 *  Every number the savings calculator shows comes from this file and
 *  nowhere else. Change it here and the whole site follows.
 *
 *  Koda and Gramex publish tiered rate cards (kunde.koda.dk), but those
 *  pages block automated retrieval, so the model below is *calibrated*
 *  rather than copied: the coefficients are chosen so that the output
 *  for a typical venue lands inside the guideline annual totals that
 *  Danish background-music resellers publish:
 *
 *    Frisørsalon, under 100 m²      1.800 –  2.500 kr./år
 *    Café, 50–100 m²                3.000 –  6.000 kr./år
 *    Restaurant med musik          10.000 – 25.000 kr./år
 *    Hotel, 100+ værelser           8.000 – 20.000 kr./år
 *    Klinik, baggrundsmusik         1.500 –  3.000 kr./år
 *    Forsamlingshus / galleri       2.000 –  6.000 kr./år
 *
 *  Sources: baggrundsmusik.dk/hvor-meget-koster-koda, musiklicens.dk.
 *  Both label their figures "vejledende" (indicative).
 *
 *  TO VERIFY: pull the current tariffs from Koda ("Butik og
 *  serviceerhverv" and "Restaurant og café") and from Gramex, then set
 *  `base` and `perM2` per venue type from the real tables. The UI is
 *  already wired to show a "vejledende" disclaimer wherever a figure
 *  from this file is displayed — see components/marketing/Calculator.
 * ==================================================================== */

import type { L10n } from "./i18n";

export const RATES_VERIFIED = false;
export const RATES_UPDATED = "2026-08-31";

export type VenueTypeId =
  | "cafe"
  | "restaurant"
  | "bar"
  | "retail"
  | "salon"
  | "clinic"
  | "hotel"
  | "fitness"
  | "office";

export type VenueType = {
  id: VenueTypeId;
  label: L10n;
  /** Fixed part of the yearly Koda + Gramex bill, in DKK ex. VAT. */
  base: number;
  /** Added per m² of customer-facing floor area, DKK per year. */
  perM2: number;
  /** Sensible starting point for the slider, m². */
  defaultM2: number;
  /** Slider bounds, m². */
  minM2: number;
  maxM2: number;
  /** Short line shown under the venue card. */
  note: L10n;
};

export const VENUE_TYPES: VenueType[] = [
  {
    id: "cafe",
    label: { da: "Café / bageri", en: "Café / bakery" },
    base: 2200,
    perM2: 30,
    defaultM2: 90,
    minM2: 20,
    maxM2: 400,
    note: { da: "Baggrundsmusik i åbningstiden", en: "Background music during opening hours" },
  },
  {
    id: "restaurant",
    label: { da: "Restaurant", en: "Restaurant" },
    base: 5000,
    perM2: 36,
    defaultM2: 220,
    minM2: 40,
    maxM2: 900,
    note: { da: "Musik til gæster, frokost og aften", en: "Music for lunch and dinner service" },
  },
  {
    id: "bar",
    label: { da: "Bar / natklub", en: "Bar / nightclub" },
    base: 8000,
    perM2: 45,
    defaultM2: 180,
    minM2: 30,
    maxM2: 900,
    note: { da: "Højere lydniveau, længere åbningstid", en: "Higher volume, longer hours" },
  },
  {
    id: "retail",
    label: { da: "Butik", en: "Retail store" },
    base: 1500,
    perM2: 16,
    defaultM2: 150,
    minM2: 20,
    maxM2: 2000,
    note: { da: "Salgsareal med baggrundsmusik", en: "Sales floor with background music" },
  },
  {
    id: "salon",
    label: { da: "Frisør / salon", en: "Salon / barber" },
    base: 1200,
    perM2: 15,
    defaultM2: 70,
    minM2: 15,
    maxM2: 300,
    note: { da: "Musik i salonen hele dagen", en: "Music in the salon all day" },
  },
  {
    id: "clinic",
    label: { da: "Klinik", en: "Clinic" },
    base: 1100,
    perM2: 13,
    defaultM2: 90,
    minM2: 20,
    maxM2: 500,
    note: { da: "Venteværelse og behandling", en: "Waiting room and treatment" },
  },
  {
    id: "hotel",
    label: { da: "Hotel", en: "Hotel" },
    base: 4500,
    perM2: 19,
    defaultM2: 420,
    minM2: 80,
    maxM2: 3000,
    note: { da: "Lobby, restaurant og fællesarealer", en: "Lobby, restaurant and public areas" },
  },
  {
    id: "fitness",
    label: { da: "Fitness / studio", en: "Gym / studio" },
    base: 6000,
    perM2: 26,
    defaultM2: 500,
    minM2: 60,
    maxM2: 3000,
    note: { da: "Musik er en del af træningen", en: "Music is part of the workout" },
  },
  {
    id: "office",
    label: { da: "Kontor / showroom", en: "Office / showroom" },
    base: 900,
    perM2: 10,
    defaultM2: 200,
    minM2: 30,
    maxM2: 2000,
    note: { da: "Reception og fællesområder", en: "Reception and shared areas" },
  },
];

export function venueType(id: VenueTypeId): VenueType {
  return VENUE_TYPES.find((v) => v.id === id) ?? VENUE_TYPES[0];
}

/** Opening hours per week move the bill; Koda scales usage the same way. */
export type HoursBand = "short" | "normal" | "long";

export const HOURS_BANDS: { id: HoursBand; label: L10n; factor: number }[] = [
  { id: "short", label: { da: "Op til 40 t/uge", en: "Up to 40 h/week" }, factor: 0.85 },
  { id: "normal", label: { da: "40–70 t/uge", en: "40–70 h/week" }, factor: 1.0 },
  { id: "long", label: { da: "Over 70 t/uge", en: "Over 70 h/week" }, factor: 1.15 },
];

export function hoursFactor(band: HoursBand): number {
  return HOURS_BANDS.find((h) => h.id === band)?.factor ?? 1;
}

/**
 * Split of the combined bill between the two Danish collecting societies.
 * Koda collects for composers and publishers, Gramex for performers and
 * record labels. ASSUMPTION — replace with the real ratio once the two
 * rate cards are in hand.
 */
export const KODA_SHARE = 0.54;
export const GRAMEX_SHARE = 1 - KODA_SHARE;

/**
 * What a business typically also pays for the streaming service itself,
 * on top of the licences. Danish commercial background-music providers
 * publish monthly prices in the 119–299 kr. range; 199 is the midpoint.
 * Shown as an optional line the visitor can switch off.
 */
export const STREAMING_MONTHLY_DEFAULT = 199;

export type Breakdown = {
  kodaYear: number;
  gramexYear: number;
  streamingYear: number;
  currentYear: number;
  currentMonth: number;
  odatoneMonth: number;
  odatoneYear: number;
  savingYear: number;
  savingMonth: number;
  savingPct: number;
};

export type CalcInput = {
  type: VenueTypeId;
  m2: number;
  hours: HoursBand;
  locations: number;
  includeStreaming: boolean;
  /** Odatone price per location per month, from lib/pricing.ts. */
  odatonePerLocationMonth: number;
};

export function calculate(input: CalcInput): Breakdown {
  const v = venueType(input.type);
  const locations = Math.max(1, Math.round(input.locations));
  const perVenueLicences = (v.base + input.m2 * v.perM2) * hoursFactor(input.hours);

  const licencesYear = round10(perVenueLicences * locations);
  const kodaYear = round10(licencesYear * KODA_SHARE);
  const gramexYear = licencesYear - kodaYear;
  const streamingYear = input.includeStreaming
    ? STREAMING_MONTHLY_DEFAULT * 12 * locations
    : 0;

  const currentYear = licencesYear + streamingYear;
  const odatoneYear = Math.round(input.odatonePerLocationMonth * 12 * locations);
  const savingYear = Math.max(0, currentYear - odatoneYear);

  return {
    kodaYear,
    gramexYear,
    streamingYear,
    currentYear,
    currentMonth: Math.round(currentYear / 12),
    odatoneMonth: Math.round(odatoneYear / 12),
    odatoneYear,
    savingYear,
    savingMonth: Math.round(savingYear / 12),
    savingPct: currentYear > 0 ? Math.round((savingYear / currentYear) * 100) : 0,
  };
}

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

/** Representative examples used in the static comparison strip. */
export const HEADLINE_EXAMPLE: CalcInput = {
  type: "cafe",
  m2: 90,
  hours: "normal",
  locations: 1,
  includeStreaming: true,
  odatonePerLocationMonth: 149,
};
