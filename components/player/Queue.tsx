"use client";

import { usePlayer } from "./PlayerProvider";
import Cover from "./Cover";
import { player } from "@/lib/content/player";
import { clockTime } from "@/lib/format";
import Equaliser from "@/components/ui/Equaliser";
import { PlayIcon } from "./Icons";

export default function Queue({ max }: { max?: number }) {
  const p = usePlayer();
  const l = p.locale;
  const list = max ? p.queue.slice(0, max) : p.queue;

  if (!p.queue.length) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] bg-surface p-8">
        <p className="u-title text-[1.0625rem]">{player.nothingMatches[l]}</p>
        <button
          type="button"
          onClick={p.resetFilters}
          className="rounded-full bg-surface-2 px-4 py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-3"
        >
          {player.reset[l]}
        </button>
      </div>
    );
  }

  return (
    <ul>
      {list.map((t) => {
        const active = p.current?.id === t.id;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => p.play(t)}
              className={`group grid w-full grid-cols-[22px_1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 text-left transition-colors sm:grid-cols-[22px_1fr_auto_auto] sm:gap-4 ${
                active ? "bg-surface-2" : "hover:bg-surface-2"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center text-ink-3">
                {active && p.playing ? (
                  <Equaliser bars={3} height={10} width={2} className="text-accent" />
                ) : (
                  <PlayIcon size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <Cover track={t} size={30} className="hidden sm:block" />
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[0.875rem] ${active ? "text-accent" : "text-ink"}`}
                  >
                    {t.title[l]}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-ink-3">{t.artist}</span>
                </span>
              </span>
              <span className="u-tabular hidden text-[0.75rem] text-ink-3 sm:block">
                {t.bpm} · {t.vox ? "VOX" : "INST"}
              </span>
              <span className="u-tabular text-[0.75rem] text-ink-3">{clockTime(t.duration)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
