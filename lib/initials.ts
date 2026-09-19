/**
 * The one- or two-letter monogram the sidebar's avatar tiles show
 * (components/admin/WorkspaceCard.tsx, components/admin/UserCard.tsx).
 *
 * Both call sites render real, user-supplied text — a company name typed
 * into the signup form, a profile's full name, an email address — so this
 * has to survive whatever arrives: empty strings, a single word, leading
 * punctuation, and names outside A–Z. `toLocaleUpperCase` rather than
 * `toUpperCase` because Odatone's customers are Danish: the two agree on
 * æ/ø/å, but not on every locale, and the cost of being right is nothing.
 *
 * Returns "" for input with no letters or digits at all, rather than a
 * stray glyph — the callers render a neutral tile in that case.
 */

/* Danish, Nordic and common international legal forms. Without this,
   "Nordisk Webshop A/S" monograms as NS — the S of A/S — where a reader
   expects NW, because the suffix names the company's legal form rather
   than the company. Anchored to the end and applied once: a firm called
   "A/S Storebælt" keeps its leading token, and only the last suffix is
   stripped. */
const LEGAL_FORM =
  /[\s,]+(a\/s|aps|ivs|p\/s|k\/s|i\/s|s\/a|as|ab|ag|oy|oyj|ltd|limited|inc|llc|llp|plc|gmbh|ug|bv|nv|sa|sas|sarl|srl|spa|pty)\.?$/iu;

export function initials(name: string | null | undefined): string {
  if (!name) return "";

  const trimmed = name.trim().replace(LEGAL_FORM, "");

  // Split on anything that isn't a letter or a digit, so "Nordisk Webshop"
  // gives NW and "claus@lundholm.com" gives CL.
  const words = (trimmed || name).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return "";

  const first = [...words[0]][0] ?? "";
  // A single word contributes only its first letter. Taking its second
  // character too would read as two initials ("Odatone" → "OD") and
  // collide with genuinely two-word names.
  const second = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";

  return (first + second).toLocaleUpperCase("da-DK");
}
