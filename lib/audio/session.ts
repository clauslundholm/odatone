"use client";

import { DEFAULT_FILTERS, type Filters } from "@/lib/tracks";

/**
 * Playback state parked in sessionStorage.
 *
 * The locale sits in the root layout segment (`app/[locale]/layout.tsx`),
 * which is what gives every language its own `<html lang>` — but it also
 * means switching language remounts the whole tree, provider and audio
 * element included. Rather than move the player outside the layout, the
 * dock saves where it was and picks it back up on the other side. The same
 * snapshot covers a hard reload.
 */

const KEY = "odatone.player.session.v1";

export type PlaybackSnapshot = {
  trackId: string | null;
  time: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  filters: Filters;
};

export const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  trackId: null,
  time: 0,
  playing: false,
  volume: 0.8,
  muted: false,
  shuffle: false,
  filters: DEFAULT_FILTERS,
};

export function loadSnapshot(): PlaybackSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlaybackSnapshot>;
    const f = parsed.filters;
    return {
      ...EMPTY_SNAPSHOT,
      ...parsed,
      time: Number(parsed.time) || 0,
      volume: clamp01(Number(parsed.volume), 0.8),
      filters: {
        genres: Array.isArray(f?.genres) ? f.genres : DEFAULT_FILTERS.genres,
        mood: f?.mood ?? null,
        bpm:
          Array.isArray(f?.bpm) && f.bpm.length === 2
            ? [Number(f.bpm[0]), Number(f.bpm[1])]
            : DEFAULT_FILTERS.bpm,
        vox: typeof f?.vox === "boolean" ? f.vox : null,
      },
    };
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: PlaybackSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode — playback just restarts from the top */
  }
}

function clamp01(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}
