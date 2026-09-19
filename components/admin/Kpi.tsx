import Link from "next/link";

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
 *
 * `tone="warn"` colours the figure with `--c-warn` — for a tile drawing
 * attention to something needing action (a queue of pending signups), not
 * a fact reported at face value. `href` makes the whole tile a link to
 * that queue; the tile stays a plain `<dl>` when omitted, unchanged from
 * before either prop existed.
 */
export function Kpi({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "warn";
}) {
  const body = (
    <>
      <dt className="u-label">{label}</dt>
      <dd className={`u-num text-[1.75rem] ${tone === "warn" ? "text-warn" : "text-ink"}`}>{value}</dd>
      {hint && <dd className="text-[0.8125rem] text-ink-2">{hint}</dd>}
    </>
  );

  if (!href) {
    return (
      <dl className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-5">
        {body}
      </dl>
    );
  }

  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-5 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <dl className="contents">{body}</dl>
    </Link>
  );
}
