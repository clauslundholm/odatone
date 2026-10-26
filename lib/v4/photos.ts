import type { Genre, Mood } from "@/lib/tracks";

/* ==================================================================== *
 *  The landing page's photography
 *
 *  Twelve rooms, exported from the Figma file (eGYnPRF7Wo6D3GY1GB8Dh6,
 *  "Web v3 · Forside") into public/v4. The design reuses the same pool
 *  across the hero, the mood tiles, the curated lists, the musicians and
 *  the genre tiles — the mapping below is the one the frame actually
 *  shows, read off it rather than guessed.
 *
 *  Kept in one file because none of it survives the real catalogue: when
 *  1000TRAX returns artwork (docs/1000trax-api-requirements.md §2.5) the
 *  tiles read `track.artwork` and this module goes. Scattering the paths
 *  through the components would make that a hunt.
 * ==================================================================== */

const P = "/v4";

export const PHOTO = {
  bar: `${P}/photo-bar.jpg`,
  barista: `${P}/photo-barista.jpg`,
  cafeGuitar: `${P}/photo-cafe-guitar.jpg`,
  cello: `${P}/photo-cello.jpg`,
  club: `${P}/photo-club.jpg`,
  desk: `${P}/photo-desk.jpg`,
  dj: `${P}/photo-dj.jpg`,
  piano: `${P}/photo-piano.jpg`,
  sax: `${P}/photo-sax.jpg`,
  singer: `${P}/photo-singer.jpg`,
  stage: `${P}/photo-stage.jpg`,
  terrace: `${P}/photo-terrace.jpg`,
} as const;

export const HERO_PHOTO = PHOTO.bar;

/** One per mood, so the rail thumbnail and the tile show the same room. */
export const MOOD_PHOTO: Record<Mood, string> = {
  calm: PHOTO.cafeGuitar,
  focus: PHOTO.desk,
  warm: PHOTO.terrace,
  evening: PHOTO.sax,
  energy: PHOTO.dj,
};

/** Keyed by the curated list's id in components/v4/Landing.tsx. */
export const CURATED_PHOTO: Record<string, string> = {
  morning: PHOTO.barista,
  lunch: PHOTO.terrace,
  friday: PHOTO.bar,
  evening: PHOTO.stage,
};

/* Genres and musicians are positional rather than keyed: our genre ids
   are not the design's (it shows 1000TRAX's Chillout/House/Bossa/…), and
   the musicians come off the catalogue, so neither list can be matched by
   name. Indexing by position reproduces the row the frame shows and keeps
   working when the names underneath change. */
const GENRE_ORDER = [
  PHOTO.desk,
  PHOTO.club,
  PHOTO.terrace,
  PHOTO.cafeGuitar,
  PHOTO.sax,
  PHOTO.singer,
  PHOTO.dj,
  PHOTO.cello,
];

const ARTIST_ORDER = [
  PHOTO.piano,
  PHOTO.desk,
  PHOTO.barista,
  PHOTO.singer,
  PHOTO.cafeGuitar,
  PHOTO.club,
  PHOTO.stage,
  PHOTO.cello,
];

export function genrePhoto(index: number): string {
  return GENRE_ORDER[index % GENRE_ORDER.length]!;
}

export function artistPhoto(index: number): string {
  return ARTIST_ORDER[index % ARTIST_ORDER.length]!;
}

/** The cover a track gets until the catalogue carries artwork. Keyed off
    the mood so a track's tile matches the mood row it came from. */
export function trackPhoto(mood: Mood): string {
  return MOOD_PHOTO[mood];
}

/* Re-exported so a caller can type the genre argument without importing
   lib/tracks twice. */
export type { Genre, Mood };
