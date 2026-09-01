"use client";

import { usePlayer } from "./PlayerProvider";
import Spectrum from "./Spectrum";
import Cover from "./Cover";
import { PlayIcon, PauseIcon } from "./Icons";
import { player, dock } from "@/lib/content/player";
import { MOODS, TRACKS } from "@/lib/tracks";
import { TRIAL_DAYS } from "@/lib/audio/trial";
import { num } from "@/lib/format";

/**
 * The hero's entry point into the player. It has no transport of its own —
 * pressing a mood starts the dock, which then follows the visitor around
 * the site.
 */
export default function MoodCard() {
  const p = usePlayer();
  const l = p.locale;
  const t = p.current;

  return (
    <div className="u-card mx-auto flex w-full max-w-[880px] flex-col overflow-hidden">
      <div className="flex items-center gap-5 p-6 sm:p-8">
        <button
          type="button"
          onClick={() => p.toggle()}
          disabled={p.trial.expired}
          aria-label={p.playing ? "Pause" : "Play"}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity hover:opacity-85 disabled:opacity-30"
        >
          {p.playing ? <PauseIcon size={19} /> : <PlayIcon size={19} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="u-label mb-1 text-accent">
            {p.playing
              ? player.nowPlaying[l]
              : dock.idleSub[l].replace("{n}", num(TRIAL_DAYS, l))}
          </p>
          <p className="truncate text-[1.0625rem] font-medium text-ink">
            {p.trial.started && t ? `${t.title[l]} — ${t.artist}` : dock.idleTitle[l]}
          </p>
        </div>
        <div className="hidden h-10 w-28 items-end lg:flex">
          <Spectrum levels={p.levels.slice(6, 30)} height={40} />
        </div>
      </div>

      <div className="border-t border-line px-6 pb-6 pt-5 sm:px-8">
        <p className="u-label mb-3">{player.mood[l]}</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const active = p.filters.mood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  p.setFilters({ mood: active ? null : m.id });
                  p.play();
                }}
                aria-pressed={active}
                title={m.blurb[l]}
                className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-ink"
                    : "bg-surface-2 text-ink-2 hover:text-ink"
                }`}
              >
                {m.label[l]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line px-6 py-4 sm:px-8">
        <div className="flex -space-x-2">
          {TRACKS.slice(0, 4).map((tr) => (
            <Cover key={tr.id} track={tr} size={22} className="ring-2 ring-[var(--c-surface)]" />
          ))}
        </div>
        <p className="u-label text-[0.75rem]">{dock.dismissHint[l]}</p>
      </div>
    </div>
  );
}
