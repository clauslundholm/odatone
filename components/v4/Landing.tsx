"use client";

import Link from "next/link";
import { useMemo } from "react";

import { usePlayer } from "@/components/player/PlayerProvider";
import { buttonClass } from "@/components/ui/Button";
import { PlayIcon } from "@/components/player/Icons";
import { TilePlays } from "./Icons";
import { v4 as t } from "@/lib/content/v4";
import { href, type L10n, type Locale } from "@/lib/i18n";
import { num } from "@/lib/format";
import { PROOF } from "@/lib/site";
import {
  CURATED_PHOTO,
  HERO_PHOTO,
  MOOD_PHOTO,
  artistPhoto,
  genrePhoto,
} from "@/lib/v4/photos";
import { BUILDER_ID } from "@/lib/v4/anchors";
import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_FILTERS,
  GENRES,
  MOODS,
  TRACKS,
  filterTracks,
  type Filters,
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
 * The photography is the Figma's own, exported to public/v4 and mapped in
 * lib/v4/photos.ts. The catalogue underneath is still placeholder
 * (TRACKS_ARE_PLACEHOLDER in lib/tracks.ts: 24 synthesised files).
 * Nothing here reads anything but `Track`, which is the shape
 * lib/catalogue/trax.ts already maps 1000trax onto, so the real catalogue
 * replaces the data without touching this.
 */
export default function Landing({ locale: l }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-11">
      <Hero locale={l} />
      <MoodRow locale={l} />
      <CuratedRow locale={l} />
      <ArtistRow locale={l} />
      <GenreRow locale={l} />
    </div>
  );
}

/* --------------------------------------------------------------- lists */

/** Curated lists, defined as filters rather than as stored track ids — so
    importing a larger catalogue fills them out on its own, exactly the way
    the mobile app's src/data/catalog.ts already does it. */
const CURATED: {
  id: string;
  label: L10n;
  /** The hours the list is for. Shown as the badge on the tile. */
  when: L10n;
  blurb: L10n;
  genres: Genre[];
  bpm: [number, number];
}[] = [
  {
    id: "morning",
    label: { da: "Morgenåbning", en: "Opening hours" },
    when: { da: "Hverdage 7–10", en: "Weekdays 7–10" },
    blurb: { da: "Rolig start, før de første kunder", en: "A quiet start, before the first customers" },
    genres: ["ambient", "acoustic"],
    bpm: [BPM_MIN, 90],
  },
  {
    id: "lunch",
    label: { da: "Frokostpuls", en: "Lunch pulse" },
    when: { da: "Kl. 11–14", en: "11–14" },
    blurb: { da: "Let bossa og soul til frokost", en: "Light bossa and soul over lunch" },
    genres: ["jazz", "acoustic"],
    bpm: [85, 110],
  },
  {
    id: "friday",
    label: { da: "Fredag kl. 17", en: "Friday at five" },
    when: { da: "Fredag fra 17", en: "Friday from 17" },
    blurb: { da: "Når rummet fyldes og alle taler højere", en: "When the room fills and everyone talks louder" },
    genres: ["pop", "rnb"],
    bpm: [105, BPM_MAX],
  },
  {
    id: "evening",
    label: { da: "Dansk på anlægget", en: "Danish on the system" },
    when: { da: "Hele dagen", en: "All day" },
    blurb: { da: "Kun dansk vokal, hele dagen", en: "Danish vocals only, all day" },
    genres: ["pop"],
    bpm: [90, 120],
  },
];

type Curated = (typeof CURATED)[number];

const curatedFilters = (c: Curated): Filters => ({
  ...DEFAULT_FILTERS,
  genres: c.genres,
  bpm: c.bpm,
});

/** The list the hero offers, and the one the right rail names as the
    source. One constant rather than two, so the two cannot disagree. */
const FEATURED = CURATED[2]!;

/** Which curated list the current filters are, if any — so the rail can
    say "Spiller fra Fredag kl. 17" without a second notion of a queue
    source to keep in step with the filters. */
