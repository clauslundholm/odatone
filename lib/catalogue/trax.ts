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
import type { Genre, Lang, Mood, Track } from "../tracks";

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
  | "slowjazz" | "jazzy" | "rnb" | "funk" | "chillout"
  | "house" | "downbeat" | "unplugged";

/* -------------------------------------------------------------------- *
 *  Genre
 * -------------------------------------------------------------------- */

/** Their pools onto our genre ids.
 *
 *  Mapped by what the chip SAYS, not by what its id is called. Our ids
 *  are historical and the 2026 labels were re-badged over them
 *  (lib/tracks.ts): the id `jazz` is shown as "Bossa", `acoustic` as
 *  "Unplugged", `electronic` as "House", `hiphop` as "Downbeat". So
 *  their `bossa` pool belongs on our `jazz` id, and putting it on
 *  `acoustic` — as this table did while it was written from the ids —
 *  filed the bossa catalogue under Unplugged.
 *
 *  Reading /services/playlist/metrics rather than their player config
 *  turned up three pools we had no idea existed, and they happen to be
 *  exactly the three chips we were about to ship with nothing behind
 *  them: `house` (312 tracks), `downbeat` (261) and `unplugged` (925).
 *
 *  Still lossy in one direction: `lounge` and `chillout` both land on
 *  `ambient`, `slowjazz`/`jazzy` join `jazz`, `funk` joins `rnb`. A
 *  customer filtering by Chillout gets two of their pools mixed. */
export const TRAX_GENRE: Record<TraxGenre, Genre> = {
  pop: "pop",            // Pop
  rnb: "rnb",            // R&B
  funk: "rnb",           // R&B
  bossa: "jazz",         // Bossa
  jazz: "jazz",          // Bossa
  slowjazz: "jazz",      // Bossa
  jazzy: "jazz",         // Bossa
  lounge: "ambient",     // Chillout
  chillout: "ambient",   // Chillout
  house: "electronic",   // House
  downbeat: "hiphop",    // Downbeat
  unplugged: "acoustic", // Unplugged
};

/** Our genres with no 1000trax pool at all. Down to one: there is no
    classical pool anywhere in their 156 metric sets, so the Klassisk
    chip promises a catalogue that does not exist. */
export const GENRES_WITHOUT_SOURCE: Genre[] = ["classical"];

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
    def: "jazz",
    low: 70,
    high: 105,
    /* Was `jazz_slowjazz`, which their genre config said was combinable
       and which /services/playlist/metrics says is not a pool they
       build. Their 156 sets have `jazz`, `slowjazz`, `lounge_jazz` and
       `jazz_rnb`, but no `jazz_slowjazz` — so this asked for a pool
       that does not exist. */
    rationale: "jazz proper, 812 tracks. Middag, bar, hotel-lobby.",
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
 *  Mood, derived
 * -------------------------------------------------------------------- */

/** Mood is ours and theirs is genre, so going the other way — from one
 *  of their pools to one of our five moods — is a judgement call, and
 *  this table is where it lives rather than being spread through the
 *  ingest.
 *
 *  Why derive it at all: a composite pool like `bossa_rnb` returns rows
 *  that do not say which half they came from, so anything ingested
 *  through one is mislabelled by construction. Ingesting SINGLE-genre
 *  pools instead makes genre exact, and mood then has to be computed
 *  from the genre plus the track's own tempo.
 *
 *  ⚠️  Same caveat as MOOD_POOL, and it has not been discharged: these
 *  are read off each pool's own description, not off listening to the
 *  catalogue. A mood that lands wrong is the first thing a customer
 *  notices. */
export const MOOD_FROM_GENRE: Record<TraxGenre, Mood> = {
  chillout: "calm",
  slowjazz: "calm",
  downbeat: "calm",
  lounge: "focus",
  unplugged: "warm",
  bossa: "warm",
  rnb: "warm",
  funk: "warm",
  jazz: "evening",
  jazzy: "evening",
  pop: "energy",
  house: "energy",
};

