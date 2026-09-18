import type { ReactNode } from "react";

/**
 * Centres a card on a dotted canvas — the resting state of a table or
 * section with nothing in it yet (no customers, no invoices). The dots are
 * a radial-gradient tiled at 16px, coloured from `--c-line-strong` so it
 * reads correctly in either theme without a hard-coded grey.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] p-10"
      style={{
        backgroundImage: "radial-gradient(var(--c-line-strong) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <h3 className="text-[0.9375rem] font-medium text-ink">{title}</h3>
        {description && <p className="text-[0.875rem] text-ink-2">{description}</p>}
        {action}
      </div>
    </div>
  );
}
