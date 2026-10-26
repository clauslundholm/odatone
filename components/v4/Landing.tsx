"use client";

import Link from "next/link";
import { useMemo } from "react";

import Cover from "@/components/player/Cover";
import { usePlayer } from "@/components/player/PlayerProvider";
import { Button, LinkButton } from "@/components/ui/Button";
import { v4 as t } from "@/lib/content/v4";
import { href, type Locale } from "@/lib/i18n";
import { num } from "@/lib/format";
import { PROOF } from "@/lib/site";
import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_FILTERS,
  GENRES,
  MOODS,
  TRACKS,
  filterTracks,
  type Genre,
} from "@/lib/tracks";

/**
 * The product-first landing page: the library is the page, rather than an
 * argument about the library.
 *
 * Everything here plays. The mood tiles, the curated rows and the builder
 * all drive the same `usePlayer` state the dock at the bottom is showing,
 * so a visitor who clicks "Rolig" hears Rolig rather than being shown a
 * screenshot of it. That is the whole premise of "produkt først", and it
 * is also why the counts are computed with `filterTracks` — the same
 * function that decides what actually queues.
 *
 * The catalogue underneath is still placeholder (TRACKS_ARE_PLACEHOLDER in
 * lib/tracks.ts: 24 synthesised files). Nothing here reads anything but
 * `Track`, which is the shape lib/catalogue/trax.ts already maps 1000trax
 * onto, so the real catalogue replaces the data without touching this.
 */
export default function Landing({ locale: l }: { locale: Locale }) {
  const p = usePlayer();

  return (
    <div className="flex flex-col gap-10">
      <Hero locale={l} />
      <MoodRow locale={l} />
      <CuratedRow locale={l} />
      <ArtistRow locale={l} />
      <GenreRow locale={l} />
    </div>
  );
}

