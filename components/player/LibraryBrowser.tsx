"use client";

import { usePlayer } from "./PlayerProvider";
import FilterRail from "./FilterRail";
import Spectrum from "./Spectrum";
import Cover from "./Cover";
import TrialGate from "./TrialGate";
import Equaliser from "@/components/ui/Equaliser";
import { PlayIcon } from "./Icons";
import { player } from "@/lib/content/player";
import { GENRES, MOODS, TRACKS_ARE_PLACEHOLDER } from "@/lib/tracks";
import { clockTime } from "@/lib/format";

/**
 * The library. Transport lives in the dock, so this is purely about
 * finding something: filters on the left, the full table on the right.
 */
export default function LibraryBrowser() {
  const p = usePlayer();
  const l = p.locale;

  return (
    <div className="u-card relative">
      <TrialGate />

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-line p-7 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="mb-8 rounded-[var(--radius-lg)] bg-surface-2 p-4">
            <Spectrum levels={p.levels} height={68} />
          </div>
          <FilterRail />
        </aside>

        <div className="min-w-0 p-6 sm:p-8">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="u-label">{player.upNext[l]}</p>
            <p className="u-label hidden text-[0.75rem] sm:block">{player.playHint[l]}</p>
          </div>

          {p.queue.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] bg-surface-2 p-8">
              <p className="u-title text-[1.0625rem]">{player.nothingMatches[l]}</p>
              <button
                type="button"
                onClick={p.resetFilters}
                className="rounded-full bg-surface px-4 py-2 text-[0.8125rem] font-medium text-ink"
              >
                {player.reset[l]}
              </button>
            </div>
          ) : (
            <div className="oda-scroll max-h-[560px] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-[1] bg-surface">
                  <tr className="border-b border-line">
                    <th scope="col" className="u-label w-8 pb-3 text-left font-normal">
                      #
                    </th>
                    <th scope="col" className="u-label pb-3 text-left font-normal">
                      {l === "da" ? "Nummer" : "Track"}
                    </th>
                    <th scope="col" className="u-label hidden pb-3 text-left font-normal md:table-cell">
                      {player.genre[l]}
                    </th>
                    <th scope="col" className="u-label hidden pb-3 text-left font-normal sm:table-cell">
                      {player.mood[l]}
                    </th>
                    <th scope="col" className="u-label hidden pb-3 text-right font-normal sm:table-cell">
                      {player.bpm[l]}
                    </th>
                    <th scope="col" className="u-label pb-3 text-right font-normal">
                      {l === "da" ? "Tid" : "Time"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.queue.map((t, i) => {
                    const active = p.current?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => p.play(t)}
                        className={`group cursor-pointer border-b border-line transition-colors last:border-0 ${
                          active ? "bg-surface-2" : "hover:bg-surface-2"
                        }`}
                      >
                        <td className="py-3 pr-2">
                          <span className="grid h-5 w-5 place-items-center">
                            {active && p.playing ? (
                              <Equaliser bars={3} height={10} width={2} className="text-accent" />
                            ) : (
                              <>
                                <span className="u-tabular text-[0.75rem] text-ink-3 group-hover:hidden">
                                  {i + 1}
                                </span>
                                <PlayIcon size={11} className="hidden text-ink group-hover:block" />
                              </>
                            )}
                          </span>
                        </td>
                        <td className="min-w-0 py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <Cover track={t} size={32} className="hidden sm:block" />
                            <div className="min-w-0">
                              <p
                                className={`truncate text-[0.875rem] ${
                                  active ? "text-accent" : "text-ink"
                                }`}
                              >
                                {t.title[l]}
                              </p>
                              <p className="truncate text-[0.8125rem] text-ink-3">
                                {t.artist} {t.vox ? "· VOX" : "· INST"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden py-3 pr-4 text-[0.875rem] text-ink-2 md:table-cell">
                          {GENRES.find((g) => g.id === t.genre)?.label[l]}
                        </td>
                        <td className="hidden py-3 pr-4 text-[0.875rem] text-ink-2 sm:table-cell">
                          {MOODS.find((m) => m.id === t.mood)?.label[l]}
                        </td>
                        <td className="u-tabular hidden py-3 text-right text-[0.8125rem] text-ink-3 sm:table-cell">
                          {t.bpm}
                        </td>
                        <td className="u-tabular py-3 text-right text-[0.8125rem] text-ink-3">
                          {clockTime(t.duration)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {TRACKS_ARE_PLACEHOLDER && (
        <p className="u-label border-t border-line px-7 py-3.5 text-[0.75rem] sm:px-8">
          {player.placeholderNote[l]}
        </p>
      )}
    </div>
  );
}
