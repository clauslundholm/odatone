import { PHOTO } from "./photos";

/* ==================================================================== *
 *  How a saved list looks
 *
 *  A customer's playlist is a row they named themselves, so it carries
 *  no artwork and no colour. The Ugeplan needs both: a week is read by
 *  colour at a glance, and a block that changed hue between visits would
 *  have to be read again.
 *
 *  Two sources, in order:
 *
 *   - `based_on`, the curated list it was copied from (playlists.based_on
 *     in 0015). A list made from Morgenåbning should look like it.
 *   - failing that, a hash of the id, which is stable for the life of
 *     the row and spreads evenly across the palette.
 * ==================================================================== */

export type ListLook = { from: string; to: string; photo: string };

/* Pairs rather than single hues: the block is a gradient under a
   photograph, and a flat tint behind a picture reads as a mistake. */
const PALETTE: ListLook[] = [
  { from: "#fbbf24", to: "#f472b6", photo: PHOTO.barista },
  { from: "#34d399", to: "#0ea5e9", photo: PHOTO.terrace },
  { from: "#fb923c", to: "#ef4444", photo: PHOTO.cafeGuitar },
  { from: "#c084fc", to: "#ec4899", photo: PHOTO.bar },
  { from: "#818cf8", to: "#7c3aed", photo: PHOTO.sax },
  { from: "#38bdf8", to: "#6366f1", photo: PHOTO.desk },
  { from: "#94a3b8", to: "#0ea5e9", photo: PHOTO.piano },
  { from: "#f43f5e", to: "#f59e0b", photo: PHOTO.dj },
  { from: "#e879f9", to: "#6366f1", photo: PHOTO.stage },
  { from: "#f59e0b", to: "#9a3412", photo: PHOTO.cello },
  { from: "#d77a6b", to: "#3b1c18", photo: PHOTO.singer },
  { from: "#a8b48f", to: "#2a3022", photo: PHOTO.club },
];

/* Keyed by the curated list's own id (CURATED in components/v4/Landing)
   and by the Danish name, because `based_on` is free text written when
   the copy was made and may hold either. */
const BY_SOURCE: Record<string, number> = {
  morning: 0, "morgenåbning": 0,
  lunch: 1, frokostpuls: 1,
  friday: 3, "fredag kl. 17": 3,
  evening: 8, "dansk på anlægget": 8,
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function listLook(list: { id: string; basedOn?: string | null }): ListLook {
  const keyed = list.basedOn ? BY_SOURCE[list.basedOn.trim().toLowerCase()] : undefined;
  return PALETTE[keyed ?? hash(list.id) % PALETTE.length]!;
}

/** The tile behind a list's name: the photograph, with its own gradient
    underneath so a slow image never shows as a hole. */
export function listTile(look: ListLook): string {
  return `url(${look.photo}) center/cover no-repeat, linear-gradient(135deg, ${look.from}, ${look.to})`;
}
