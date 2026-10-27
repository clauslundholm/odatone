"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { v4 as t } from "@/lib/content/v4";
import { href, type Locale } from "@/lib/i18n";
import {
  DEMO_FALLBACK,
  DEMO_LISTS,
  DEMO_LOCATION_ID,
  DEMO_LOCATION_NAME,
  clearDemoWeek,
  loadDemoWeek,
  saveDemoWeek,
  starterSpots,
  starterWeek,
} from "@/lib/v4/demo-week";
import { overlaps, type AudioSpot, type Fallback, type ScheduleBlock } from "@/lib/schedule";
import Planner, { type PlannerBackend } from "./Planner";

/**
 * The week before there is an account.
 *
 * Identical to the signed-in one in every gesture — the grid is handed
 * the same `PlannerBackend` interface and cannot tell which it has —
 * and different in exactly one way: nothing leaves the browser. The
 * banner says so, because a plan someone spent ten minutes on and then
 * lost to a new laptop would be worse than the login wall this
 * replaces.
 *
 * The overlap rule is re-checked here rather than left to the grid.
 * Signed in it is the database that refuses two playlists at once, and
 * that refusal is what the copy promises; a demo that quietly allowed
 * it would teach the wrong thing about the product.
 */
export default function DemoPlanner({ locale: l }: { locale: Locale }) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(starterWeek);
  const [spots, setSpots] = useState<AudioSpot[]>(starterSpots);
  const [fallback, setFallbackState] = useState<Fallback>(DEMO_FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const nextId = useRef(0);

  /* Read after mount, never during render: localStorage does not exist
     on the server, so a week read while rendering would hydrate against
     markup built from the starter one. */
  useEffect(() => {
    const saved = loadDemoWeek();
    if (saved) {
      setBlocks(saved.blocks);
      setSpots(saved.spots);
      setFallbackState(saved.fallback);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveDemoWeek({ blocks, spots, fallback });
  }, [loaded, blocks, spots, fallback]);

  const lists = useMemo(
    () => DEMO_LISTS.map((x) => ({ id: x.id, name: x.name[l], basedOn: x.basedOn })),
    [l],
  );

  const ok = useCallback(async () => ({ ok: true }), []);

  const backend = useMemo<PlannerBackend>(() => {
    const refuse = async () => ({ ok: false, error: "overlap" });
    return {
      async create({ playlistId, weekday, from, to }) {
        if (overlaps(blocks, { weekday, from, to })) return refuse();
        const id = `demo-new-${nextId.current++}`;
        setBlocks((prev) => [...prev, { id, playlistId, weekday, from, to }]);
        return { ok: true, id };
      },
      async move({ id, weekday, from, to }) {
        if (overlaps(blocks, { weekday, from, to }, id)) return refuse();
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, weekday, from, to } : b)));
        return { ok: true };
      },
      async setPlaylist(id, playlistId) {
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, playlistId } : b)));
        return { ok: true };
      },
      async remove(id) {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        return { ok: true };
      },
      async copyToDays(id, weekdays) {
        const src = blocks.find((b) => b.id === id);
        if (!src) return { ok: false, error: "denied" };
        const days = weekdays.filter((d) => d !== src.weekday);
        if (!days.length) return { ok: true, replaced: 0 };
        /* Replace what it lands on, which is what the signed-in copy
           does and what "copy Monday to the rest of the week" means. */
        let replaced = 0;
        setBlocks((prev) => {
          const kept = prev.filter((b) => {
            const clash = days.includes(b.weekday) && b.from < src.to && src.from < b.to;
            if (clash) replaced++;
            return !clash;
          });
          return [
            ...kept,
            ...days.map((weekday) => ({
              ...src,
              id: `demo-new-${nextId.current++}`,
              weekday,
            })),
          ];
        });
        return { ok: true, replaced };
      },
      async setFallback(_locationId, next) {
        setFallbackState(next);
        return { ok: true };
      },
      copyToLocations: ok,
      settle: () => {},
      goToLocation: () => {},
    };
  }, [blocks, ok]);

  return (
    <Planner
      locale={l}
      locations={[{ id: DEMO_LOCATION_ID, name: DEMO_LOCATION_NAME[l], fallback }]}
      locationId={DEMO_LOCATION_ID}
      blocks={blocks}
      spots={spots}
      lists={lists}
      backend={backend}
      banner={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] bg-accent-soft px-4 py-3">
          <p className="min-w-[15rem] flex-1 text-[0.8125rem] leading-relaxed text-ink-2">
            {t.planner.demoNote[l]}
          </p>
          <button
            type="button"
            onClick={() => {
              clearDemoWeek();
              setBlocks(starterWeek());
              setSpots(starterSpots());
              setFallbackState(DEMO_FALLBACK);
            }}
            className="text-[0.8125rem] font-semibold text-ink-3 underline-offset-4 hover:text-ink hover:underline"
          >
            {t.planner.demoReset[l]}
          </button>
          <Link
            href={href(l, "signup")}
            className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[0.8125rem] font-semibold text-accent-ink"
          >
            {t.planner.demoSave[l]}
          </Link>
        </div>
      }
    />
  );
}
