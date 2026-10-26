import type { L10n } from "./i18n.ts";

/* ==================================================================== *
 *  The weekly schedule grid
 *
 *  Geometry from the Ugeplan prototype: an hour is 38px, the week runs
 *  06:00–24:00, the hour gutter is 58px and everything snaps to the
 *  quarter. The grid draws hour rules with a lighter half-hour rule
 *  between them, which is what makes a 07:30 start readable at 38px.
 *
 *  Minutes since midnight throughout, matching schedule_blocks.from_min
 *  (0016_schedule_per_location.sql). Not a time of day: a schedule has
 *  no date, so there is no daylight-saving question to get wrong.
 * ==================================================================== */

export const START = 6 * 60;
export const END = 24 * 60;
export const ROW_H = 38;
export const SNAP = 15;
export const GUTTER = 58;
export const GRID_HEIGHT = ((END - START) / 60) * ROW_H;

/** 0 = Monday, as stored in schedule_blocks.weekday. */
export const WEEKDAYS: L10n[] = [
  { da: "Mandag", en: "Monday" },
  { da: "Tirsdag", en: "Tuesday" },
  { da: "Onsdag", en: "Wednesday" },
  { da: "Torsdag", en: "Thursday" },
  { da: "Fredag", en: "Friday" },
  { da: "Lørdag", en: "Saturday" },
  { da: "Søndag", en: "Sunday" },
];

export const WEEKDAYS_SHORT: L10n[] = [
  { da: "Man", en: "Mon" },
  { da: "Tir", en: "Tue" },
  { da: "Ons", en: "Wed" },
  { da: "Tor", en: "Thu" },
  { da: "Fre", en: "Fri" },
  { da: "Lør", en: "Sat" },
  { da: "Søn", en: "Sun" },
];

/** One letter per day, for the copy-to-day and the spot day pickers. */
export const WEEKDAYS_INITIAL: L10n[] = [
  { da: "M", en: "M" },
  { da: "T", en: "T" },
  { da: "O", en: "W" },
  { da: "T", en: "T" },
  { da: "F", en: "F" },
  { da: "L", en: "S" },
  { da: "S", en: "S" },
];

export type ScheduleBlock = {
  id: string;
  playlistId: string;
  weekday: number;
  /** Minutes since midnight. */
  from: number;
  to: number;
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const snapTo = (min: number) => Math.round(min / SNAP) * SNAP;

/** "07:30". */
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "07" on the hour, "07:30" otherwise — the grid is read by the hour,
    so printing ":00" on every label is noise that hides the ones that
    are not on the hour. */
export const hhmmShort = (min: number) =>
  min % 60 ? hhmm(min) : String(Math.floor(min / 60)).padStart(2, "0");

export const rangeLabel = (from: number, to: number) => `${hhmmShort(from)}–${hhmmShort(to)}`;

/** Hours that get a rule and a label, 06 … 23. 24 rules off the bottom
    of the grid; a "24" under the final line would read as a row. */
export function hourRows(): number[] {
  const out: number[] = [];
  for (let h = START / 60; h < END / 60; h++) out.push(h);
  return out;
}

/** Quarter-hour options for the from/to selects. */
export function quarterHours(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m += SNAP) out.push(m);
  return out;
}

/** Where a block sits in its column, in px from the first hour row. */
export function blockGeometry(b: { from: number; to: number }) {
  return { top: ((b.from - START) / 60) * ROW_H, height: ((b.to - b.from) / 60) * ROW_H };
}

/** Minutes of music planned, across the whole week. */
export const plannedMinutes = (blocks: ScheduleBlock[]) =>
  blocks.reduce((sum, b) => sum + (b.to - b.from), 0);

/** "12,5 t" — hours to one decimal, in the reader's own language. */
export const hoursLabel = (minutes: number, locale: "da" | "en") =>
  `${(minutes / 60).toLocaleString(locale === "da" ? "da-DK" : "en-GB", { maximumFractionDigits: 1 })} t`;

/** Does this block overlap one already on the day? `ignore` is the block
    being dragged, which always overlaps its own old position. */
export function overlaps(
  blocks: ScheduleBlock[],
  candidate: { weekday: number; from: number; to: number },
  ignore?: string,
): boolean {
  return blocks.some(
    (b) =>
      b.id !== ignore &&
      b.weekday === candidate.weekday &&
      b.from < candidate.to &&
      candidate.from < b.to,
  );
}

/** The largest block that fits at `from` on this day, or null if nothing
    does. Used when creating and when dropping a list in: the design lets
    you aim roughly and lands on something sensible, rather than refusing
    because the default two hours happened to reach into the next block. */