function Hero({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  const stats: [string, string][] = [
    [`${num(PROOF.tracks, l)}+`, t.hero.stats.tracks[l]],
    [String(GENRES.length), t.hero.stats.genres[l]],
    ["DA + EN", t.hero.stats.languages[l]],
    ["100 %", t.hero.stats.musicians[l]],
  ];

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] bg-ink p-8 sm:p-11">
      <div className="relative z-[1] flex max-w-[620px] flex-col gap-5">
        <p className="u-label text-accent">{t.hero.eyebrow[l]}</p>
        <h1 className="u-display whitespace-pre-line text-[clamp(2rem,4.4vw,3.1rem)] text-bg">
          {t.hero.title[l]}
        </h1>
        <p className="text-[1.0625rem] text-bg/70">{t.hero.lede[l]}</p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => p.play()}>
            {t.hero.play[l]}
          </Button>
          <LinkButton href={href(l, "player")} variant="outline" size="lg">
            {t.hero.build[l]}
          </LinkButton>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
          {stats.map(([value, label]) => (
            <div key={label}>
              <dt className="u-num text-[1.25rem] text-bg">{value}</dt>
              <dd className="u-label mt-1 text-bg/60">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function SectionHead({ title, hrefTo, locale: l }: { title: string; hrefTo?: string; locale: Locale }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="u-title text-[1.125rem] text-ink">{title}</h2>
      {hrefTo && (
        <Link href={hrefTo} className="u-link text-[0.8125rem]">
          {t.sections.seeAll[l]}
        </Link>
      )}
    </div>
  );
}

function MoodRow({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  return (
    <section>
      <SectionHead title={t.sections.now[l]} locale={l} />
      <ul className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {MOODS.map((m) => {
          const matches = filterTracks({ ...DEFAULT_FILTERS, mood: m.id });
          const active = p.filters.mood === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  p.setFilters({ ...DEFAULT_FILTERS, mood: m.id });
                  if (matches[0]) p.play(matches[0]);
                }}
                aria-pressed={active}
                className={`flex h-full w-full flex-col items-start gap-2 rounded-[var(--radius-lg)] p-5 text-left transition-colors ${
                  active ? "bg-surface-2 ring-1 ring-accent/40" : "bg-surface-2/60 hover:bg-surface-2"
                }`}
              >
                <span className="u-title text-[1rem] text-ink">{m.label[l]}</span>
                <span className="text-[0.8125rem] leading-snug text-ink-3">{m.blurb[l]}</span>
                <span className="u-label mt-auto pt-3 text-ink-3">
                  {matches.length} {t.hero.stats.tracks[l]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Curated lists, defined as filters rather than as stored track ids — so
    importing a larger catalogue fills them out on its own, exactly the way
    the mobile app's src/data/catalog.ts already does it. */
const CURATED: { id: string; label: L10nish; genres: Genre[]; bpm: [number, number] }[] = [
  { id: "morning", label: { da: "Morgenåbning", en: "Opening hours" }, genres: ["ambient", "acoustic"], bpm: [BPM_MIN, 90] },
  { id: "lunch", label: { da: "Frokostpuls", en: "Lunch pulse" }, genres: ["jazz", "acoustic"], bpm: [85, 110] },
  { id: "friday", label: { da: "Fredag kl. 17", en: "Friday at five" }, genres: ["pop", "rnb"], bpm: [105, BPM_MAX] },
  { id: "evening", label: { da: "Dansk på anlægget", en: "Danish on the system" }, genres: ["pop"], bpm: [90, 120] },
];
type L10nish = { da: string; en: string };

function CuratedRow({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  return (
    <section>
      <SectionHead title={t.sections.lists[l]} hrefTo={href(l, "player")} locale={l} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CURATED.map((c) => {
          const matches = filterTracks({ ...DEFAULT_FILTERS, genres: c.genres, bpm: c.bpm });
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={matches.length === 0}
                onClick={() => {
                  p.setFilters({ ...DEFAULT_FILTERS, genres: c.genres, bpm: c.bpm });
                  if (matches[0]) p.play(matches[0]);
                }}
                className="flex h-full w-full flex-col items-start gap-2 rounded-[var(--radius-lg)] bg-surface-2/60 p-5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="u-title text-[1rem] text-ink">{c.label[l]}</span>
                <span className="u-label mt-auto pt-3 text-ink-3">
                  {matches.length} {t.hero.stats.tracks[l]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ArtistRow({ locale: l }: { locale: Locale }) {
  /* Real names off the catalogue rather than a fixed list, so this row
     cannot outlive the artists in it. 1000trax returns no artist at all
     today (docs/1000trax-api-requirements.md §2.4) — when the real
     catalogue lands, either this fills with real names or the section goes. */
  const artists = useMemo(() => [...new Set(TRACKS.map((x) => x.artist))].slice(0, 8), []);
  return (
    <section>
      <SectionHead title={t.sections.artists[l]} hrefTo={href(l, "artists")} locale={l} />
      <ul className="flex flex-wrap gap-5">
        {artists.map((a) => (
          <li key={a} className="flex w-[96px] flex-col items-center gap-2 text-center">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-surface-2 text-[1.125rem] font-medium text-ink-3">
              {a.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <span className="text-[0.8125rem] leading-tight text-ink-2">{a}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GenreRow({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  return (
    <section>
      <SectionHead title={t.sections.genres[l]} locale={l} />
      <ul className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {GENRES.map((g) => {
          const matches = filterTracks({ ...DEFAULT_FILTERS, genres: [g.id] });
          return (
            <li key={g.id}>
              <button
                type="button"
                disabled={matches.length === 0}
                onClick={() => {
                  p.setFilters({ ...DEFAULT_FILTERS, genres: [g.id] });
                  if (matches[0]) p.play(matches[0]);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-surface-2/60 px-5 py-4 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="text-[0.9375rem] text-ink">{g.label[l]}</span>
                <span className="u-label text-ink-3">{matches.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The right rail: what is playing, and the list builder.
 *
 *  The builder is the player's own filter state rather than a second,
 *  parallel notion of "a list" — so the count it shows is produced by the
 *  same `filterTracks` that decides what Afspil queues, and the two cannot
 *  disagree. Saving is the only part that needs an account, and the copy
 *  says so instead of failing after the click. */
export function Rail({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  const matches = useMemo(() => filterTracks(p.filters), [p.filters]);

  const countLabel =
    matches.length === 0
      ? t.builder.none[l]
      : matches.length === 1
        ? t.builder.matchesOne[l]
        : t.builder.matches[l].replace("{n}", String(matches.length));

  return (
    <div className="sticky top-[76px] flex flex-col gap-4">
      <section className="rounded-[var(--radius-lg)] bg-surface-2/60 p-5">
        <p className="u-label mb-3 text-ink-3">{t.nowPlaying.heading[l]}</p>
        {p.current ? (
          <div className="flex items-center gap-3">
            <Cover track={p.current} size={48} />
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-medium text-ink">{p.current.title[l]}</p>
              <p className="truncate text-[0.8125rem] text-ink-3">{p.current.artist}</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[0.9375rem] text-ink-2">{t.nowPlaying.nothing[l]}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-3">{t.nowPlaying.nothingNote[l]}</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-surface-2/60 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="u-title text-[1rem] text-ink">{t.builder.heading[l]}</h2>
          <button type="button" onClick={() => p.resetFilters()} className="u-link text-[0.75rem]">
            {t.builder.reset[l]}
          </button>
        </div>

        <div>
          <p className="u-label mb-2 text-ink-3">{t.builder.genre[l]}</p>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((g) => {
              const on = p.filters.genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    p.setFilters((f) => ({
                      ...f,
                      genres: on ? f.genres.filter((x) => x !== g.id) : [...f.genres, g.id],
                    }))
                  }
                  className={`rounded-full px-3 py-1.5 text-[0.75rem] transition-colors ${
                    on ? "bg-accent text-accent-ink" : "bg-surface text-ink-2 hover:text-ink"
                  }`}
                >
                  {g.label[l]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="u-label mb-2 text-ink-3">{t.builder.vocal[l]}</p>
          <div className="inline-flex gap-0.5 rounded-full bg-surface p-1">
            {([
              [null, t.builder.vocalAny[l]],
              [true, t.builder.vocalYes[l]],
              [false, t.builder.vocalNo[l]],
            ] as [boolean | null, string][]).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={p.filters.vox === value}
                onClick={() => p.setFilters({ vox: value })}
                className={`rounded-full px-3 py-1.5 text-[0.75rem] transition-colors ${
                  p.filters.vox === value ? "bg-surface-2 font-medium text-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="u-label text-ink-3">{t.builder.tempo[l]}</p>
            <p className="u-label text-accent">
              {p.filters.bpm[0]}–{p.filters.bpm[1]} BPM
            </p>
          </div>
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={p.filters.bpm[1]}
            onChange={(e) => p.setFilters({ bpm: [p.filters.bpm[0], Number(e.target.value)] })}
            aria-label={t.builder.tempo[l]}
            className="w-full accent-[var(--c-accent)]"
          />
        </div>

        <p role="status" className="text-[0.875rem] text-ink">
          {countLabel}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={matches.length === 0}
            onClick={() => matches[0] && p.play(matches[0])}
          >
            {t.builder.play[l]}
          </Button>
          <LinkButton href={href(l, "signup")} size="sm">
            {t.builder.save[l]}
          </LinkButton>
        </div>
        <p className="u-label text-ink-3">{t.builder.saveNote[l]}</p>
      </section>
    </div>
  );
}
