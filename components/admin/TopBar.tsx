import type { ReactNode } from "react";

/**
 * The breadcrumb bar above the scrolling canvas, inside the panel.
 *
 * The mobile hamburger and drawer are not here — they belong to AppShell,
 * which renders its own top strip above the panel and owns the drawer's
 * open state. An earlier draft of this component tried to carry a menu
 * button of its own via an `onMenu` prop, but AppShell never rendered
 * TopBar or exposed any channel to reach it, so the prop had no caller and
 * would have misled whoever wired the first real page. TopBar is
 * breadcrumbs and page actions only.
 */
export function TopBar({
  crumbs,
  actions,
  breadcrumbLabel = "Breadcrumb",
}: {
  crumbs: string[];
  actions?: ReactNode;
  /** Task 14 (/my-odatone) is this component's first consumer outside
      English-only /admin — defaults to the existing English label so
      admin is unchanged. */
  breadcrumbLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      <nav aria-label={breadcrumbLabel} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[0.875rem]">
        {crumbs.map((crumb, i) => (
          <span key={crumb + i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-3">/</span>}
            <span className={i === crumbs.length - 1 ? "truncate font-medium text-ink" : "truncate text-ink-2"}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