export function fit(
  blocks: ScheduleBlock[],
  weekday: number,
  from: number,
  wanted: number,
): { from: number; to: number } | null {
  const start = clamp(snapTo(from), START, END - SNAP);
  if (blocks.some((b) => b.weekday === weekday && b.from <= start && b.to > start)) return null;
  const next = blocks
    .filter((b) => b.weekday === weekday && b.from > start)
    .reduce<number>((lo, b) => Math.min(lo, b.from), END);
  const to = Math.min(start + wanted, next);
  return to - start < SNAP ? null : { from: start, to };
}

/** The block playing at this moment, if any. */
export function blockAt(blocks: ScheduleBlock[], weekday: number, minute: number) {
  return blocks.find((b) => b.weekday === weekday && b.from <= minute && b.to > minute) ?? null;
}

/** Minutes per playlist, biggest first — the panel's week distribution. */
export function distribution(blocks: ScheduleBlock[]): { playlistId: string; minutes: number }[] {
  const tally = new Map<string, number>();
  for (const b of blocks) tally.set(b.playlistId, (tally.get(b.playlistId) ?? 0) + (b.to - b.from));
  return [...tally]
    .map(([playlistId, minutes]) => ({ playlistId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Blocks that cannot be drawn, so a caller can say so instead of
    rendering something impossible. The database refuses overlaps and
    reversed hours (0016), but this code also serves unsaved edits, where
    neither has been checked yet. */
export function invalidBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return blocks.filter(
    (b) =>
      b.from >= b.to ||
      b.from < 0 ||
      b.to > END ||
      b.weekday < 0 ||
      b.weekday > 6 ||
      b.from % SNAP !== 0 ||
      b.to % SNAP !== 0 ||
      overlaps(blocks, b, b.id),
  );
}

/* -------------------------------------------------------------- spots */

export type SpotMode = "interval" | "fixed";

export type AudioSpot = {
  id: string;
  name: string;
  fileName: string;
  path: string | null;
  seconds: number;
  mode: SpotMode;
  /** Interval mode: every N minutes between `from` and `to`. */
  everyMin: number;
  from: number;
  to: number;
  /** Fixed mode: this minute of the day. */
  at: number;
  weekdays: number[];
  /** Duck the music under the spot, rather than waiting for a gap. */
  duck: boolean;
  duckLevel: number;
  volume: number;
  active: boolean;
};

/** Every minute of the day this spot plays. */
export function spotTimes(spot: Pick<AudioSpot, "mode" | "at" | "from" | "to" | "everyMin">): number[] {
  if (spot.mode === "fixed") return [spot.at];
  const out: number[] = [];
  for (let m = spot.from; m < spot.to; m += spot.everyMin) out.push(m);
  return out;
}

/** How many times a week the spot plays — the figure the stats row
    quotes, and the one that tells a shopkeeper they have set it to run
    every five minutes by accident. */
export const spotsPerWeek = (spots: AudioSpot[]) =>
  spots
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.weekdays.length * spotTimes(s).length, 0);

/** "Hverdage", "Weekend", "Man–Tor", "Man, Ons, Fre". Written out rather
    than listing seven letters, because the summary line is read at a
    glance and "Alle dage" is the answer most of them want. */
export function weekdaysLabel(days: number[], locale: "da" | "en"): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 0) return locale === "da" ? "Ingen dage" : "No days";
  if (d.length === 7) return locale === "da" ? "Alle dage" : "Every day";
  if (d.join() === "0,1,2,3,4") return locale === "da" ? "Hverdage" : "Weekdays";
  if (d.join() === "5,6") return locale === "da" ? "Weekend" : "Weekend";
  const contiguous = d.every((v, i) => i === 0 || v === d[i - 1]! + 1);
  if (contiguous && d.length > 2) {
    return `${WEEKDAYS_SHORT[d[0]!]![locale]}–${WEEKDAYS_SHORT[d[d.length - 1]!]![locale]}`;
  }
  return d.map((i) => WEEKDAYS_SHORT[i]![locale]).join(", ");
}

/** "0:18". Seconds, because a spot is seconds long and "0,3 min" is not
    how anyone describes a jingle. */
export const secondsLabel = (s: number) =>
  s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "–";

export const FALLBACKS = ["silence", "calm", "continue"] as const;
export type Fallback = (typeof FALLBACKS)[number];
export const isFallback = (v: string): v is Fallback => (FALLBACKS as readonly string[]).includes(v);
