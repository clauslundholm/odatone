/**
 * One tile of the four-up dashboard grid: a label and a large tabular-nums
 * figure. `value` is a caller-formatted string (e.g. via `formatDkk`) —
 * this component only lays it out, so it never re-derives a currency or
 * locale decision that belongs to the page rendering it.
 */
export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-5">
      <span className="u-label">{label}</span>
      <span className="u-num text-[1.75rem] text-ink">{value}</span>
      {hint && <span className="text-[0.8125rem] text-ink-2">{hint}</span>}
    </div>
  );
}
