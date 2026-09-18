import { meterSegments } from "@/lib/meter";

/**
 * A usage bar split into what's within the plan's bound (accent) and what's
 * past it (warn). `limit === null` means unbounded — see `meterSegments`.
 */
export function Meter({
  used,
  limit,
  label,
  unit = "m²",
}: {
  used: number;
  limit: number | null;
  label?: string;
  unit?: string;
}) {
  const { inPct, overPct } = meterSegments(used, limit);
  const over = overPct > 0;
  const unbounded = limit === null;

  /* The ARIA `meter` role requires a real aria-valuemax: an absent one
     defaults to 100 per spec, which would announce an unbounded 5000 m²
     venue as "5000 out of 100" — exactly as wrong as a mis-drawn bar,
     just for screen-reader users. An unbounded plan isn't a meter at all
     (there is nothing to be a fraction of), so it drops the role and
     states the figure directly instead of forcing a fraction that doesn't
     exist. A bounded plan keeps the meter semantics, with a finite max.

     The fill itself is skipped entirely for the unbounded case, rather
     than drawn at meterSegments' inPct: 100 — a full accent bar reads as
     "at capacity" to anyone scanning by colour and shape alone, which is
     backwards for the one plan that can never be outgrown: it would look
     the worst of all of them. An empty, neutral track paired with the "no
     limit" text below is the honest picture — there is nothing to fill
     toward. */
  const bar = (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2"
      {...(unbounded
        ? { role: "img" as const, "aria-label": `${used} ${unit}, no limit on this plan` }
        : { role: "meter" as const, "aria-valuenow": used, "aria-valuemin": 0, "aria-valuemax": limit })}
    >
      {!unbounded && <div className="h-full bg-accent" style={{ width: `${inPct}%` }} />}
      {!unbounded && over && <div className="h-full bg-warn" style={{ width: `${overPct}%` }} />}
    </div>
  );

  /* Always rendered, with or without a caller-supplied `label` — this used
     to be gated behind `label`, which meant a caller that only wanted the
     bar (no caption) also silently lost the numeric readout: the m² figure
     existed only in aria-valuenow/aria-label, invisible to a sighted user
     looking at a bare coloured bar. The caption is still optional; the
     number itself is not. */
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        {label && <span className="text-ink-2">{label}</span>}
        <span className={`u-tabular ${over ? "text-warn" : "text-ink-2"}`}>
          {used} {unbounded ? `${unit} · no limit` : `/ ${limit} ${unit}`}
        </span>
      </div>
      {bar}
    </div>
  );
}
