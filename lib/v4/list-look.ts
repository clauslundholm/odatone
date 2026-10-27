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

/** `light` carries the hue — it tints the block on a white page and
    draws the left-hand bar in both themes. `dark` is the same hue taken
    most of the way to black, and is the block's whole background on a
    dark page.
 *
 *  Two colours rather than one because a single hue cannot do both
 *  jobs. A tint light enough to read black text on vanishes against a
 *  dark page; a ground dark enough to read white text on is mud on a
 *  light one. The pairs below are the prototype's own. */
export type ListLook = { light: string; dark: string; photo: string };

const PALETTE: ListLook[] = [
  { light: "#cdb08a", dark: "#3a2f22", photo: PHOTO.barista },
  { light: "#b48ae0", dark: "#2a1840", photo: PHOTO.terrace },
  { light: "#d98a5f", dark: "#3f2318", photo: PHOTO.cafeGuitar },
  { light: "#e0a35a", dark: "#3d2610", photo: PHOTO.bar },
  { light: "#8f86e8", dark: "#1e1b45", photo: PHOTO.sax },
  { light: "#a8b48f", dark: "#2a3022", photo: PHOTO.desk },
  { light: "#80b2c6", dark: "#1e3138", photo: PHOTO.piano },
  { light: "#d26ee6", dark: "#33133d", photo: PHOTO.dj },
  { light: "#d77a6b", dark: "#3b1c18", photo: PHOTO.stage },
  { light: "#e08a3c", dark: "#3e200c", photo: PHOTO.cello },
  { light: "#7fb0a3", dark: "#16302b", photo: PHOTO.singer },
  { light: "#c9a05f", dark: "#332413", photo: PHOTO.club },
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
  return `url(${look.photo}) center/cover no-repeat, linear-gradient(135deg, ${look.light}, ${look.dark})`;
}

/** The custom properties a block, a swatch or a bar reads its colours
    from. Handed to the element as a style; globals.css decides per
    theme which of the two each surface uses. */
export function lookVars(look: ListLook): Record<string, string> {
  return { "--c1": look.light, "--c2": look.dark, "--im": `url(${look.photo})` };
}