/** The genre's mood, nudged at the two extremes where tempo overrules
    it: nothing under 70 BPM drives a room, and nothing over 118 fails
    to. Between those the genre decides. */
export function moodFor(genre: TraxGenre, bpm: number): Mood {
  if (Number.isFinite(bpm) && bpm > 0) {
    if (bpm < 70) return "calm";
    if (bpm >= 118) return "energy";
  }
  return MOOD_FROM_GENRE[genre];
}

/** A pool we can file a row from without guessing: exactly one genre,
    so the genre is certain, and at most one language, so the language
    is too. `lounge_mix_english_danish` fails both halves — a row from
    it could be either language — and is left out of the ingest. */
export function isUnambiguous(pool: UsablePool): boolean {
  return pool.facets.genres.length === 1 && pool.facets.langs.length <= 1 && !pool.facets.mix;
}

/* -------------------------------------------------------------------- *
 *  Advertising
 * -------------------------------------------------------------------- */

/** A row from the `Effects/` folder: 1000trax's own advertising, mixed
    into every demo-tier response. These carry a different shape from a
    composition — no meaningful `dBpm`, no `hasShortVersion` — so they
    are typed apart rather than squeezed into TraxComposition. */
export type TraxEffect = {
  iCompositionID: number;
  vcTitle: string;
  vcFolder: string;
  vcFile: string;
  iDuration: number;
};

export type TraxRow = TraxComposition | TraxEffect;

/** The demo tier injects its own ads, and not sparingly: one call to
    `def=vox&low=80&high=120` came back with 9,952 rows of which 3,317
    were `Effects/1000trax.com.voiceover.only-*.mp3`. A third of the
    feed is a voiceover advertising 1000trax.

    Odatone sells rooms their own music. Playing a supplier's
    advertising into a customer's café would be a surprise to the
    customer and a competitor's billboard in their room, so these are
    dropped on the way in and never reach a Track. */
export function isAdvertisement(row: TraxRow): boolean {
  const folder = (row.vcFolder ?? "").replace(/\/+$/, "");
  return folder === "Effects" || row.iCompositionID < 0;
}

/** Every real composition in a response, in the order it arrived. */
export function musicOnly(rows: TraxRow[] | undefined | null): TraxComposition[] {
  return (rows ?? []).filter((r): r is TraxComposition => !isAdvertisement(r));
}

/* -------------------------------------------------------------------- *
 *  Pool names
 * -------------------------------------------------------------------- */

/** Their language words onto our codes. `languagesAvailable` on the
    metrics endpoint is exactly `["en","it","es","da"]` — four, where
    our Sprog filter offered nine. */
export const LANG_WORD: Record<string, Lang> = {
  english: "en",
  italian: "it",
  spanish: "es",
  danish: "da",
};

/** What a pool name says about its contents.
 *
 *  Pool names are underscore-joined facets — `lounge_mix_english_danish`
 *  is the lounge catalogue, mixed, sung in English or Danish. Parsing
 *  them is how we learn a track's vocals and language, because the rows
 *  carry neither (TRAX_GAPS.vocals) and the `lang` QUERY parameter does
 *  not mean what it looks like: `def=vox&lang=da` returns Spanish-titled
 *  music alongside a Danish-voiced advert, so `lang` picks the language
 *  of the jingle, not of the singing. */
export type PoolFacets = {
  genres: TraxGenre[];
  langs: Lang[];
  /** true from `_vox` or from naming a language, false from `_novox`,
      null when the pool says nothing either way. */
  vox: boolean | null;
  mix: boolean;
  /** Tokens we have no meaning for. A pool carrying any of these is one
      we do not understand well enough to file, so `usablePools` skips
      it rather than guessing. */
  unknown: string[];
};

