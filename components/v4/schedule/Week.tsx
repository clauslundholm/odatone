"use client";

import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/lib/i18n";
import { listLook, lookVars } from "@/lib/v4/list-look";
import {
  END,
  GRID_HEIGHT,
  GUTTER,
  ROW_H,
  SNAP,
  START,
  WEEKDAYS_SHORT,
  type AudioSpot,
  type ScheduleBlock,
  blockGeometry,
  clamp,
  fit,
  hhmm,
  hourRows,
  overlaps,
  rangeLabel,
  snapTo,
  spotMarks,
  type SpotMark as Mark,
} from "@/lib/schedule";
import { MegaphoneIcon } from "../Icons";

export type WeekList = { id: string; name: string; basedOn: string | null };

type Drag =
  | { kind: "create"; weekday: number; anchor: number; from: number; to: number; moved: boolean }
  | { kind: "move"; id: string; grab: number; before: ScheduleBlock; clash: boolean; moved: boolean }
  | { kind: "resize"; id: string; before: ScheduleBlock; clash: boolean; moved: boolean };

/**
 * The week.
 *
 * Blocks are absolutely positioned inside their day column because a
 * block spans hours and overlaps rows, which is the one thing a grid of
 * rows cannot express. The columns themselves ARE a grid, so the whole
 * thing stays fluid instead of pinning to the width the design happens
 * to produce at 1440.
 *
 * All three gestures are one pointer handler rather than three, because
 * they are one gesture to the person doing them: press, move, release.
 * Splitting them meant deciding on pointerdown whether a press on a
 * block was a click or a drag, and getting it wrong either swallowed
 * selections or started drags nobody asked for. Here a press selects on
 * release and only becomes a drag after 4px — the same threshold the
 * platform uses.
 */
