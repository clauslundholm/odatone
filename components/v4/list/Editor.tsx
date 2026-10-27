"use client";

import Link from "next/link";
import { createContext, useActionState, useContext, useMemo, useState, type ReactNode } from "react";

import { deleteList, updateList } from "@/app/[locale]/_list-actions";
import { PlayIcon } from "@/components/player/Icons";
import { usePlayer } from "@/components/player/PlayerProvider";
import { buttonClass } from "@/components/ui/Button";
import { v4 as t } from "@/lib/content/v4";
import { clockTime } from "@/lib/format";
import type { ActionResult } from "@/lib/forms";
import type { Locale } from "@/lib/i18n";
import { BPM_MAX, BPM_MIN, GENRES, LANGS, filterTracks, type Genre, type Lang } from "@/lib/tracks";

export type EditableList = {
  id: string;
  name: string;
  basedOn: string | null;
  genres: Genre[];
  bpmLow: number;
  bpmHigh: number;
  /** null = either, true = only with vocals, false = only instrumental. */
  vox: boolean | null;
  /** Empty = any language; only meaningful alongside a vocal. */
  langs: Lang[];
};

/** Where this list currently plays, counted off `schedule_blocks`. */
export type Scheduled = { blocks: number; locations: number };

/* The three tempo bands the design offers. A list can hold any range the
   table allows — the front page's builder writes one from a slider — so
   a range matching none of the three simply lights none of them and the
   figure beside the label says what it actually is. Derived from the
   catalogue's own bounds rather than typed, so widening the library's
   BPM range moves the ends of these with it. */
const BANDS: [number, number][] = [
  [BPM_MIN, 90],
  [90, 110],
  [110, BPM_MAX],
];

type State = {
  list: EditableList;
  name: string;
  genres: Genre[];
  bpm: [number, number];
  vox: boolean | null;
  langs: Lang[];
  setName: (v: string) => void;
  toggleGenre: (g: Genre) => void;
  setBpm: (v: [number, number]) => void;
  setVox: (v: boolean | null) => void;
  toggleLang: (v: Lang) => void;
};

const Ctx = createContext<State | null>(null);

function useList(): State {
  const value = useContext(Ctx);
  if (!value) throw new Error("ListProvider is missing");
  return value;
}

/**
 * The editor's state, shared by the two halves of the screen.
 *
 * It has to be a provider rather than props because the form sits in the
 * shell's main column and the live match count sits in the shell's right
 * rail — two different slots of components/v4/Shell. Wrapping Shell in
 * this puts both inside one subtree, so the count moves as the rules do
 * without either half knowing about the other.
 */