export function parsePoolName(name: string): PoolFacets {
  const genres: TraxGenre[] = [];
  const langs: Lang[] = [];
  const unknown: string[] = [];
  let vox: boolean | null = null;
  let mix = false;

  for (const token of name.split("_")) {
    if (token === "vox") { vox = true; continue; }
    if (token === "novox") { vox = false; continue; }
    if (token === "mix") { mix = true; continue; }
    if (token in LANG_WORD) { langs.push(LANG_WORD[token]); continue; }
    if (token in TRAX_GENRE) { genres.push(token as TraxGenre); continue; }
    unknown.push(token);
  }

  /* Naming a language is naming a vocal: you cannot sing in Danish
     without singing. `_novox` still wins, because a pool that says so
     outright beats one that only implies the opposite. */
  if (vox === null && langs.length > 0) vox = true;

  return { genres, langs, vox, mix, unknown };
}

/* -------------------------------------------------------------------- *
 *  Metrics
 * -------------------------------------------------------------------- */

export type TraxMetricSet = {
  lowMinimum: number;
  lowMaximum: number;
  tempoSelection: boolean;
  visibleForSelection: boolean;
  id: number;
  formula: string;
  stats?: { columns: string[]; rows: number[][] };
};

export type TraxMetrics = {
  languagesAvailable: string[];
  metricSets: Record<string, TraxMetricSet>;
};

/** How many tracks a pool holds, summed over its tempo buckets. The
    column index is read off `columns` rather than assumed, because the
    stats table is the one part of their response that looks generated. */
export function poolTrackCount(set: TraxMetricSet): number {
  const stats = set?.stats;
  if (!stats || !Array.isArray(stats.rows)) return 0;
  const col = Array.isArray(stats.columns) ? stats.columns.indexOf("tracks") : -1;
  const i = col >= 0 ? col : 1;
  return stats.rows.reduce((n, row) => n + (Number(row?.[i]) || 0), 0);
}

export type UsablePool = {
  name: string;
  facets: PoolFacets;
  tracks: number;
  lowMinimum: number;
  lowMaximum: number;
};

/** The pools we can file into our catalogue: visible in their own
    picker, non-empty, carrying at least one genre we map, and using no
    token we cannot read. What it drops from their 156 sets is `xmas`,
    `medit_inst`, `chillout_piano`, `mix_limited`, and the bare language
    and vox pools — all of which name no genre we show. */
