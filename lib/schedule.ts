import type { L10n } from "./i18n.ts";

/* ==================================================================== *
 *  The weekly schedule grid
 *
 *  Geometry is taken from the Figma frame "Web v4 · Spilleplan (lys)"
 *  rather than chosen here, so the page can be checked against the design
 *  by reading numbers instead of squinting:
 *
 *    hour gutter   52      row height   32      header   38
 *    column gap     6      right pad    16      hours    06:00–24:00
 *    block radius  14      wash 14 %    border 35 %
 * ==================================================================== */

export const HOUR_FROM = 6;
export const HOUR_TO = 24;
export const ROW_H = 32;
export const HEAD_H = 38;
export const GUTTER = 52;
export const COL_GAP = 6;
export const PAD_R = 16;
export const CARD_PAD_B = 14;

/** 0 = Monday, as stored in schedule_blocks.weekday. */
export const WEEKDAYS: L10n[] = [
  { da: "Man", en: "Mon" },
  { da: "Tir", en: "Tue" },
  { da: "Ons", en: "Wed" },
  { da: "Tor", en: "Thu" },
  { da: "Fre", en: "Fri" },
  { da: "Lør", en: "Sat" },
  { da: "Søn", en: "Sun" },
];

/** Saturday and Sunday are picked out in the header, as in the design. */
export const isWeekend = (weekday: number) => weekday >= 5;

export const GRID_HEIGHT = HEAD_H + (HOUR_TO - HOUR_FROM) * ROW_H + CARD_PAD_B;

export type ScheduleBlock = {
  id: string;
  playlistId: string;
  weekday: number;
  fromHour: number;
  toHour: number;
};

/** Where a block sits inside its day column.
 *
 *  `top` is measured from the first hour row, not from the card, so the
 *  column can be positioned once and every block placed within it. The
 *  2px inset on each side is what makes neighbouring blocks — 09–12 then
 *  12–15, which the database allows — read as two rather than one. */
export function blockGeometry(block: { fromHour: number; toHour: number }) {
  const top = (block.fromHour - HOUR_FROM) * ROW_H + 2;
  const height = (block.toHour - block.fromHour) * ROW_H - 4;
  return { top, height };
}

/** Hours that get a rule and a label, 06 … 24. The last one rules off the
    bottom of the grid and carries no label — a "24" under the final line
    would read as a row that exists. */
export function hourRows(): number[] {
  const out: number[] = [];
  for (let h = HOUR_FROM; h <= HOUR_TO; h++) out.push(h);
  return out;
}

export const hhmm = (hour: number) => `${String(hour).padStart(2, "0")}`;

/** A block's label: "07–11". */
export const blockRange = (b: { fromHour: number; toHour: number }) =>
  `${hhmm(b.fromHour)}–${hhmm(b.toHour)}`;

/* Four hues, assigned per playlist and stable for as long as the set of
   playlists is. Stable matters more than pretty: a schedule people read
   at a glance is read by colour, and a block that changes hue between
   visits has to be read again. */
export const BLOCK_COLOURS = [
  "var(--c-brand-blue)",
  "var(--c-accent)",
  "var(--c-brand-magenta)",
  "var(--c-ink-2)",
] as const;

export function colourFor(playlistId: string, order: string[]): string {
  const i = order.indexOf(playlistId);
  return BLOCK_COLOURS[(i < 0 ? 0 : i) % BLOCK_COLOURS.length];
}

/** Blocks that cannot be drawn, so a caller can say so instead of
    rendering something impossible. The database refuses overlaps and
    reversed hours (0015_playlists_and_schedule.sql), but this code also
    serves unsaved edits, where neither has been checked yet. */
export function invalidBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  const bad: ScheduleBlock[] = [];
  for (const b of blocks) {
    if (b.fromHour >= b.toHour) { bad.push(b); continue; }
    if (b.fromHour < HOUR_FROM || b.toHour > HOUR_TO) { bad.push(b); continue; }
    if (b.weekday < 0 || b.weekday > 6) { bad.push(b); continue; }
    const clash = blocks.some(
      (o) => o !== b && o.weekday === b.weekday && o.fromHour < b.toHour && b.fromHour < o.toHour,
    );
    if (clash) bad.push(b);
  }
  return bad;
}
