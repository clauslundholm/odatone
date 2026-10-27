import Link from "next/link";
import type { ReactNode } from "react";

import { meterSegments } from "@/lib/meter";

/* The small caps label over a figure, a field or a table column.
   Not globals.css's own .u-label, which is a plain 13px grey line used
   under form fields across the marketing site: inside these cards the
   label has to recede behind the value it names, and letter-spaced
   uppercase at 11px is what does that without a second colour. */
const LABEL = "text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3";

/**
 * The pieces every Konto tab is built from.
 *
 * Deliberately not components/admin/{Panel,Badge,Meter,TableCard}: those
 * are drawn for the staff console — a bordered 14px card on a flat page,
 * a 6px status rectangle, a meter that stacks its figure above its bar.
 * The account lives inside the product shell, where the surface language
 * is the shadowed 28px `u-card` the rail and the hero already use, and
 * mixing the two reads as two products in one window. The data and the
 * status *words* are shared (lib/content/portal.ts); only the dressing
 * is local.
 */

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  /** The one control in the panel's header — "Redigér", "Skift plan". */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="u-card flex min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {action}
      </header>
      <div className="flex min-w-0 flex-1 flex-col p-6">{children}</div>
    </section>
  );
}

/** A panel whose body is a table, so the rows can run edge to edge. */
export function TablePanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="u-card flex min-w-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {action}
      </header>
      {/* Horizontally scrollable rather than wrapped: a four-column table
          of names and figures squeezed onto a phone becomes unreadable
          long before it becomes narrow enough. */}
      <div className="oda-scroll min-w-0 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">{children}</table>
      </div>
    </section>
  );
}

export function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={`${LABEL} border-b border-line px-6 py-3 ${right ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  muted = false,
}: {
  children: ReactNode;
  right?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`px-6 py-4 text-[0.9375rem] ${muted ? "text-ink-2" : "text-ink"} ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </td>
  );
}

/** A body row. The divider belongs here and not on the cells: with it on
    `<td>`, Tailwind's `last:` matched the last CELL in each row, so every
    row's rightmost column lost its rule and the table looked as if it
    stopped halfway across the card. `border-collapse` on the table makes
    a border on the row itself draw the full width. */
export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line last:border-0">{children}</tr>;
}

/** One label-over-value pair inside a panel. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className={LABEL}>{label}</dt>
      <dd className="text-[0.9375rem] text-ink">{children}</dd>
    </div>
  );
}

/** The headline figures across the top of a tab. */
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="u-card flex min-w-0 flex-1 flex-col gap-1 p-5">
      <p className={LABEL}>{label}</p>
      <p className="text-[1.375rem] font-semibold leading-tight tracking-[-0.015em] text-ink">{value}</p>
      {note && <p className="text-[0.8125rem] leading-snug text-ink-3">{note}</p>}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "neutral";

const TONE: Record<Tone, string> = {
  /* Accent, not the green --c-ok the admin console uses. Inside the
     product shell every affirmative mark is the brand purple — a green
     pill here would be the only green on the page and would read as a
     different system's notification. */
  ok: "bg-accent-soft text-accent",
  warn: "text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-surface-2 text-ink-2",
};

/** A full pill, unlike components/admin/Badge's 6px rectangle: at this
    size on a shadowed card the rectangle reads as a disabled button. */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-medium leading-none ${TONE[tone]}`}
      /* --c-warn has no -soft companion token, so its tint is mixed from
         the token itself here rather than inventing one variable this
         component alone would need — the same thing admin/Badge does. */
      style={tone === "warn" ? { backgroundColor: "color-mix(in srgb, var(--c-warn) 14%, transparent)" } : undefined}
    >
      {children}
    </span>
  );
}

/** Maps the stored statuses onto the four tones. Anything unrecognised
    is neutral rather than guessed at — the same table admin/Badge keeps,
    with "ok" meaning accent here rather than green. */
export function tone(status: string): Tone {
  switch (status) {
    case "active":
    case "trialing":
    case "paid":
      return "ok";
    case "pending":
    case "past_due":
      return "warn";
    case "suspended":
    case "cancelled":
    case "overdue":
      return "bad";
    default:
      return "neutral";
  }
}

/**
 * How much of the plan's per-location bound a room takes up.
 *
 * Laid out along one line — bar, then figure — rather than
 * components/admin/Meter's stacked caption, because this sits in a table
 * cell beside three other columns and a two-line cell would set the row
 * height for every location that fits comfortably.
 *
 * An unbounded plan (Main Stage, `maxM2` null) is not a meter at all:
 * there is nothing to be a fraction of, so the bar is dropped rather
 * than drawn full, which would look like the worst case for the one plan
 * that cannot be outgrown.
 */
export function Fit({
  used,
  limit,
  unit = "m²",
  noLimit,
}: {
  used: number;
  limit: number | null;
  unit?: string;
  /** The caption shown in place of the bar when `limit` is null. */
  noLimit: string;
}) {
  if (limit === null) {
    return (
      <span className="u-tabular whitespace-nowrap text-[0.8125rem] text-ink-2">
        {used} {unit} · {noLimit}
      </span>
    );
  }

  const { inPct, overPct } = meterSegments(used, limit);
  const over = overPct > 0;

  return (
    <span className="flex items-center gap-3">
      <span
        role="meter"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${used} / ${limit} ${unit}`}
        className="flex h-1.5 w-[148px] shrink-0 overflow-hidden rounded-full bg-surface-2"
      >
        <span className="h-full bg-accent" style={{ width: `${inPct}%` }} />
        {over && <span className="h-full bg-warn" style={{ width: `${overPct}%` }} />}
      </span>
      <span className={`u-tabular whitespace-nowrap text-[0.8125rem] ${over ? "text-warn" : "text-ink-2"}`}>
        {used} / {limit} {unit}
      </span>
    </span>
  );
}

/** The quiet control in a panel header — a link, since none of them open
    a flow that lives on this page. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-full border border-line-strong px-3.5 py-1.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}

/** The even quieter one: a bare accent link, for "Se alle". */
export function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-[0.8125rem] font-medium text-accent underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}

/** A panel that exists to say there is nothing in it yet. */
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <section className="u-card flex flex-col gap-2 px-6 py-10 text-center">
      <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
      <p className="mx-auto max-w-[46ch] text-[0.875rem] leading-relaxed text-ink-2">{body}</p>
    </section>
  );
}
