"use client";

import { useMemo } from "react";

import { usePlayer } from "@/components/player/PlayerProvider";
import { Button } from "@/components/ui/Button";
import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";
import { SEASONS, currentSeason, seasonFilters, type Season } from "@/lib/seasons";
import { filterTracks } from "@/lib/tracks";

/**
 * Seasons: six date ranges, each a way of playing rather than a stored
 * playlist — so a bigger catalogue fills them out without anyone
 * re-picking tracks.
 *
 * The season in season today is marked, and `currentSeason` is allowed to
 * return nothing: 29 February is a real day and Vinter ends on the 28th,
 * so one day a year nothing is highlighted. That is better than rounding
 * to the nearest season and being quietly wrong.
 *
 * A card whose rule matches no tracks says so and cannot be played. With a
 * 24-file placeholder catalogue that is most of them, and a play button
 * that does nothing is worse than an honest empty state.
 */
export default function Seasons({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  const now = useMemo(() => currentSeason(), []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="u-title text-[1.125rem] text-ink">{t.seasons.heading[l]}</h1>
        <p className="text-[0.8125rem] text-ink-3">{t.seasons.lede[l]}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SEASONS.map((s) => (
          <SeasonCard key={s.id} season={s} locale={l} inSeason={now?.id === s.id} />
        ))}
      </ul>

      <p className="u-label max-w-[70ch] text-ink-3">{t.seasons.note[l]}</p>
    </div>
  );
}

function SeasonCard({
  season,
  locale: l,
  inSeason,
}: {
  season: Season;
  locale: Locale;
  inSeason: boolean;
}) {
  const p = usePlayer();
  const filters = useMemo(() => seasonFilters(season), [season]);
  const matches = useMemo(() => filterTracks(filters), [filters]);
  const empty = matches.length === 0;

  const range = `${season.from.day}/${season.from.month} – ${season.to.day}/${season.to.month}`;

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-surface ${
        inSeason ? "ring-2 ring-accent/45" : "ring-1 ring-line"
      }`}
    >
      {/* A flat wash until there is real photography. Efterår is meant to
          be a cup of coffee and a yellow leaf; a stock gradient pretending
          to be that is worse than an obvious placeholder. */}
      <div className="h-[132px] bg-surface-2" aria-hidden />

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="u-title text-[1.0625rem] text-ink">{season.label[l]}</h2>
          {inSeason && (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.6875rem] font-medium text-accent">
              {t.seasons.inSeason[l]}
            </span>
          )}
        </div>
        <p className="u-label text-ink-3">{range}</p>
        <p className="text-[0.875rem] text-ink-2">{season.character[l]}</p>

        <div className="mt-auto flex items-center gap-3 pt-3">
          <Button
            size="sm"
            variant={inSeason ? "primary" : "outline"}
            disabled={empty}
            onClick={() => {
              p.setFilters(filters);
              if (matches[0]) p.play(matches[0]);
            }}
          >
            {t.seasons.play[l]}
          </Button>
          <span className="u-label text-ink-3">
            {empty
              ? t.seasons.empty[l]
              : t.seasons.count[l].replace("{n}", String(matches.length))}
          </span>
        </div>
      </div>
    </li>
  );
}
