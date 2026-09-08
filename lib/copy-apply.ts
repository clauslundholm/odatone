/** Overrides for one locale: the text as written in lib/content, mapped to
    whatever it was edited to. */
export type Overrides = Record<string, string>;

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
