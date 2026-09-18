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

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
          <span className="text-ink-2">{label}</span>
          <span className={`u-tabular ${over ? "text-warn" : "text-ink-2"}`}>
            {used} {limit !== null ? `/ ${limit} ${unit}` : unit}
          </span>
        </div>
      )}
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit ?? undefined}
      >
        <div className="h-full bg-accent" style={{ width: `${inPct}%` }} />
        {over && <div className="h-full bg-warn" style={{ width: `${overPct}%` }} />}
      </div>
    </div>
  );
}
