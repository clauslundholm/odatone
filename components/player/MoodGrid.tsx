"use client";

import { usePlayer } from "./PlayerProvider";
import Cover from "./Cover";
import Equaliser from "@/components/ui/Equaliser";
import { PlayIcon, PauseIcon } from "./Icons";
import { player } from "@/lib/content/player";
import { MOODS, TRACKS, filterTracks } from "@/lib/tracks";
import { clockTime, num } from "@/lib/format";

/**
 * The landing page's way into the library: pick a room, the dock starts
 * playing. No transport here — that belongs to the dock.
 */
export default function MoodGrid() {
  const p = usePlayer();
  const l = p.locale;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MOODS.map((m) => {
          const count = filterTracks({ ...p.filters, mood: m.id, genres: [] }).length;
          const active = p.filters.mood === m.id;
          const sounding = active && p.playing;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  p.setFilters({ mood: m.id, genres: [] });
                  if (sounding) p.pause();
                  else p.play();
                }}
                aria-pressed={active}
                className={`group flex h-full w-full flex-col items-start gap-5 rounded-[var(--radius-xl)] p-6 text-left transition-colors sm:p-7 ${
                  active ? "bg-surface-2" : "bg-surface/60 hover:bg-surface-2"
                }`}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${
                    active
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-2 text-ink-2 group-hover:bg-surface-3 group-hover:text-ink"
                  }`}
                >
                  {sounding ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                </span>
                <span className="flex-1">
                  <span className="u-title flex items-center gap-2 text-[1.0625rem]">
                    {m.label[l]}
                    {sounding && (
                      <Equaliser bars={3} height={10} width={2} className="text-accent" />
                    )}
                  </span>
                  <span className="mt-1.5 block max-w-[26ch] text-[0.875rem] text-ink-2">
                    {m.blurb[l]}
                  </span>
                </span>
                <span className="u-label text-[0.75rem]">
                  {num(count, l)}{" "}
                  {count === 1 ? player.trackInQueue[l] : player.tracksInQueue[l]}
                </span>
              </button>
            </li>
          );
        })}

        <li className="hidden xl:block">
          <div className="flex h-full flex-col justify-center gap-3 rounded-[var(--radius-xl)] p-6 sm:p-7">
            <p className="u-num u-gradient text-[clamp(2rem,4vw,3rem)]">{num(TRACKS.length, l)}</p>
            <p className="text-[0.875rem] text-ink-2">
              {l === "da"
                ? "numre i demoen. Over 4.000 i det rigtige bibliotek."
                : "tracks in the demo. Over 4,000 in the real library."}
            </p>
          </div>
        </li>
      </ul>

      <div className="flex min-w-0 flex-col rounded-[var(--radius-xl)] bg-surface/60 p-6 sm:p-7">
        <p className="u-label mb-4">{player.upNext[l]}</p>
        <ul className="min-w-0">
          {p.queue.slice(0, 7).map((t) => {
            const active = p.current?.id === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => p.play(t)}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 text-left transition-colors ${
                    active ? "bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  <Cover track={t} size={30} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[0.875rem] ${
                        active ? "text-accent" : "text-ink"
                      }`}
                    >
                      {t.title[l]}
                    </span>
                    <span className="block truncate text-[0.8125rem] text-ink-3">{t.artist}</span>
                  </span>
                  <span className="u-tabular shrink-0 text-[0.75rem] text-ink-3">
                    {clockTime(t.duration)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
