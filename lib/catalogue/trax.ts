/* ==================================================================== *
 *  1000TRAX — the catalogue behind Odatone
 *
 *  Odatone's music is served today by 1000trax, through the player at
 *  odatone.1000trax.com/app. This module is the seam between their wire
 *  format and ours: pure functions only, no fetching, so the mapping can
 *  be unit tested and so the transport can be replaced wholesale when the
 *  real API arrives.
 *
 *  ⚠️  PROVISIONAL. Every shape here was read off the live player's
 *  JavaScript and one anonymous call to /services/playlist. It is what
 *  their DEMO tier does, not a published contract:
 *
 *    - the audio host is hardcoded to demo.1000trax.com in their
 *      player.js, and every row says `hasShortVersion: true`, so these
 *      are trimmed files;
 *    - the files are unsigned and world-readable;
 *    - one pool returns its entire contents (2,163 tracks, 487 KB for
 *      `lounge`) with no paging.
 *
 *  docs/1000trax-api-requirements.md is what we need from them instead.
 *  Until that lands, treat this as a reading of their behaviour rather
 *  than an integration.
 * ==================================================================== */

import type { L10n } from "../i18n";
import type { Genre, Mood, Track } from "../tracks";

/** One row of `resultCompositions`, verbatim from their playlist service.
    The names are their database columns — `vc` for varchar, `i` for int,
    `d` for decimal — and are kept exactly as they arrive so that a diff
    against a future response is obvious. */
export type TraxComposition = {
  iCompositionID: number;
  vcTitle: string;
  /** Path segment, with or without its trailing slash — their own player
      appends one if it is missing, so this does too. */
  vcFolder: string;
  vcFile: string;
  iDuration: number;
  dBpm: number;
  hasShortVersion: boolean;
  filters: string;
  ageDays: number;
  randomizedSortVal: number;
};

export type TraxPlaylistResponse = {
  resultCompositions: TraxComposition[];
  resultFilters?: unknown;
};

/** Where their player resolves audio from (player.js:40). Named rather
    than inlined because this is the single most likely thing to change
    the day we get a real API — and the thing that decides whether we are
    serving customers short demo files. */
export const TRAX_DEMO_AUDIO_BASE = "https://demo.1000trax.com/";

/** Their eight genre codenames, from the config inlined into the player
    page. Listed for exhaustiveness, not because we choose them. */
export type TraxGenre =
  | "pop" | "lounge" | "bossa" | "jazz"
  | "slowjazz" | "rnb" | "funk" | "chillout";

/* -------------------------------------------------------------------- *
 *  Genre
 * -------------------------------------------------------------------- */

/** Their genres onto ours.
 *
 *  This mapping loses on both sides and that is worth stating plainly
 *  rather than hiding in a lookup:
 *
 *  - Three of OUR genres have nothing behind them — `electronic`,
 *    `hiphop` and `classical`. The Small Venue plan's feature list says
 *    "8 genrer" (lib/pricing.ts). On this catalogue that would be five.
 *  - Four of THEIRS collapse into ours: `lounge` and `chillout` both
 *    land on `ambient`, `slowjazz` joins `jazz`, `funk` joins `rnb`.
 *    A customer filtering by "ambient" gets two of their pools mixed.
 *
 *  Neither is a mapping bug; both are catalogue questions to settle
 *  before this ships. */
export const TRAX_GENRE: Record<TraxGenre, Genre> = {
  pop: "pop",
  rnb: "rnb",
  jazz: "jazz",
  slowjazz: "jazz",
  bossa: "acoustic",
  funk: "rnb",
  lounge: "ambient",
  chillout: "ambient",
};

/** Our genres with no 1000trax source at all. */
export const GENRES_WITHOUT_SOURCE: Genre[] = ["electronic", "hiphop", "classical"];

/* -------------------------------------------------------------------- *
 *  Mood → pool
 * -------------------------------------------------------------------- */

/** 1000trax has no concept of mood. It has genre pools and a BPM window,
    and a "pool definition" (`def`) is one or more genre codenames joined
    by underscores. So OUR five moods have to be expressed as a `def` plus
    a tempo range — which means Odatone owns "mood", and this table is
    where it lives.

    Composites are not free: each genre declares `combinableWith`, and the
    pairs below are drawn only from those declarations —

      pop ↔ jazz, lounge        jazz ↔ lounge, pop, rnb, slowjazz
      lounge ↔ jazz, pop        slowjazz ↔ jazz, chillout
      bossa ↔ rnb               rnb ↔ jazz, bossa
      chillout ↔ slowjazz       funk ↔ (nothing)

    ⚠️  The tempo windows are a first pass derived from each genre's own
    description and our MOODS blurbs, NOT from listening to the
    catalogue. They need an hour with the real pools before launch: a
    mood that lands wrong is the one thing a customer notices
    immediately. */
export type PoolDefinition = {
  /** The `def` parameter their playlist service takes. */
  def: string;
  /** Inclusive BPM window. 0–300 is their own "no preference" pair. */
  low: number;
  high: number;
  /** Why this pool, so the next person can argue with it. */
  rationale: string;
};

