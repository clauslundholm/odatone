/* Pure form-parsing/validation for the products editor (Task 12's fix
   round), kept apart from actions.ts (which imports "use server" and
   lib/supabase/server.ts's next/headers-dependent createClient — neither
   resolves under plain `node --test`) so this logic can be unit tested
   directly, the same boundary lib/plans-row.ts already draws against
   lib/plans-server.ts. */

/* Digits with an optional 1-2 digit decimal part, no leading/trailing junk.
   `Number("")` is 0 and `Number(" ")` is also 0 — both pass a naive
   `Number.isFinite(x) && x >= 0` check — so this task's fix round caught a
   blank price field saving as `monthly_ore = 0` and /da/priser advertising
   "0 kr." with no error shown anywhere. Validating the raw string first,
   before any coercion, is what closes that: a value that doesn't match this
   shape is rejected outright, never coerced into a number at all. */
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

/** Returns the price in kroner, or null if `raw` isn't a plain non-negative
    number (blank, letters, a minus sign, scientific notation, ...). */
export function parsePriceKr(raw: string): number | null {
  const trimmed = raw.trim();
  if (!PRICE_RE.test(trimmed)) return null;
  return Number(trimmed);
}

/** Same "reject before coercing" mistake was possible for `max_m2`: a blank
    field is a deliberate "unbounded" (`null`), but anything else that isn't
    a positive whole number must be an error, not a second way to spell
    "unbounded" — this task's fix round found `Number("abc")` (`NaN`) being
    written to `max_m2` as `null` via `maxM2raw === "" ? null : Number(...)`,
    which silently made the plan unbounded and, because `planForM2` now
    reads this column, wrongly captured every venue's recommendation. */
export function parseMaxM2(raw: string): { value: number | null } | null {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 ? { value: n } : null;
}

/** Parses one line-per-feature textarea into the `L10n[]` shape `plans.features`
    stores, pairing Danish and English lines by position. An entry blank in
    *both* languages is dropped (this is also what absorbs the textarea's own
    trailing newline); an entry blank in only one language is kept as-is —
    that's a real, visible content gap for a translator to fill in, not
    something this action should guess at or silently discard. */
export function parseFeatures(da: string, en: string): { da: string; en: string }[] {
  const daLines = da.split("\n").map((s) => s.trim());
  const enLines = en.split("\n").map((s) => s.trim());
  const count = Math.max(daLines.length, enLines.length);
  const out: { da: string; en: string }[] = [];
  for (let i = 0; i < count; i++) {
    const daVal = daLines[i] ?? "";
    const enVal = enLines[i] ?? "";
    if (daVal === "" && enVal === "") continue;
    out.push({ da: daVal, en: enVal });
  }
  return out;
}
