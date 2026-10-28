/* ==================================================================== *
 *  Track manifest
 *
 *  ⚠️  THE AUDIO IN public/audio IS PLACEHOLDER MATERIAL.
 *
 *  Every file was synthesised by tools/generate-placeholder-audio.py so
 *  that the web player is demonstrable before the real catalogue is
 *  connected. The artist names below are fictional. None of this is
 *  Odatone music.
 *
 *  TO GO LIVE: drop the real files into public/audio (or point `src` at
 *  a CDN), replace the metadata, and regenerate `peaks` with
 *  tools/generate-placeholder-audio.py's peaks_of() or any waveform
 *  extractor. Nothing else in the player needs to change — every
 *  component reads this file and only this file.
 * ==================================================================== */

import type { L10n } from "./i18n";

export const TRACKS_ARE_PLACEHOLDER = false;

export type Genre =
  | "ambient"
  | "electronic"
  | "jazz"
  | "acoustic"
  | "hiphop"
  | "rnb"
  | "pop"
  | "classical";

export type Mood = "calm" | "focus" | "warm" | "evening" | "energy";

/* The language a vocal is sung in. The hero has promised "DA + EN" since
   the first v4 draft and the room cares: a Danish café wants Danish over
   the speakers, and a hotel lobby often wants the opposite. Until now the
   catalogue only knew whether a track HAD a vocal, so "Dansk vokal" in
   the builder was a label with nothing behind it. */
export type Lang = (typeof LANGS)[number]["id"];

/* The languages the catalogue sings in.

   These are not a wish list: GET /services/playlist/metrics answers
   `languagesAvailable: ["en","it","es","da"]`, and the pool names bear
   it out — there is a `pop_danish` and a `lounge_italian`, and nothing
   anywhere for German, French, Portuguese, Swedish or Norwegian. Those
   five were offered by this filter until the real catalogue arrived and
   every one of them returned nothing.

   `playlists.langs` only checks the SHAPE of a code
   (0017_playlist_language.sql), so a list saved while the five were
   selectable still loads; it simply filters to nothing on a code that
   no longer exists. Ordered by how often a Danish room asks. */
export const LANGS = [
  { id: "da", label: { da: "Dansk", en: "Danish" } },
  { id: "en", label: { da: "Engelsk", en: "English" } },
  { id: "es", label: { da: "Spansk", en: "Spanish" } },
  { id: "it", label: { da: "Italiensk", en: "Italian" } },
] as const satisfies readonly { id: string; label: L10n }[];

export const isLang = (v: unknown): v is Lang =>
  typeof v === "string" && LANGS.some((x) => x.id === v);

export type Track = {
  id: string;
  title: L10n;
  artist: string;
  genre: Genre;
  mood: Mood;
  bpm: number;
  vox: boolean;
  /** Which language the vocal is in — null for an instrumental, where
      there is no language to be in. Only meaningful when `vox` is true,
      and the two are kept in step by `langFor` below. */
  lang: Lang | null;
  /** 1 = barely there, 5 = drives the room. */
  energy: number;
  duration: number;
  src: string;
  /** Normalised waveform peaks, 180 buckets, for the scrubber. */
  peaks: number[];
};

/* The ids are the catalogue's own and are deliberately NOT renamed with
   the labels: they are written into `playlists.genres`
   (0015_playlists_and_schedule.sql) on every list a customer has saved,
   and renaming them would silently empty those lists. Only what a reader
   sees changes here — "ambient" is shown as Chillout, "jazz" as Bossa —
   which is how a catalogue gets re-badged without a migration. */
export const GENRES: { id: Genre; label: L10n }[] = [
  { id: "ambient", label: { da: "Chillout", en: "Chillout" } },
  { id: "electronic", label: { da: "House", en: "House" } },
  { id: "jazz", label: { da: "Bossa", en: "Bossa" } },
  { id: "acoustic", label: { da: "Unplugged", en: "Unplugged" } },
  { id: "hiphop", label: { da: "Downbeat", en: "Downbeat" } },
  { id: "rnb", label: { da: "R&B", en: "R&B" } },
  { id: "pop", label: { da: "Pop", en: "Pop" } },
  { id: "classical", label: { da: "Klassisk", en: "Classical" } },
];

