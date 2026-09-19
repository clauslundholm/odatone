import type { ReactNode } from "react";

/**
 * A bordered card wrapping a `<table>`. Dense admin tables (customers,
 * invoices) have more columns than a phone-width viewport, so the table
 * itself scrolls horizontally inside the card at a fixed minimum width
 * rather than crushing its columns illegibly.
 */
export function TableCard({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          {title && <h2 className="text-[0.9375rem] font-medium text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="oda-scroll overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left text-[0.875rem]">
          {children}
        </table>
      </div>
    </div>
  );
}
