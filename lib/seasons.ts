import type { L10n } from "./i18n.ts";
import { BPM_MAX, BPM_MIN, DEFAULT_FILTERS, type Filters, type Genre } from "./tracks.ts";

/* ==================================================================== *
 *  Seasons
 *
 *  A season is a date range plus a way of playing. It is not a stored
 *  playlist: like the curated lists, it is a RULE, so a bigger catalogue
 *  fills it out without anyone re-picking tracks.
 *
 *  These ranges are Odatone's own. 1000TRAX already carries `seasonStart`
 *  and `seasonEnd` on every genre — null on all of them today — so if they
 *  ever populate those, the ranges here should give way to theirs rather
 *  than compete with them. See docs/1000trax-api-requirements.md §3.6.
 * ==================================================================== */

export type SeasonId = "efteraar" | "jul" | "nytaar" | "vinter" | "foraar" | "sommer";

/** Month (1–12) and day, inclusive at both ends. */
type MonthDay = { month: number; day: number };

export type Season = {
  id: SeasonId;
  label: L10n;
  /** One line on how the room should feel. Shown on the card. */
  character: L10n;
  from: MonthDay;
  to: MonthDay;
  /** How the season actually plays, in the player's own filter language —
      so choosing a season and building a list by hand go through exactly
      the same machinery. */
  rule: { genres: Genre[]; bpm: [number, number]; vox: boolean | null };
};

export const SEASONS: Season[] = [
  {
    id: "efteraar",
    label: { da: "Efterår", en: "Autumn" },
    character: { da: "Kaffe, gule blade, tungere toner", en: "Coffee, yellow leaves, heavier tones" },
    from: { month: 9, day: 1 },
    to: { month: 11, day: 30 },
    rule: { genres: ["jazz", "acoustic", "ambient"], bpm: [BPM_MIN, 100], vox: null },
  },
  {
    id: "jul",
    label: { da: "Jul", en: "Christmas" },
    character: { da: "Varmt, klokker, ikke for sødt", en: "Warm, bells, not too sweet" },
    from: { month: 12, day: 1 },
    to: { month: 12, day: 26 },
    rule: { genres: ["acoustic", "classical"], bpm: [BPM_MIN, 95], vox: null },
  },
  {
    /* The only season that crosses the new year, which is the whole reason
       `contains` below cannot just compare two numbers. */
    id: "nytaar",
    label: { da: "Nytår", en: "New Year" },
    character: { da: "Højere tempo, mere vokal", en: "Faster, more vocal" },
    from: { month: 12, day: 27 },
    to: { month: 1, day: 1 },
    rule: { genres: ["pop", "rnb"], bpm: [105, BPM_MAX], vox: true },
  },
  {
    id: "vinter",
    label: { da: "Vinter", en: "Winter" },
    character: { da: "Stille, langsomt, lyst", en: "Quiet, slow, bright" },
    from: { month: 1, day: 2 },
    to: { month: 2, day: 28 },
    rule: { genres: ["ambient", "classical"], bpm: [BPM_MIN, 90], vox: false },
  },
  {
    id: "foraar",
    label: { da: "Forår", en: "Spring" },
    character: { da: "Lettere, mere akustisk", en: "Lighter, more acoustic" },
    from: { month: 3, day: 1 },
    to: { month: 5, day: 31 },
    rule: { genres: ["acoustic", "pop"], bpm: [85, 115], vox: null },
  },
  {
    id: "sommer",
    label: { da: "Sommer", en: "Summer" },
    character: { da: "Bossa, åbne døre, lange dage", en: "Bossa, open doors, long days" },
    from: { month: 6, day: 1 },
    to: { month: 8, day: 31 },
    rule: { genres: ["acoustic", "jazz", "pop"], bpm: [90, 120], vox: null },
  },
];

const ord = (m: number, d: number) => m * 100 + d;

/** Is this date inside the season?
 *
 *  Ranges are compared as month×100+day rather than as real dates so a
 *  season has no year and repeats. The wrap case is Nytår: 27 December to
 *  1 January, where `from` sorts AFTER `to`, and a naive `from <= x && x <=
 *  to` is false for every day of the year. */
export function contains(season: Season, date: Date): boolean {
  const x = ord(date.getMonth() + 1, date.getDate());
  const a = ord(season.from.month, season.from.day);
  const b = ord(season.to.month, season.to.day);
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}

/** The season this date falls in.
 *
 *  Returns null rather than guessing when nothing matches: 29 February
 *  exists and Vinter ends on the 28th, so there is at least one real day a
 *  year with no season, and inventing one would be worse than the page
 *  simply not highlighting anything. */
export function currentSeason(date: Date = new Date()): Season | null {
  return SEASONS.find((s) => contains(s, date)) ?? null;
}

export function seasonById(id: string): Season | undefined {
  return SEASONS.find((s) => s.id === id);
}

/** A season as player filters. Mood is deliberately cleared: a season is a
    way of playing the whole room, and leaving a mood set would silently
    intersect the two and hand back a much smaller queue than the card
    promised. */
export function seasonFilters(season: Season): Filters {
  return {
    ...DEFAULT_FILTERS,
    genres: season.rule.genres,
    bpm: season.rule.bpm,
    vox: season.rule.vox,
    mood: null,
  };
}
