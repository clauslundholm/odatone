"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  copyBlockToDays,
  copyWeekToLocations,
  createBlock,
  deleteBlock,
  moveBlock,
  setBlockPlaylist,
  setFallback,
} from "@/app/[locale]/_schedule-actions";
import type { Locale } from "@/lib/i18n";
import type { ScheduleBlock } from "@/lib/schedule";
import Planner, { type PlannerBackend, type PlannerLocation } from "./Planner";
import type { WeekList } from "./Week";

/** The signed-in week: every edit is a row in schedule_blocks, written
    through RLS as whoever is asking (app/[locale]/_schedule-actions). */
export default function LivePlanner(props: {
  locale: Locale;
  locations: PlannerLocation[];
  locationId: string;
  blocks: ScheduleBlock[];
  lists: WeekList[];
}) {
  const router = useRouter();

  const backend = useMemo<PlannerBackend>(
    () => ({
      create: createBlock,
      move: moveBlock,
      setPlaylist: setBlockPlaylist,
      remove: deleteBlock,
      copyToDays: copyBlockToDays,
      setFallback,
      copyToLocations: copyWeekToLocations,
      settle: () => router.refresh(),
      goToLocation: (id) => {
        const next = new URLSearchParams(window.location.search);
        next.set("sted", id);
        router.push(`?${next}`);
      },
    }),
    [router],
  );

  return <Planner {...props} backend={backend} />;
}
