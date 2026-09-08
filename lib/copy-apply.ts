/** Overrides for one locale: the text as written in lib/content, mapped to
    whatever it was edited to. */
export type Overrides = Record<string, string>;

/** The key an edit belongs under, which is always the string as lib/content
    writes it — never the text currently on screen.

    Once a string has been edited, the page renders the override, so that is
    what the browser sends back the next time it is edited. Storing an entry
    under that text would put it beyond the reach of `applyCopy`, which only
    ever looks strings up as lib/content spells them: the page would keep
    rendering the first edit however many times it was changed afterwards.
    So an edit whose `from` is some override's value is folded back onto the
    key that produced it.

    Being a key already wins over being another override's value, so editing a
    string that happens to equal what something else was edited to still
    targets itself. */
export function resolveKey(from: string, overrides: Overrides): string {
  if (Object.prototype.hasOwnProperty.call(overrides, from)) return from;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === from) return key;
  }
  return from;
}

/** Returns a structural copy of `value` with every string that has an
    override swapped for it. The input is never mutated, so the imported
    content modules stay pristine across requests. */
export function applyCopy<T>(value: T, overrides: Overrides): T {
  if (typeof value === "string") {
    const hit = overrides[value];
    return (hit === undefined ? value : hit) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyCopy(item, overrides)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = applyCopy(item, overrides);
    }
    return out as T;
  }
  return value;
}