export function usablePools(metrics: TraxMetrics): UsablePool[] {
  const sets = metrics?.metricSets ?? {};
  const out: UsablePool[] = [];
  for (const name of Object.keys(sets)) {
    const set = sets[name];
    if (!set || set.visibleForSelection === false) continue;
    const facets = parsePoolName(name);
    if (facets.genres.length === 0 || facets.unknown.length > 0) continue;
    const tracks = poolTrackCount(set);
    if (tracks <= 0) continue;
    out.push({ name, facets, tracks, lowMinimum: set.lowMinimum, lowMaximum: set.lowMaximum });
  }
  return out.sort((a, b) => b.tracks - a.tracks);
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
  duration:
    "`iDuration` is the COMPOSITION's length; the file served from MusicShort/ is a 60-second cut of it. A row saying 239s resolves to 960,723 bytes, which at 128 kbps is 60s exactly, and the dock reads 1:00 off the loaded metadata while the list beside it says 3:59. Every runtime we print — a list's '52 min', a schedule block's fill — is computed from iDuration and is therefore the length of music we are not currently serving. Nothing here is wrong; the demo tier is. See docs/1000trax-api-requirements.md §2.2.",
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

/** Where the dock is pointed instead.
 *
 *  demo.1000trax.com answers with `Access-Control-Allow-Origin:
 *  1000trax.com` — a bare host, which is not a legal origin and so can
 *  never match ours. Our player sets `crossOrigin = "anonymous"`
 *  because the spectrum runs off an AnalyserNode, and a CORS-anonymous
 *  request whose ACAO does not match is a network error: the element
 *  fires `error` and nothing plays. Dropping crossOrigin loads the file
 *  but taints the element, and a tainted source connected to Web Audio
 *  is silenced outright in Chrome.
 *
 *  So the bytes come back through our own origin instead
 *  (app/api/audio/[...path]/route.ts). The day they return a usable
 *  header, this becomes `audioUrl` again and the route can go. */
export const AUDIO_PROXY_PREFIX = "/api/audio/";

export function proxiedAudioUrl(c: TraxComposition): string {
  const folder = c.vcFolder.endsWith("/") ? c.vcFolder : `${c.vcFolder}/`;
  return `${AUDIO_PROXY_PREFIX}${folder}${c.vcFile}`;
}

/* -------------------------------------------------------------------- *
 *  Short and full
 * -------------------------------------------------------------------- */

/** The 60-second cut every row points at. `hasShortVersion: true` on
    every composition sampled, and the arithmetic agrees: 960,723 bytes
    at 128 kbps is 60s exactly. */
export const DEMO_FOLDER = "MusicShort";

/** The whole composition, same host and same filename, one folder up.
    5,852,472 bytes at 192 kbps is 244s, which is what `iDuration` said
    all along — so with this folder the runtimes we print finally
    describe the music that plays (TRAX_GAPS.duration).

    Not a secret: it is as unsigned and world-readable as the short cut.
    The line between them is a product decision — a visitor hears a
    minute, a paying customer hears the record — and it is drawn in the
    route handler, where a session can actually be checked. */
export const FULL_FOLDER = "Music";

/** Which version a given listener should be served.
 *
 *  Only ever rewrites our own proxy paths, so anything else — a local
 *  file, an absolute URL — is handed back untouched. The route makes
 *  the same decision independently and does not trust this one: a
 *  client asking for the full folder without a session is sent to the
 *  short one. */
export function sourceFor(src: string, fullLength: boolean): string {
  const short = `${AUDIO_PROXY_PREFIX}${DEMO_FOLDER}/`;
  if (!fullLength || !src.startsWith(short)) return src;
  return `${AUDIO_PROXY_PREFIX}${FULL_FOLDER}/${src.slice(short.length)}`;
}

export type ToTrackOptions = {
  /** The mood whose pool this composition came back from. Mood is ours,
      not theirs, so it can only come from what we asked for. */
  mood: Mood;
  /** Which of their genres the pool was built from. A composite `def`
      gives no per-row genre, so a multi-genre pool has to pick one — see
      the note in `toTrack`. */
  genre: TraxGenre;
  /** Whether the pool sings, from its name (`_vox` / `_novox`). Null
      when the pool does not say, which is the only honest answer. */
  vox?: boolean | null;
  /** Which language it sings in, from the pool name. Only meaningful
      alongside `vox: true`; a language on an instrumental is dropped. */
  lang?: Lang | null;
  /** Fetch the audio straight from this base instead of through our own
      origin. Only for tooling that is not a browser — see
      `proxiedAudioUrl` for why the player cannot. */
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
    /* Vocals are a property of the POOL, never of a row
       (TRAX_GAPS.vocals): `filters` was empty on every row sampled.
       Reading them off the pool NAME is what makes this knowable —
       `lounge_novox` is instrumental, `pop_danish` is sung in Danish.
       A pool that says neither leaves us with no evidence, and
       `false` is the safer of the two guesses: calling a vocal track
       instrumental hides it from a filter, where the reverse would
       play singing into a room that asked for none. */
    vox: opts.vox === true,
    /* A language only means something attached to a vocal, so an
       instrumental gets null however the pool was named. */
    lang: opts.vox === true ? (opts.lang ?? null) : null,
    energy: energyFromBpm(c.dBpm),
    duration: c.iDuration,
    src: opts.base ? audioUrl(c, opts.base) : proxiedAudioUrl(c),
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