function curatedFor(f: Filters): Curated | null {
  return (
    CURATED.find(
      (c) =>
        c.bpm[0] === f.bpm[0] &&
        c.bpm[1] === f.bpm[1] &&
        c.genres.length === f.genres.length &&
        c.genres.every((g) => f.genres.includes(g)),
    ) ?? null
  );
}

/* ---------------------------------------------------------------- hero */

function Hero({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  const stats: [string, string][] = [
    [`${num(PROOF.tracks, l)}+`, t.hero.stats.tracks[l]],
    [String(GENRES.length), t.hero.stats.genres[l]],
    ["DA + EN", t.hero.stats.languages[l]],
    ["100 %", t.hero.stats.musicians[l]],
  ];

  const featured = useMemo(() => filterTracks(curatedFilters(FEATURED)), []);

  return (
    <section className="relative isolate overflow-hidden rounded-[var(--radius-xl)] p-9 sm:p-11">
      <img
        src={HERO_PHOTO}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      {/* Two layers rather than one flat tint: the wash keeps the whole
          photograph dark enough for white type, and the left-to-right
          gradient buys the extra contrast the headline needs without
          blacking out the right-hand third of the picture. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,8,16,0.92)_0%,rgba(10,8,16,0.72)_46%,rgba(10,8,16,0.42)_100%)]"
      />

      <div className="relative flex max-w-[620px] flex-col items-start gap-5">
        <p className="rounded-full bg-white/15 px-4 py-1.5 text-[0.8125rem] font-medium text-white backdrop-blur-sm">
          {t.hero.eyebrow[l]}
        </p>
        <h1 className="u-display whitespace-pre-line text-[clamp(2rem,4.4vw,3.1rem)] text-white">
          {t.hero.title[l]}
        </h1>
        <p className="text-[1.0625rem] text-white/75">{t.hero.lede[l]}</p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              p.setFilters(curatedFilters(FEATURED));
              if (featured[0]) p.play(featured[0]);
            }}
            disabled={featured.length === 0}
            className={buttonClass("on-photo", "md")}
          >
            <PlayIcon size={15} />
            {t.hero.playList[l].replace("{list}", FEATURED.label[l])}
          </button>
          <a href={`#${BUILDER_ID}`} className={buttonClass("on-photo-quiet", "md")}>
            {t.hero.build[l]}
          </a>
        </div>

        <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
          {stats.map(([value, label]) => (
            <div key={label}>
              <dt className="u-num text-[1.25rem] text-white">{value}</dt>
              <dd className="u-label mt-1 text-white/60">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ sections */

/* No "Se alle" any more. Every one of them pointed at /afspiller or
   /artister, and both pages are gone; each row here shows its whole set
   anyway — five moods, four lists, eight genres — so the link had
   nothing left to lead to. The musicians row is the one that does
   truncate, at eight of fifteen, and that is noted in ArtistRow. */
function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="u-title text-[1.1875rem] text-ink">{title}</h2>
    </div>
  );
}

/** The equaliser mark the design lays over the bottom-left of every photo
    that plays, with the scrim that keeps it legible on a pale picture. */
function PlaysOverlay() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.45)_100%)]"
      />
      <TilePlays className="absolute bottom-3 left-3" />
    </>
  );
}