export function ListProvider({ list, children }: { list: EditableList; children: ReactNode }) {
  const [name, setName] = useState(list.name);
  const [genres, setGenres] = useState<Genre[]>(list.genres);
  const [bpm, setBpm] = useState<[number, number]>([list.bpmLow, list.bpmHigh]);
  const [vox, setVoxState] = useState<boolean | null>(list.vox);
  const [langs, setLangs] = useState<Lang[]>(list.langs);

  /* Choosing "Instrumental" drops the languages with it: the pair
     describes an empty set, and the database refuses it outright
     (playlists_langs_need_vocals, 0017). Cleared here rather than at
     save time so the form never shows a choice it is about to discard. */
  const setVox = (value: boolean | null) => {
    setVoxState(value);
    if (value === false) setLangs([]);
  };

  const value: State = {
    list,
    name,
    genres,
    bpm,
    vox,
    langs,
    setName,
    toggleGenre: (g) => setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g])),
    setBpm,
    setVox,
    toggleLang: (v) => setLangs((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium transition-colors ${
        on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const initialState: ActionResult | Record<string, never> = {};

/** The main column: the name, where it came from, and the rules. */
export function ListForm({ locale: l }: { locale: Locale }) {
  const s = useList();
  const p = usePlayer();
  const c = t.list;
  const [state, formAction, pending] = useActionState(updateList, initialState as ActionResult);

  const matches = useMemo(
    () => filterTracks({ genres: s.genres, mood: null, bpm: s.bpm, vox: s.vox, langs: s.langs }),
    [s.genres, s.bpm, s.vox, s.langs],
  );

  const errors = state && "ok" in state && !state.ok ? state.errors : undefined;
  const saved = Boolean(state && "ok" in state && state.ok);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={s.list.id} />
      <input type="hidden" name="locale" value={l} />
      {s.genres.map((g) => (
        <input key={g} type="hidden" name="genre" value={g} />
      ))}
      <input type="hidden" name="bpmLow" value={s.bpm[0]} />
      <input type="hidden" name="bpmHigh" value={s.bpm[1]} />
      <input type="hidden" name="vox" value={s.vox === null ? "" : String(s.vox)} />
      {s.langs.map((x) => (
        <input key={x} type="hidden" name="lang" value={x} />
      ))}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="u-display truncate text-[1.75rem] tracking-[-0.02em]">{s.name || c.untitled[l]}</h1>
          <p className="text-[0.875rem] text-ink-3">
            {s.list.basedOn ? c.ledeCopy[l] : c.ledeOwn[l]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={matches.length === 0}
            onClick={() => p.setFilters({ genres: s.genres, mood: null, bpm: s.bpm, vox: s.vox })}
            className={buttonClass("outline", "md")}
          >
            <PlayIcon size={14} />
            {c.play[l]}
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
            {pending ? c.saving[l] : c.save[l]}
          </button>
        </div>
      </header>

      {errors?.form && (
        <p role="alert" className="text-[0.875rem] text-bad">
          {c.notFound[l]}
        </p>
      )}
      {saved && (
        <p role="status" className="text-[0.875rem] text-ok">
          {c.saved[l]}
        </p>
      )}

      <section className="u-card flex flex-col">
        <header className="border-b border-line px-6 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink">{c.details[l]}</h2>
        </header>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-[0.875rem] text-ink-2">{c.name[l]}</span>
            <input
              name="name"
              value={s.name}
              onChange={(e) => s.setName(e.target.value)}
              maxLength={80}
              required
              aria-invalid={errors?.name ? true : undefined}
              className={`w-full rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)] ${
                errors?.name ? "border-warn" : "border-line"
              }`}
            />
          </label>

          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[0.875rem] text-ink-2">{c.basedOn[l]}</span>
            {/* Not editable, and not a select: `based_on` records which
                curated list this was copied from, as free text, because
                the curated lists live in application code rather than in
                a table (0015). Rewriting it would make it a label for
                something that never happened. */}
            <p className="rounded-[var(--radius-md)] border border-line bg-surface-2 px-4 py-3 text-[0.9375rem] text-ink-2">
              {s.list.basedOn ?? c.basedOnNone[l]}
            </p>
          </div>
        </div>
      </section>

      <section className="u-card flex flex-col">
        <header className="flex flex-col gap-1 border-b border-line px-6 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink">{c.music[l]}</h2>
          <p className="text-[0.8125rem] leading-relaxed text-ink-3">{c.musicLede[l]}</p>
        </header>
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <p className="text-[0.875rem] text-ink-2">{t.builder.genre[l]}</p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <Chip key={g.id} on={s.genres.includes(g.id)} onClick={() => s.toggleGenre(g.id)}>
                  {g.label[l]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[0.875rem] text-ink-2">{t.builder.vocal[l]}</p>
            <div className="flex flex-wrap gap-2">
              {([
                [null, t.builder.vocalAny[l]],
                [true, t.builder.vocalYes[l]],
                [false, t.builder.vocalNo[l]],
              ] as const).map(([value, label]) => (
                <Chip key={String(value)} on={s.vox === value} onClick={() => s.setVox(value)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[0.875rem] text-ink-2">{t.builder.language[l]}</p>
            {s.vox === false ? (
              <p className="text-[0.8125rem] text-ink-3">{t.builder.languageNone[l]}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {LANGS.map((x) => (
                  <Chip key={x.id} on={s.langs.includes(x.id)} onClick={() => s.toggleLang(x.id)}>
                    {x.label[l]}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[0.875rem] text-ink-2">{t.builder.tempo[l]}</p>
              <p className="u-tabular text-[0.8125rem] text-ink-3">
                {s.bpm[0]}–{s.bpm[1]} BPM
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {BANDS.map(([low, high]) => (
                <Chip
                  key={`${low}-${high}`}
                  on={s.bpm[0] === low && s.bpm[1] === high}
                  onClick={() => s.setBpm([low, high])}
                >
                  <span className="u-tabular">
                    {low}–{high} BPM
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}

/**
 * The right rail: what these rules match at this moment, and the way
 * out.
 *
 * The count comes from the same `filterTracks` the player queues with,
 * so it cannot promise more than Afspil plays — the same discipline the
 * front page's builder keeps.
 */
export function ListMatches({
  locale: l,
  scheduled,
}: {
  locale: Locale;
  scheduled: Scheduled;
}) {
  const s = useList();
  const c = t.list;
  const matches = useMemo(
    () => filterTracks({ genres: s.genres, mood: null, bpm: s.bpm, vox: s.vox, langs: s.langs }),
    [s.genres, s.bpm, s.vox, s.langs],
  );

  const shown = matches.slice(0, 6);
  const rest = matches.length - shown.length;

  const countLabel =
    matches.length === 0
      ? t.builder.none[l]
      : matches.length === 1
        ? t.builder.matchesOne[l]
        : t.builder.matches[l].replace("{n}", String(matches.length));

  const where =
    scheduled.blocks === 0
      ? c.whenNone[l]
      : (scheduled.locations === 1 ? c.whenCountOne : c.whenCount)[l]
          .replace("{n}", String(scheduled.blocks))
          .replace("{m}", String(scheduled.locations));

  return (
    <div className="flex flex-col gap-5">
      <section className="u-card flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <p role="status" className="text-[1.0625rem] font-semibold text-ink">
            {countLabel}
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-ink-3">{c.matchesNote[l]}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {shown.map((track) => (
            <li key={track.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                  {track.title[l]}
                </span>
                <span className="block truncate text-[0.8125rem] text-ink-3">{track.artist}</span>
              </span>
              <span className="u-tabular shrink-0 text-[0.8125rem] text-ink-3">
                {clockTime(track.duration)}
              </span>
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <p className="text-[0.8125rem] text-ink-3">{c.matchesMore[l].replace("{n}", String(rest))}</p>
        )}
      </section>

      <section className="u-card flex flex-col gap-3 p-6">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
          {c.whenPlays[l]}
        </p>
        <p className="text-[0.9375rem] text-ink">{where}</p>
        <Link
          href={`/${l}/${l === "da" ? "spilleplan" : "schedule"}`}
          className="text-[0.875rem] font-medium text-accent underline-offset-2 hover:underline"
        >
          {c.whenSet[l]}
        </Link>
      </section>

      {/* Its own form, outside the editor's: a delete must not be one
          stray Enter key away from a save. */}
      <form action={deleteList} className="flex flex-col gap-2 px-1">
        <input type="hidden" name="id" value={s.list.id} />
        <input type="hidden" name="locale" value={l} />
        <button
          type="submit"
          className="self-start text-[0.875rem] font-medium text-bad underline-offset-2 hover:underline"
        >
          {c.delete[l]}
        </button>
        <p className="text-[0.75rem] leading-relaxed text-ink-3">{c.deleteNote[l]}</p>
      </form>
    </div>
  );
}
