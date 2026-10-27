"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";
import {
  FALLBACKS,
  type AudioSpot,
  type Fallback,
  type ScheduleBlock,
  distribution,
  hoursLabel,
  plannedMinutes,
  spotsPerWeek,
} from "@/lib/schedule";
import { CopyIcon, PinIcon } from "../Icons";
import BlockPanel from "./BlockPanel";
import Week, { type WeekList } from "./Week";

export type PlannerLocation = { id: string; name: string; fallback: Fallback };

export type Outcome = { ok: boolean; error?: string; replaced?: number; copied?: number; id?: string };

/**
 * Where an edit goes.
 *
 * Two implementations, and the grid cannot tell them apart: one posts
 * to the server actions as the signed-in customer, the other keeps the
 * week in this browser for a visitor who has no account yet. Putting
 * the seam here rather than branching inside the handlers is what keeps
 * the demo honestly identical to the real thing — there is no second
 * code path to drift.
 */
export type PlannerBackend = {
  create(input: {
    locationId: string;
    playlistId: string;
    weekday: number;
    from: number;
    to: number;
  }): Promise<Outcome>;
  move(input: { id: string; weekday: number; from: number; to: number }): Promise<Outcome>;
  setPlaylist(id: string, playlistId: string): Promise<Outcome>;
  remove(id: string): Promise<Outcome>;
  copyToDays(id: string, weekdays: number[]): Promise<Outcome>;
  setFallback(locationId: string, fallback: Fallback): Promise<Outcome>;
  copyToLocations(from: string, targets: string[]): Promise<Outcome>;
  /** Run after every settled edit. The live backend re-reads the page;
      the demo one has nothing to re-read. */
  settle(): void;
  /** The location picker. Live, this is a URL the reader can bookmark;
      in the demo there is only ever one location, so it does nothing. */
  goToLocation(id: string): void;
};

/**
 * The Ugeplan screen.
 *
 * Every edit is applied here first and sent second. The grid is a direct
 * manipulation surface — you drag a block and it is where you dropped
 * it — so waiting on a round trip before moving it would make the drag
 * feel broken even when the write succeeds. `useOptimistic` holds the
 * moved block until the server's version arrives; if the write is
 * refused the optimistic state is dropped on the next render and the
 * block snaps back, with a line saying why. A snap-back with no
 * explanation is the one outcome worth avoiding.
 */