export default function Week({
  locale: l,
  blocks,
  lists,
  spots,
  showSpots,
  selectedId,
  onSelect,
  onCreate,
  onMoveOrResize,
  onRefuse,
}: {
  locale: Locale;
  blocks: ScheduleBlock[];
  lists: WeekList[];
  spots: AudioSpot[];
  showSpots: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (weekday: number, from: number, to: number, playlistId?: string) => void;
  onMoveOrResize: (id: string, weekday: number, from: number, to: number) => void;
  /** A gesture the grid refused on its own, before any write. Said out
      loud by the caller: a block that snaps back with no explanation
      reads as a bug in the dragging rather than as a full hour. */
  onRefuse: () => void;
}) {
  const colsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<ScheduleBlock | null>(null);
  const [drop, setDrop] = useState<{ weekday: number; from: number; to: number } | null>(null);
  /* Computed after mount, never during render: the server has no idea
     what time it is where the reader is, and a "now" line rendered on
     both sides is a hydration mismatch waiting for midnight. */
  const [now, setNow] = useState<{ weekday: number; minute: number } | null>(null);
  const [dates, setDates] = useState<string[]>(() => Array(7).fill(""));

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow({ weekday: (d.getDay() + 6) % 7, minute: d.getHours() * 60 + d.getMinutes() });
      const monday = d.getDate() - ((d.getDay() + 6) % 7);
      setDates(
        Array.from({ length: 7 }, (_, i) =>
          String(new Date(d.getFullYear(), d.getMonth(), monday + i).getDate()),
        ),
      );
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  /* Open on the morning. The week runs from 06:00 and almost nothing is
     scheduled there, so landing at the top shows an empty grid. */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = ((7 * 60 - START) / 60) * ROW_H;
  }, []);

  const byId = new Map(lists.map((x) => [x.id, x]));
  const shown = ghost ? blocks.map((b) => (b.id === ghost.id ? ghost : b)) : blocks;

  function pointAt(e: { clientX: number; clientY: number }) {
    const r = colsRef.current!.getBoundingClientRect();
    return {
      weekday: clamp(Math.floor(((e.clientX - r.left) / r.width) * 7), 0, 6),
      minute: ((e.clientY - r.top) / ROW_H) * 60 + START,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>("[data-block]");
    const at = pointAt(e);

    if (card) {
      const b = blocks.find((x) => x.id === card.dataset.block);
      if (!b) return;
      setDrag(
        target.closest("[data-handle]")
          ? { kind: "resize", id: b.id, before: b, clash: false, moved: false }
          : { kind: "move", id: b.id, grab: at.minute - b.from, before: b, clash: false, moved: false },
      );
      setGhost(b);
    } else {
      const from = clamp(Math.floor(at.minute / SNAP) * SNAP, START, END - SNAP);
      setDrag({ kind: "create", weekday: at.weekday, anchor: from, from, to: from + SNAP, moved: false });
    }
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const at = pointAt(e);

    /* Nudge the scroller when the pointer reaches its edge, so a block
       can be dragged from the morning into the evening without letting
       go — the grid is three screens tall at 38px an hour. */
    const sc = scrollRef.current;
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (e.clientY > r.bottom - 36) sc.scrollTop += 14;
      else if (e.clientY < r.top + 36) sc.scrollTop -= 14;
    }

    if (drag.kind === "create") {
      const m = clamp(snapTo(at.minute), START, END);
      const next =
        m >= drag.anchor + SNAP
          ? { from: drag.anchor, to: m }
          : { from: Math.min(m, drag.anchor), to: drag.anchor + SNAP };
      setDrag({ ...drag, ...next, moved: true });
      return;
    }

    const before = drag.before;
    if (drag.kind === "move") {
      const span = before.to - before.from;
      const from = clamp(snapTo(at.minute - drag.grab), START, END - span);
      const next = { ...before, weekday: at.weekday, from, to: from + span };
      setGhost(next);
      setDrag({ ...drag, clash: overlaps(blocks, next, before.id), moved: true });
    } else {
      const to = clamp(snapTo(at.minute), before.from + SNAP, END);
      const next = { ...before, to };
      setGhost(next);
      setDrag({ ...drag, clash: overlaps(blocks, next, before.id), moved: true });
    }
  }

  function onPointerUp() {
    const d = drag;
    setDrag(null);
    setGhost(null);
    if (!d) return;

    if (d.kind === "create") {
      /* A press with no drag means "a block here", and two hours is what
         the design opens with. fit() shortens it to whatever is free
         rather than refusing because the default reached too far. */
      const span = d.moved ? d.to - d.from : 120;
      const room = fit(blocks, d.weekday, d.from, span);
      if (room) onCreate(d.weekday, room.from, room.to);
      else onRefuse();
      return;
    }

    const g = ghost;
    if (!d.moved || !g) {
      onSelect(d.id);
      return;
    }
    if (d.clash) {
      onSelect(d.id);
      onRefuse();
      return;
    }
    onSelect(d.id);
    if (g.weekday !== d.before.weekday || g.from !== d.before.from || g.to !== d.before.to) {
      onMoveOrResize(d.id, g.weekday, g.from, g.to);
    }
  }

  /* --------------------------------------------- dropping from the rail */
  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const at = pointAt(e);
    const room = fit(blocks, at.weekday, at.minute - 30, 120);
    setDrop(room ? { weekday: at.weekday, ...room } : null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const d = drop;
    setDrop(null);
    if (!id) return;
    if (d) onCreate(d.weekday, d.from, d.to, id);
    else onRefuse();
  }

  const draft =
    drag?.kind === "create" && drag.moved
      ? { weekday: drag.weekday, from: drag.from, to: drag.to }
      : drop;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface">
      <div
        className="grid flex-none border-b border-line"
        style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0,1fr))` }}
      >
        <div />
        {WEEKDAYS_SHORT.map((day, d) => (
          <div
            key={d}
            className={`flex items-center justify-center gap-[7px] border-l border-line py-[9px] text-[0.78rem] font-semibold ${
              now?.weekday === d ? "text-accent" : "text-ink-2"
            }`}
          >
            <span>{day[l]}</span>
            <b
              className={
                now?.weekday === d
                  ? "grid h-[30px] min-w-[30px] place-items-center rounded-full bg-accent text-[0.875rem] text-accent-ink"
                  : "text-[1.0625rem] text-ink"
              }
            >
              {dates[d]}
            </b>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="oda-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid" style={{ gridTemplateColumns: `${GUTTER}px 1fr` }}>
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hourRows().map((h) => (
              <span
                key={h}
                className="u-tabular absolute right-[10px] -translate-y-1/2 text-[0.6875rem] text-ink-3"
                style={{ top: ((h * 60 - START) / 60) * ROW_H }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          <div
            ref={colsRef}
            className="relative grid touch-none select-none"
            style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))", height: GRID_HEIGHT }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDragOver={onDragOver}
            onDragLeave={() => setDrop(null)}
            onDrop={onDrop}
          >
            {WEEKDAYS_SHORT.map((_, d) => (
              <div
                key={d}
                className={`oda-hours relative cursor-crosshair border-l border-line ${
                  now?.weekday === d ? "bg-accent-soft/25" : ""
                } ${draft?.weekday === d ? "bg-accent-soft" : ""}`}
              >
                {shown
                  .filter((b) => b.weekday === d)
                  .map((b) => {
                    const { top, height } = blockGeometry(b);
                    const look = listLook(byId.get(b.playlistId) ?? { id: b.playlistId });
                    const dragging = drag && "id" in drag && drag.id === b.id && drag.moved;
                    const bad = dragging && drag.clash;
                    const short = height < 36;
                    return (
                      <div
                        key={b.id}
                        data-block={b.id}
                        title={`${byId.get(b.playlistId)?.name ?? "—"} · ${hhmm(b.from)}–${hhmm(b.to)}`}
                        className={`oda-blk absolute left-[3px] right-[11px] cursor-grab overflow-hidden rounded-[10px] py-[6px] pl-[11px] pr-[9px] text-left transition-shadow ${
                          short ? "flex items-center gap-[6px] pb-0 pt-[2px]" : ""
                        } ${dragging ? "z-[6] cursor-grabbing opacity-95 shadow-[0_14px_30px_rgba(0,0,0,.35)]" : "z-[2]"} ${
                          selectedId === b.id ? "z-[3]" : ""
                        }`}
                        style={{
                          top: top + 2,
                          height: height - 4,
                          ...lookVars(look),
                          boxShadow: bad
                            ? "0 0 0 2px var(--c-bad)"
                            : selectedId === b.id
                              ? "0 0 0 2px var(--c1), 0 8px 20px rgba(0,0,0,.28)"
                              : undefined,
                        }}
                      >
                        <span aria-hidden="true" className="oda-blk__bar absolute inset-y-0 left-0 w-[3px]" />
                        {!short && (
                          <span
                            aria-hidden="true"
                            className="oda-blk__photo pointer-events-none absolute inset-0"
                          />
                        )}
                        <span className="relative block truncate text-[0.78rem] font-semibold">
                          {byId.get(b.playlistId)?.name ?? "—"}
                        </span>
                        <span
                          className={`oda-blk__sub u-tabular relative block truncate text-[0.6875rem] ${short ? "" : "mt-px"}`}
                        >
                          {rangeLabel(b.from, b.to)}
                        </span>
                        <span
                          data-handle
                          className="absolute inset-x-0 bottom-0 z-[2] h-[9px] cursor-ns-resize"
                        />
                      </div>
                    );
                  })}

                {showSpots &&
                  spots
                    .filter((sp) => sp.active && sp.weekdays.includes(d))
                    .flatMap((sp) => spotMarks(sp))
                    .filter((mark) => mark.minute >= START && mark.minute <= END)
                    .map((mark) => (
                      <SpotMark key={`${mark.spotId}-${mark.kind}-${mark.minute}`} mark={mark} />
                    ))}

                {draft?.weekday === d && (
                  <div
                    className="pointer-events-none absolute left-[3px] right-[10px] z-[5] overflow-hidden whitespace-nowrap rounded-[10px] border-2 border-dashed border-accent bg-accent-soft px-2 py-1 text-[0.72rem] font-semibold text-accent"
                    style={{
                      top: ((draft.from - START) / 60) * ROW_H + 1,
                      height: ((draft.to - draft.from) / 60) * ROW_H - 2,
                    }}
                  >
                    {hhmm(draft.from)}–{hhmm(draft.to)}
                  </div>
                )}

                {now?.weekday === d && now.minute >= START && now.minute < END && (
                  <div
                    className="pointer-events-none absolute -left-px right-0 z-[7] border-t-2 border-[#ef4444]"
                    style={{ top: ((now.minute - START) / 60) * ROW_H }}
                  >
                    <span className="absolute -left-[5px] -top-[6px] h-[10px] w-[10px] rounded-full bg-[#ef4444]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One amber mark on the week.
 *
 * A dot for each time an interval spot comes round — there can be
 * sixteen of them in a day, so they are the quietest thing the grid
 * draws. A pill for the two times worth reading: when the spot starts
 * running and when it stops, or, for one at a fixed time, the single
 * moment it plays. The pill carries the clock time rather than the
 * spot's name, because what a schedule is asked at a glance is "when",
 * and three names stacked at 11:45 would answer nothing.
 */
function SpotMark({ mark }: { mark: Mark }) {
  const top = ((mark.minute - START) / 60) * ROW_H;

  if (mark.kind === "tick") {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[4px] z-[4] h-[5px] w-[5px] -translate-y-1/2 rounded-full"
        style={{ top, background: "var(--c-spot)", opacity: 0.6 }}
      />
    );
  }

  return (
    <span
      className="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed"
      /* Softer than the pill on purpose. The rule crosses whatever
         block is playing at that minute, and at full strength it reads
         as a line struck through the block's own times. */
      style={{ top, borderColor: "color-mix(in srgb, var(--c-spot) 48%, transparent)" }}
      title={mark.label}
    >
      <span
        className="u-tabular absolute right-[3px] top-[-9px] inline-flex items-center gap-1 rounded-full px-[6px] py-px text-[0.59rem] font-bold"
        style={{ background: "var(--c-spot)", color: "var(--c-spot-ink)" }}
      >
        <MegaphoneIcon size={9} />
        {hhmm(mark.minute)}
      </span>
    </span>
  );
}