export const MOODS: { id: Mood; label: L10n; blurb: L10n }[] = [
  {
    id: "calm",
    label: { da: "Rolig", en: "Calm" },
    blurb: { da: "Morgenåbning, spa", en: "Opening hours, spa" },
  },
  {
    id: "focus",
    label: { da: "Fokus", en: "Focus" },
    blurb: { da: "Kontor, showroom", en: "Office, showroom" },
  },
  {
    id: "warm",
    label: { da: "Varm", en: "Warm" },
    blurb: { da: "Frokost, butik", en: "Lunch, retail" },
  },
  {
    id: "evening",
    label: { da: "Aften", en: "Evening" },
    blurb: { da: "Middag, bar", en: "Dinner, bar" },
  },
  {
    id: "energy",
    label: { da: "Energi", en: "Energy" },
    blurb: { da: "Fitness, fredag", en: "Gym, Friday" },
  },
];

export const BPM_MIN = 55;
export const BPM_MAX = 130;

/** The catalogue.
 *
 *  Was a hand-written array of fifteen demo tracks. It is now the real
 *  1000trax catalogue, read by scripts/ingest-trax.ts and regenerated
 *  by running it again — so this list is a build artefact, not
 *  something to edit.
 *
 *  Why a generated file rather than a fetch: their playlist service
 *  returns an entire pool in one response with no paging (2.25 MB for
 *  `def=vox`), and a page must not wait on their host to render. The
 *  AUDIO is live — every `src` points at /api/audio, which streams from
 *  demo.1000trax.com on demand.
 *
 *  600 of roughly 10,000. The cap is in the script and exists because
 *  this array ships to the browser; the figure the marketing pages
 *  quote is the size of the library, not of this slice. */
/* The .ts extension is load-bearing: `node --test` strips types rather
   than bundling, so a relative value import has to name the real file.
   tsconfig has allowImportingTsExtensions for exactly this. */
import { CATALOGUE } from "./catalogue/catalogue.generated.ts";

export const TRACKS: Track[] = CATALOGUE;

export function trackById(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}

export type Filters = {
  genres: Genre[];
  mood: Mood | null;
  bpm: [number, number];
  /** null = don't care, true = only with vocals, false = only instrumental */
  vox: boolean | null;
  /** Empty = any language, exactly as `genres` above means any genre.
      Only narrows tracks that HAVE a vocal, so it is meaningless
      together with `vox: false` — the UI hides it there rather than
      offering a choice that can only return nothing. */
  langs: Lang[];
};

export const DEFAULT_FILTERS: Filters = {
  genres: [],
  mood: null,
  bpm: [BPM_MIN, BPM_MAX],
  vox: null,
  langs: [],
};

export function filterTracks(filters: Filters, tracks: Track[] = TRACKS): Track[] {
  return tracks.filter((t) => {
    if (filters.genres.length && !filters.genres.includes(t.genre)) return false;
    if (filters.mood && t.mood !== filters.mood) return false;
    if (t.bpm < filters.bpm[0] || t.bpm > filters.bpm[1]) return false;
    if (filters.vox !== null && t.vox !== filters.vox) return false;
    /* A language narrows to vocals in one of those languages. An
       instrumental has no language, so it cannot satisfy one — asking
       for Danish asks for Danish singing, not for silence that happens
       to be Danish. */
    if (filters.langs.length && (!t.vox || !t.lang || !filters.langs.includes(t.lang))) {
      return false;
    }
    return true;
  });
}

export function countByGenre(): Record<Genre, number> {
  const out = {} as Record<Genre, number>;
  for (const g of GENRES) out[g.id] = 0;
  for (const t of TRACKS) out[t.genre] += 1;
  return out;
}