export default function Planner({
  locale: l,
  locations,
  locationId,
  blocks: serverBlocks,
  spots = [],
  lists,
  backend,
  banner,
}: {
  locale: Locale;
  locations: PlannerLocation[];
  locationId: string;
  blocks: ScheduleBlock[];
  spots?: AudioSpot[];
  lists: WeekList[];
  backend: PlannerBackend;
  /** Shown above the grid. The demo uses it to say where the week is
      being kept; signed in there is nothing to say. */
  banner?: React.ReactNode;
}) {
  const [, startTransition] = useTransition();
  const [blocks, applyOptimistic] = useOptimistic(
    serverBlocks,
    (state: ScheduleBlock[], action: { type: "put"; block: ScheduleBlock } | { type: "drop"; id: string }) =>
      action.type === "drop"
        ? state.filter((b) => b.id !== action.id)
        : state.some((b) => b.id === action.block.id)
          ? state.map((b) => (b.id === action.block.id ? action.block : b))
          : [...state, action.block],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyDays, setCopyDays] = useState<number[]>([]);
  const [showSpots, setShowSpots] = useState(true);
  const [copyOpen, setCopyOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const here = locations.find((x) => x.id === locationId) ?? locations[0]!;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  function say(message: string) {
    setNote(message);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 3200);
  }

  /* Every action runs inside a transition, because useOptimistic refuses
     an update outside one and drops the state the moment the action
     settles — which is exactly the handover we want. */
  function run(optimistic: () => void, send: () => Promise<{ ok: boolean; error?: string } | void>) {
    startTransition(async () => {
      optimistic();
      const res = await send();
      if (res && !res.ok) {
        say(res.error === "overlap" ? t.planner.overlap[l] : t.planner.denied[l]);
      }
      backend.settle();
    });
  }

  function onCreate(weekday: number, from: number, to: number, playlistId?: string) {
    const listId = playlistId ?? selected?.playlistId ?? lists[0]?.id;
    if (!listId) {
      say(t.planner.noLists[l]);
      return;
    }
    const temp: ScheduleBlock = { id: `new-${weekday}-${from}`, playlistId: listId, weekday, from, to };
    run(
      () => {
        applyOptimistic({ type: "put", block: temp });
        setSelectedId(temp.id);
      },
      async () => {
        const res = await backend.create({ locationId, playlistId: listId, weekday, from, to });
        if (res.ok && res.id) setSelectedId(res.id);
        return res;
      },
    );
  }

  function onMoveOrResize(id: string, weekday: number, from: number, to: number) {
    const before = blocks.find((b) => b.id === id);
    if (!before) return;
    run(
      () => applyOptimistic({ type: "put", block: { ...before, weekday, from, to } }),
      () => backend.move({ id, weekday, from, to }),
    );
  }

  function onPatch(patch: Partial<ScheduleBlock>) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    if (next.to <= next.from) {
      say(t.planner.savedNothing[l]);
      return;
    }
    run(
      () => applyOptimistic({ type: "put", block: next }),
      () =>
        patch.playlistId && patch.playlistId !== selected.playlistId
          ? backend.setPlaylist(selected.id, patch.playlistId)
          : backend.move({ id: selected.id, weekday: next.weekday, from: next.from, to: next.to }),
    );
  }

  function onDelete() {
    if (!selected) return;
    const id = selected.id;
    run(
      () => {
        applyOptimistic({ type: "drop", id });
        setSelectedId(null);
      },
      () => backend.remove(id),
    );
  }

  function onCopy() {
    if (!selected || !copyDays.length) return;
    const days = [...copyDays];
    startTransition(async () => {
      const res = await backend.copyToDays(selected.id, days);
      if (!res.ok) {
        say(res.error === "overlap" ? t.planner.overlap[l] : t.planner.denied[l]);
      } else {
        const replaced = res.replaced ?? 0;
        say(
          (replaced
            ? t.planner.copiedReplaced[l].replace("{r}", String(replaced))
            : t.planner.copied[l]
          ).replace("{n}", String(days.length)),
        );
        setCopyDays([]);
      }
      backend.settle();
    });
  }

  /* Delete removes the selected block, Esc deselects — but never while
     the reader is in a field, where both keys mean what they always do. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag && ["input", "select", "textarea"].includes(tag)) return;
      if (e.key === "Escape") setSelectedId(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        onDelete();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const listsUsed = distribution(blocks).length;

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[15rem] flex-1">
          <h1 className="u-display text-[1.5rem] text-ink">{t.planner.heading[l]}</h1>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">{t.planner.lede[l]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2" title={t.planner.location[l]}>
            <span className="sr-only">{t.planner.location[l]}</span>
            <PinIcon size={16} className="text-ink-3" />
            <select
              value={locationId}
              onChange={(e) => backend.goToLocation(e.target.value)}
              className="oda-select h-10 text-[0.875rem]"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            disabled={locations.length < 2}
            className="oda-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
            title={locations.length < 2 ? t.planner.copyLocOnly[l] : undefined}
          >
            <CopyIcon size={16} />
            {t.planner.copyToLocations[l]}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Stat text={t.planner.statMusic[l]} value={hoursLabel(plannedMinutes(blocks), l)} token="{hours}" />
        <span className="hidden sm:contents">
          <Stat
            text={t.planner.statSpots[l]}
            value={String(spots.filter((sp) => sp.active).length)}
            token="{n}"
          />
        </span>
        <span className="hidden lg:contents">
          <Stat text={t.planner.statPerWeek[l]} value={String(spotsPerWeek(spots))} token="{n}" />
        </span>
        <div className="ml-auto flex items-center gap-4 text-[0.8125rem] text-ink-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            {t.planner.showSpots[l]}
            <span className="oda-switch">
              <input
                type="checkbox"
                checked={showSpots}
                onChange={(e) => setShowSpots(e.target.checked)}
              />
              <span />
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            {t.planner.offPlan[l]}
            <select
              value={here.fallback}
              onChange={(e) => {
                const value = e.target.value as Fallback;
                startTransition(async () => {
                  const res = await backend.setFallback(locationId, value);
                  if (!res.ok) say(t.planner.denied[l]);
                  backend.settle();
                });
              }}
              className="oda-select text-[0.8125rem]"
            >
              {FALLBACKS.map((f) => (
                <option key={f} value={f}>
                  {t.planner.fallback[f][l]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {banner}

      <div className="flex min-h-0 gap-3.5">
        <Week
          locale={l}
          blocks={blocks}
          lists={lists}
          spots={spots}
          showSpots={showSpots}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={onCreate}
          onMoveOrResize={onMoveOrResize}
          onRefuse={() => say(t.planner.overlap[l])}
        />
        <aside className="hidden w-[330px] shrink-0 flex-col rounded-[var(--radius-xl)] border border-line bg-surface xl:flex">
          <BlockPanel
            locale={l}
            block={selected}
            blocks={blocks}
            lists={lists}
            copyDays={copyDays}
            onToggleCopyDay={(d) =>
              setCopyDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
            }
            onCopy={onCopy}
            onPatch={onPatch}
            onDelete={onDelete}
          />
        </aside>
      </div>

      {copyOpen && (
        <CopyLocations
          locale={l}
          from={here}
          locations={locations.filter((x) => x.id !== locationId)}
          onClose={() => setCopyOpen(false)}
          onCopy={(ids) => {
            setCopyOpen(false);
            startTransition(async () => {
              const res = await backend.copyToLocations(locationId, ids);
              if (!res.ok) say(t.planner.denied[l]);
              else say(t.planner.copiedLocations[l].replace("{n}", String(res.copied ?? ids.length)));
              backend.settle();
            });
          }}
        />
      )}

      {note && (
        <p
          role="status"
          className="fixed bottom-[calc(var(--dock-h)+18px)] left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-[0.8125rem] font-semibold text-bg shadow-lg"
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** A stat chip, with the figure picked out of its own sentence. The
    copy keeps the whole sentence so a translator can move the number;
    this splits on the token rather than assuming it comes first. */