function MoodRow({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  return (
    <section>
      <SectionHead title={t.sections.now[l]} />
      <ul className="oda-swipe oda-swipe--grid sm:grid-cols-3 xl:grid-cols-5">
        {MOODS.map((m) => {
          const matches = filterTracks({ ...DEFAULT_FILTERS, mood: m.id });
          const active = p.filters.mood === m.id;
          return (
            <li key={m.id} className="w-[46%] min-[420px]:w-[42%]">
              <button
                type="button"
                onClick={() => {
                  p.setFilters({ ...DEFAULT_FILTERS, mood: m.id });
                  if (matches[0]) p.play(matches[0]);
                }}
                aria-pressed={active}
                className={`flex h-full w-full flex-col items-start gap-3 rounded-[var(--radius-lg)] bg-surface p-3 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 ${
                  active ? "ring-2 ring-accent" : ""
                }`}
              >
                <span className="relative block aspect-square w-full overflow-hidden rounded-[var(--radius-md)]">
                  <img src={MOOD_PHOTO[m.id]} alt="" className="h-full w-full object-cover" />
                  <PlaysOverlay />
                </span>
                <span className="flex flex-col gap-1 px-1 pb-2">
                  <span className="u-title text-[1.0625rem] text-ink">{m.label[l]}</span>
                  <span className="text-[0.8125rem] leading-snug text-ink-3">{m.blurb[l]}</span>
                  <span className="text-[0.8125rem] text-ink-3">
                    {t.rail.trackCount[l].replace("{n}", String(matches.length))}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CuratedRow({ locale: l }: { locale: Locale }) {
  const p = usePlayer();
  return (
    <section>
      <SectionHead title={t.sections.lists[l]} />
      <ul className="oda-swipe oda-swipe--grid sm:grid-cols-2 xl:grid-cols-4">
        {CURATED.map((c) => {
          const matches = filterTracks(curatedFilters(c));
          return (
            <li key={c.id} className="w-[64%] min-[420px]:w-[58%]">
              <button
                type="button"
                disabled={matches.length === 0}
                onClick={() => {
                  p.setFilters(curatedFilters(c));
                  if (matches[0]) p.play(matches[0]);
                }}
                className="group flex h-full w-full flex-col items-start gap-3 text-left disabled:opacity-50"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)]">
                  <img
                    src={CURATED_PHOTO[c.id]}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-3 py-1 text-[0.75rem] font-semibold text-ink backdrop-blur-sm">
                    {c.when[l]}
                  </span>
                  <PlaysOverlay />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="u-title text-[1.0625rem] text-ink">{c.label[l]}</span>
                  <span className="text-[0.8125rem] leading-snug text-ink-3">{c.blurb[l]}</span>
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
     catalogue lands, either this fills with real names or the section goes.
     The portraits are positional for the same reason: they belong to the
     row, not to any one of these placeholder names.

     This shows eight of fifteen and no longer offers "Alle musikere" —
     /artister is gone. Those seven are reachable by playing; a dedicated
     page for them is a decision to take with the real catalogue, not with
     placeholder names. */
  const artists = useMemo(() => [...new Set(TRACKS.map((x) => x.artist))].slice(0, 8), []);
  return (
    <section>
      <SectionHead title={t.sections.artists[l]} />
      {/* One row, spread across the column — not a wrapping grid. Eight
          76px portraits and their names fit the column the design draws
          them in, and a ninth on a second line would read as a different
          section rather than as more of this one. */}
      <ul className="oda-swipe oda-swipe--row !gap-3 items-start">
        {artists.map((a, i) => (
          <li key={a} className="flex w-[84px] min-w-0 flex-col items-center gap-2.5 text-center sm:w-auto">
            <img
              src={artistPhoto(i)}
              alt=""
              width={76}
              height={76}
              className="h-[76px] w-[76px] rounded-full object-cover"
            />
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
      <SectionHead title={t.sections.genres[l]} />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {GENRES.map((g, i) => {
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
                className="group relative block h-[100px] w-full overflow-hidden rounded-[var(--radius-lg)] text-left disabled:opacity-50"
              >
                <img
                  src={genrePhoto(i)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_30%,rgba(0,0,0,0.68)_100%)]"
                />
                <span className="absolute bottom-3 left-4 text-[1.0625rem] font-semibold text-white">
                  {g.label[l]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- rail */

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
  const source = useMemo(() => curatedFor(p.filters), [p.filters]);

  const countLabel =
    matches.length === 0
      ? t.builder.none[l]
      : matches.length === 1
        ? t.builder.matchesOne[l]
        : t.builder.matches[l].replace("{n}", String(matches.length));

  /* Rounded up: a list that runs 51.4 minutes is a 52-minute list, and
     rounding down would advertise less music than it plays. */
  const minutes = Math.ceil(matches.reduce((s, x) => s + x.duration, 0) / 60);

  return (
    <div className="flex flex-col gap-5 xl:sticky xl:top-[84px]">
      <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-[0.8125rem] text-ink-3">
          {source ? t.nowPlaying.from[l].replace("{list}", source.label[l]) : t.nowPlaying.heading[l]}
        </p>
        {p.current ? (
          <>
            <span className="relative mt-3 block aspect-square w-full overflow-hidden rounded-[var(--radius-lg)]">
              <img
                src={MOOD_PHOTO[p.current.mood]}
                alt=""
                className="h-full w-full object-cover"
              />
              <PlaysOverlay />
            </span>
            <p className="u-title mt-4 text-[1.3125rem] text-ink">{p.current.title[l]}</p>
            <p className="mt-0.5 text-[0.9375rem] text-ink-3">{p.current.artist}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[
                GENRES.find((g) => g.id === p.current!.genre)?.label[l] ?? p.current.genre,
                `${p.current.bpm} BPM`,
                p.current.vox ? t.builder.vocalYes[l] : t.builder.vocalNo[l],
              ].map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-line px-3 py-1 text-[0.8125rem] text-ink-2"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-2 text-[0.9375rem] text-ink-2">{t.nowPlaying.nothing[l]}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-3">{t.nowPlaying.nothingNote[l]}</p>
          </>
        )}
      </section>

      {/* The rail's "Byg din liste" and the hero's second button both
          jump here — scroll-mt clears the sticky header. */}
      <section
        id={BUILDER_ID}
        className="flex scroll-mt-24 flex-col gap-4 rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="u-title text-[1.1875rem] text-ink">{t.builder.heading[l]}</h2>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-[0.75rem] font-semibold text-accent">
            {t.builder.live[l]}
          </span>
        </div>

        <div>
          <p className="u-label mb-2 text-ink-3">{t.builder.genre[l]}</p>
          <div className="flex flex-wrap gap-2">
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
                  className={`rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                    on
                      ? "bg-accent text-accent-ink"
                      : "border border-line text-ink hover:bg-surface-2"
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
          <div className="flex gap-0.5 rounded-full bg-surface-2 p-1">
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
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[0.8125rem] transition-colors ${
                  p.filters.vox === value
                    ? "bg-surface font-semibold text-ink shadow-sm"
                    : "text-ink-3 hover:text-ink"
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
            <p className="u-num text-[0.8125rem] text-accent">
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
            className="oda-range w-full"
            style={{
              ["--fill" as string]: `${Math.round(
                ((p.filters.bpm[1] - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100,
              )}%`,
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <img
            src={MOOD_PHOTO[matches[0]?.mood ?? "calm"]}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
          <div className="min-w-0">
            <p role="status" className="text-[0.9375rem] font-semibold text-ink">
              {countLabel}
            </p>
            {matches.length > 0 && (
              <p className="text-[0.8125rem] text-ink-3">
                {t.builder.runtime[l].replace("{min}", String(minutes))}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => p.resetFilters()}
            className="u-link ml-auto shrink-0 text-[0.75rem]"
          >
            {t.builder.reset[l]}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={matches.length === 0}
            onClick={() => matches[0] && p.play(matches[0])}
            className={buttonClass("outline", "md", "shrink-0")}
          >
            <PlayIcon size={14} />
            {t.builder.play[l]}
          </button>
          <Link href={href(l, "signup")} className={buttonClass("primary", "md", "flex-1")}>
            {t.builder.save[l]}
          </Link>
        </div>
        <p className="text-[0.75rem] leading-relaxed text-ink-3">{t.builder.saveNote[l]}</p>
      </section>
    </div>
  );
}
