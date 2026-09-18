/**
 * One tile of the four-up dashboard grid: a label and a large tabular-nums
 * figure. `value` is a caller-formatted string (e.g. via `formatDkk`) —
 * this component only lays it out, so it never re-derives a currency or
 * locale decision that belongs to the page rendering it.
 *
 * `<dl>`/`<dt>`/`<dd>` rather than sibling `<span>`s: a definition list
 * makes the label→value association explicit in the accessibility tree
 * instead of relying on reading order, which a screen reader's table or
 * heading navigation mode does not preserve.
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
    <dl className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-5">
      <dt className="u-label">{label}</dt>
      <dd className="u-num text-[1.75rem] text-ink">{value}</dd>
      {hint && <dd className="text-[0.8125rem] text-ink-2">{hint}</dd>}
    </dl>
  );
}