function Stat({ text, value, token }: { text: string; value: string; token: string }) {
  const [before, after = ""] = text.split(token);
  return (
    <span className="whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-[0.8125rem] text-ink-2">
      {before}
      <b className="u-tabular font-bold text-ink">{value}</b>
      {after}
    </span>
  );
}

function CopyLocations({
  locale: l,
  from,
  locations,
  onClose,
  onCopy,
}: {
  locale: Locale;
  from: PlannerLocation;
  locations: PlannerLocation[];
  onClose: () => void;
  onCopy: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(locations.map((x) => x.id));

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-5 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-[min(520px,100%)] flex-col gap-5 rounded-[24px] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="u-title text-[1.1875rem] text-ink">{t.planner.copyLocHeading[l]}</h2>
        <p className="text-[0.875rem] text-ink-2">
          {t.planner.copyLocLede[l].replace("{name}", from.name)}
        </p>
        <ul className="flex flex-col gap-1.5">
          {locations.map((loc) => (
            <li key={loc.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-[0.9375rem] font-medium hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={picked.includes(loc.id)}
                  onChange={(e) =>
                    setPicked((prev) =>
                      e.target.checked ? [...prev, loc.id] : prev.filter((x) => x !== loc.id),
                    )
                  }
                  className="h-4 w-4 accent-[var(--c-accent)]"
                />
                <PinIcon size={16} className="text-ink-3" />
                {loc.name}
              </label>
            </li>
          ))}
        </ul>
        <p className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-[0.78rem] leading-relaxed text-ink-2">
          {t.planner.copyLocWarning[l]}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="oda-btn-ghost">
            {t.planner.cancel[l]}
          </button>
          <button
            type="button"
            disabled={!picked.length}
            onClick={() => onCopy(picked)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[0.84rem] font-semibold text-accent-ink disabled:opacity-40"
          >
            <CopyIcon size={16} />
            {t.planner.copyToLocations[l]}
          </button>
        </div>
      </div>
    </div>
  );
}
