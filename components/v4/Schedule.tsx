"use client";

import { useMemo } from "react";

import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";
import {
  COL_GAP, GRID_HEIGHT, GUTTER, HEAD_H, HOUR_FROM, HOUR_TO, PAD_R, ROW_H,
  WEEKDAYS, blockGeometry, blockRange, colourFor, hhmm, hourRows, invalidBlocks, isWeekend,
  type ScheduleBlock,
} from "@/lib/schedule";

export type SchedulePlaylist = { id: string; name: string };

/**
 * The week, drawn to the geometry in lib/schedule.ts — which is itself
 * read off the Figma frame rather than chosen here.
 *
 * Blocks are absolutely positioned inside their day column because a
 * block spans hours and overlaps rows, which is the one thing a grid of
 * rows cannot express. The columns themselves ARE a grid, so the whole
 * thing stays fluid below 1440 instead of pinning to the 144px the design
 * happens to produce at that width.
 */
export default function Schedule({
  locale: l,
  blocks,
  playlists,
}: {
  locale: Locale;
  blocks: ScheduleBlock[];
  playlists: SchedulePlaylist[];
}) {
  const order = useMemo(() => playlists.map((p) => p.id), [playlists]);
  const nameOf = useMemo(
    () => Object.fromEntries(playlists.map((p) => [p.id, p.name])),
    [playlists],
  );
  /* The database refuses overlaps outright, so anything here is either a
     bug or an unsaved edit. Either way it is drawn once, not twice, and
     counted so the page can say something. */
  const broken = useMemo(() => new Set(invalidBlocks(blocks).map((b) => b.id)), [blocks]);
  const drawable = blocks.filter((b) => !broken.has(b.id));

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-xl)] bg-surface"
      style={{ height: GRID_HEIGHT, paddingRight: PAD_R }}
    >
      {/* Hour rules, full width, behind everything. */}
      {hourRows().map((h) => (
        <div key={h} className="absolute left-0 right-0" style={{ top: HEAD_H + (h - HOUR_FROM) * ROW_H }}>
          <div className="h-px w-full bg-line" />
          {h < HOUR_TO && (
            <span className="u-label absolute left-4 top-[6px] text-ink-3">{hhmm(h)}</span>
          )}
        </div>
      ))}

      <div
        className="relative grid h-full"
        style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0,1fr))`, columnGap: COL_GAP }}
      >
        <div aria-hidden />
        {WEEKDAYS.map((day, d) => (
          <div key={d} className="relative">
            <p
              className={`u-label absolute inset-x-0 text-center ${isWeekend(d) ? "text-accent" : "text-ink-3"}`}
              style={{ top: 15 }}
            >
              {day[l]}
            </p>

            <div className="absolute inset-x-0" style={{ top: HEAD_H, height: (HOUR_TO - HOUR_FROM) * ROW_H }}>
              {drawable
                .filter((b) => b.weekday === d)
                .map((b) => {
                  const { top, height } = blockGeometry(b);
                  const hue = colourFor(b.playlistId, order);
                  return (
                    <div
                      key={b.id}
                      className="absolute inset-x-[2px] flex flex-col gap-[2px] overflow-hidden rounded-[14px] px-[10px] py-[7px]"
                      style={{
                        top,
                        height,
                        /* 14 % wash, 35 % border — the design's values, and
                           the reason these hues do not read as saturated. */
                        backgroundColor: `color-mix(in srgb, ${hue} 14%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hue} 35%, transparent)`,
                        color: hue,
                      }}
                      title={`${nameOf[b.playlistId] ?? "—"} ${blockRange(b)}`}
                    >
                      <span className="u-label truncate" style={{ color: hue }}>
                        {nameOf[b.playlistId] ?? "—"}
                      </span>
                      <span className="truncate text-[0.8125rem]" style={{ color: hue, opacity: 0.75 }}>
                        {blockRange(b)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {blocks.length === 0 && (
        <p className="absolute inset-x-0 text-center text-[0.875rem] text-ink-3" style={{ top: HEAD_H + 7 * ROW_H }}>
          {t.schedule.empty[l]}
        </p>
      )}
    </div>
  );
}
