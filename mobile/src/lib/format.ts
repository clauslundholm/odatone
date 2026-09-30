import type { Locale } from "../types";

/** m:ss — the only clock format the player needs. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** "12 numre" / "1 nummer" — Danish needs the singular, English does not. */
export function trackCount(n: number, locale: Locale): string {
  if (locale === "da") return `${n} ${n === 1 ? "nummer" : "numre"}`;
  return `${n} ${n === 1 ? "track" : "tracks"}`;
}

/** Total run time of a list, rounded to whole minutes. */
export function totalMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * A stable 0–359 hue offset per id, so a track's cover looks the same
 * every time without storing anything. Same trick as the website's
 * <Cover>, which rotates the brand gradient by a hash of the id.
 */
export function hashAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/**
 * Playlists have no waveform of their own, but a flat gradient tile next
 * to 24 track covers that all carry bars looks like a missing image.
 * These peaks are deterministic per id, so a list keeps its face.
 */
export function synthPeaks(id: string, n = 15): number[] {
  let seed = hashAngle(id) + id.length * 7 + 1;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out.push(0.3 + (seed / 2147483648) * 0.7);
  }
  return out;
}
