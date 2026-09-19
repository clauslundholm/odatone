/** Splits a usage bar into the part within the plan's bound and the part past
    it. Percentages are of the whole bar, so they always sum to 0 or 100 and a
    caller can render them as two flexed segments. */
export function meterSegments(used: number, limit: number | null) {
  if (limit === null) return { inPct: used > 0 ? 100 : 0, overPct: 0 };
  if (limit <= 0) return { inPct: 0, overPct: used > 0 ? 100 : 0 };
  if (used <= 0) return { inPct: 0, overPct: 0 };
  if (used <= limit) return { inPct: Math.round((used / limit) * 100), overPct: 0 };
  const inPct = Math.round((limit / used) * 100);
  return { inPct, overPct: 100 - inPct };
}