export const MOOD_POOL: Record<Mood, PoolDefinition> = {
  calm: {
    def: "slowjazz_chillout",
    low: 0,
    high: 95,
    rationale:
      "chillout is beatless and instrumental by their own description; slowjazz is a quiet piano trio. Morgenåbning, venteværelse, spa.",
  },
  focus: {
    def: "lounge",
    low: 85,
    high: 110,
    rationale:
      "lounge is 'pleasant and smooth, medium tempo' — present without asking for attention. Kontor, showroom, klinik.",
  },
  warm: {
    def: "bossa_rnb",
    low: 90,
    high: 115,
    rationale:
      "bossa's samba/jazz fusion with rnb's steady grooves. The only pair bossa declares. Frokost, butik, salon.",
  },
  evening: {
    def: "jazz_slowjazz",
    low: 70,
    high: 105,
    rationale: "jazz proper, softened by slowjazz. Middag, bar, hotel-lobby.",
  },
  energy: {
    def: "pop",
    low: 112,
    high: 300,
    rationale:
      "pop is their up-beat, vocal-led pool. `funk` would suit better but declares no combinable partner, so it can only be used alone — worth trying as an alternative.",
  },
};

/** The query their playlist service expects for a mood.
 *
 *  `history` is how their pool avoids repeats: the ids already played,
 *  comma-joined, handed back on the next request. Passing an empty string
 *  is what their own player does on a cold start. */
export function poolQuery(
  mood: Mood,
  { lang = "da", history = [] }: { lang?: "da" | "en"; history?: number[] } = {},
): Record<string, string> {
  const pool = MOOD_POOL[mood];
  return {
    def: pool.def,
    history: history.join(","),
    low: String(pool.low),
    high: String(pool.high),
    lang,
  };
}

/* -------------------------------------------------------------------- *
 *  Composition → Track
 * -------------------------------------------------------------------- */

/** What their response cannot give us, and what each gap costs.
    Exported so the requirements doc and the tests read from one list
    rather than drifting apart. */
export const TRAX_GAPS = {
  artist:
    "No artist on a composition. Their own player hardcodes `artist: settings.brandname` — every track is credited to 'Odatone'. /services/trax/{id} 404s anonymously, so credits may exist behind auth. Our /artister page and the claim that the music is 'indspillet af professionelle musikere' have no data behind them until this is answered.",
  localisedTitle:
    "`vcTitle` is one string. Our Track.title is an L10n pair. Track titles are arguably not translated anyway — but we should hear that from them rather than assume it.",
  vocals:
    "Vocals are a property of the POOL (`hasVocals`, `vocalsSelectable`) and of the `lang` parameter, not of a row. `filters` came back empty on every row sampled. Our Track.vox is per track, and the Small Venue feature list promises 'vokalstyring'.",
  peaks:
    "No waveform data. Our scrubber draws 180 normalised buckets. Either they supply peaks, or we generate them on ingest, or the scrubber degrades to a plain progress bar.",
  energy:
    "Derived from BPM here because they expose nothing else. That is a guess dressed as a number.",
} as const;

/** 1–5, where 1 is barely there and 5 drives the room. Derived from BPM
    alone — see TRAX_GAPS.energy. The thresholds bracket our own
    BPM_MIN/BPM_MAX (55–130) rather than their 0–300. */
export function energyFromBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 3;
  if (bpm < 75) return 1;
  if (bpm < 90) return 2;
  if (bpm < 105) return 3;
  if (bpm < 120) return 4;
  return 5;
}

/** Their folder + file, joined the way their own player joins them —
    appending the missing slash rather than assuming one. */
export function audioUrl(c: TraxComposition, base = TRAX_DEMO_AUDIO_BASE): string {
  const folder = c.vcFolder.endsWith("/") ? c.vcFolder : `${c.vcFolder}/`;
  return `${base}${folder}${c.vcFile}`;
}

export type ToTrackOptions = {
  /** The mood whose pool this composition came back from. Mood is ours,
      not theirs, so it can only come from what we asked for. */
  mood: Mood;
  /** Which of their genres the pool was built from. A composite `def`
      gives no per-row genre, so a multi-genre pool has to pick one — see
      the note in `toTrack`. */
  genre: TraxGenre;
  base?: string;
};

/** One of their compositions as one of our tracks.
 *
 *  Two fields are honestly unknowable from the response and are filled
 *  with placeholders rather than invented values:
 *
 *    - `artist` is the brand, exactly as their player does it, because
 *      no other name is on offer (TRAX_GAPS.artist);
 *    - `peaks` is empty, so a caller can tell "no waveform" from a flat
 *      one (TRAX_GAPS.peaks).
 *
 *  `genre` is passed in rather than read off the row. A composite pool
 *  like `bossa_rnb` returns rows that do not say which half they came
 *  from, so every track in it would be labelled the same — which is
 *  wrong for filtering and is the reason the requirements doc asks for a
 *  per-row genre. */
export function toTrack(c: TraxComposition, opts: ToTrackOptions): Track {
  const title: L10n = { da: c.vcTitle, en: c.vcTitle };
  return {
    id: `trax-${c.iCompositionID}`,
    title,
    artist: "Odatone",
    genre: TRAX_GENRE[opts.genre],
    mood: opts.mood,
    bpm: Math.round(c.dBpm),
    vox: false,
    energy: energyFromBpm(c.dBpm),
    duration: c.iDuration,
    src: audioUrl(c, opts.base),
    peaks: [],
  };
}

/** The whole response, mapped. Order is preserved: their
    `randomizedSortVal` means the pool arrives pre-shuffled, and
    re-sorting it here would throw away the only sequencing they give. */
export function toTracks(
  res: TraxPlaylistResponse,
  opts: ToTrackOptions,
): Track[] {
  return (res.resultCompositions ?? []).map((c) => toTrack(c, opts));
}
