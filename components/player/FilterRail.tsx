"use client";

import { usePlayer } from "./PlayerProvider";
import { player } from "@/lib/content/player";
import { GENRES, MOODS, BPM_MIN, BPM_MAX, countByGenre, type Genre } from "@/lib/tracks";
import { num } from "@/lib/format";

const counts = countByGenre();

export default function FilterRail({ compact = false }: { compact?: boolean }) {
  const p = usePlayer();
  const l = p.locale;
  const [lo, hi] = p.filters.bpm;

  const toggleGenre = (g: Genre) =>
    p.setFilters((f) => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g],
    }));

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="u-label mb-3">{player.mood[l]}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={p.filters.mood === null} onClick={() => p.setFilters({ mood: null })}>
            {player.anyMood[l]}
          </Chip>
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              active={p.filters.mood === m.id}
              onClick={() => p.setFilters({ mood: p.filters.mood === m.id ? null : m.id })}
              title={m.blurb[l]}
            >
              {m.label[l]}
            </Chip>
          ))}
        </div>
        {p.filters.mood && !compact && (
          <p className="mt-3 text-[0.8125rem] text-ink-3">
            {MOODS.find((m) => m.id === p.filters.mood)?.blurb[l]}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="u-label mb-3">{player.genre[l]}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={p.filters.genres.length === 0} onClick={() => p.setFilters({ genres: [] })}>
            {player.allGenres[l]}
          </Chip>
          {GENRES.map((g) => (
            <Chip
              key={g.id}
              active={p.filters.genres.includes(g.id)}
              onClick={() => toggleGenre(g.id)}
            >
              {g.label[l]}
              <span className="ml-1.5 opacity-50">{counts[g.id]}</span>
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-3 flex items-baseline justify-between">
          <legend className="u-label">{player.tempo[l]}</legend>
          <span className="u-tabular text-[0.8125rem] text-accent">
            {num(lo, l)}–{num(hi, l)} {player.bpm[l]}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="range"
            className="oda-range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={lo}
            aria-label={`${player.tempo[l]} min`}
            style={{ ["--fill" as string]: `${((lo - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100}%` }}
            onChange={(e) => p.setFilters({ bpm: [Math.min(Number(e.target.value), hi - 5), hi] })}
          />
          <input
            type="range"
            className="oda-range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={hi}
            aria-label={`${player.tempo[l]} max`}
            style={{ ["--fill" as string]: `${((hi - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100}%` }}
            onChange={(e) => p.setFilters({ bpm: [lo, Math.max(Number(e.target.value), lo + 5)] })}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="u-label mb-3">{player.vocals[l]}</legend>
        <div className="flex gap-0.5 rounded-full bg-surface-2 p-1">
          {(
            [
              [null, player.voxAny[l]],
              [true, player.voxOn[l]],
              [false, player.voxOff[l]],
            ] as [boolean | null, string][]
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => p.setFilters({ vox: value })}
              aria-pressed={p.filters.vox === value}
              className={`flex-1 rounded-full px-2 py-2 text-[0.8125rem] font-medium transition-colors ${
                p.filters.vox === value
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
        <p className="u-label">
          <span className="text-accent">{num(p.queue.length, l)}</span>{" "}
          {p.queue.length === 1 ? player.trackInQueue[l] : player.tracksInQueue[l]}
        </p>
        <button
          type="button"
          onClick={p.resetFilters}
          className="text-[0.8125rem] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {player.reset[l]}
        </button>
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors ${
        active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
