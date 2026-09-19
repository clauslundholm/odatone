import type { ReactNode } from "react";

/**
 * The breadcrumb bar above the scrolling canvas, inside the panel.
 *
 * Four slots, left to right: the crumb trail, a status pill belonging to
 * the thing the last crumb names, right-aligned context about it, and any
 * page actions. Everything but `crumbs` is optional — a list screen
 * usually has nothing to say about itself, while a detail screen wants all
 * four.
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
  status,
  meta,
  actions,
  breadcrumbLabel = "Breadcrumb",
}: {
  crumbs: string[];
  /** A pill sitting immediately after the last crumb — in practice
      `Badge`. It qualifies the record you are looking at, so it travels
      with the crumb rather than with the page actions on the far right. */
  status?: ReactNode;
  /** Muted context pushed to the right: who, where, when. Hidden below
      720px, where the crumb trail alone already fills the bar and this
      would wrap into a second line of small grey text. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Task 14 (/my-odatone) is this component's first consumer outside
      English-only /admin — defaults to the existing English label so
      admin is unchanged. */
  breadcrumbLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      <nav
        aria-label={breadcrumbLabel}
        className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[0.875rem]"
      >
        {crumbs.map((crumb, i) => (
          <span key={crumb + i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="shrink-0 text-ink-3">/</span>}
            <span
              className={
                i === crumbs.length - 1 ? "truncate font-medium text-ink" : "truncate text-ink-2"
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {status && <div className="shrink-0">{status}</div>}

      {/* Takes the slack whether or not `meta` is present, so `actions`
          stays pinned right on a bar that has neither. */}
      <div className="min-w-0 flex-1 text-right">
        {meta && (
          <span className="truncate text-[0.8125rem] text-ink-3 max-[720px]:hidden">{meta}</span>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
