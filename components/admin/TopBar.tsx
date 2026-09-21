import type { ReactNode } from "react";

import { ChevronRightGlyph } from "@/components/admin/icons";

/**
 * The breadcrumb bar across the top of the panel.
 *
 * It paints its own `bg-surface` because AppShell's panel is a canvas
 * (`bg-bg`) that cards sit on — this bar is the one part of the panel that
 * is a sheet rather than a surface for cards, and the line under it is
 * where the canvas starts.
 *
 * Five slots, left to right: an optional section glyph, the crumb trail, a
 * status pill belonging to the thing the last crumb names, right-aligned
 * context about it, and any page actions. Everything but `crumbs` is
 * optional — a list screen usually has nothing to say about itself, while
 * a detail screen wants all of them.
 *
 * The last crumb is set larger and heavier than its parents: it is the
 * title of the screen, and a trail rendered at one uniform size makes the
 * reader work out which end they are at.
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
  icon,
  status,
  meta,
  actions,
  breadcrumbLabel = "Breadcrumb",
}: {
  crumbs: string[];
  /** A glyph for the section this screen belongs to, shown before the
      trail — in practice the same one the matching SideNav row carries. */
  icon?: ReactNode;
  /** A pill sitting immediately after the last crumb — in practice
      `Badge`. It qualifies the record you are looking at, so it travels
      with the crumb rather than with the page actions on the far right. */
  status?: ReactNode;
  /** Muted context pushed to the right: who, where, when. Hidden below
      760px, where the crumb trail alone already fills the bar and this
      would wrap into a second line of small grey text. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Task 14 (/my-odatone) is this component's first consumer outside
      English-only /admin — defaults to the existing English label so
      admin is unchanged. */
  breadcrumbLabel?: string;
}) {
  return (
    <div className="flex min-h-[62px] shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-line bg-surface px-[22px] py-3 max-[760px]:px-4">
      <nav
        aria-label={breadcrumbLabel}
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={crumb + i} className="flex min-w-0 items-center gap-2">
              {i > 0 && <ChevronRightGlyph className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
              <span
                className={
                  last
                    ? "truncate text-[1rem] font-semibold tracking-[-0.01em] text-ink"
                    : "truncate text-[0.9375rem] text-ink-2"
                }
              >
                {crumb}
              </span>
            </span>
          );
        })}
      </nav>

      {status && <div className="shrink-0">{status}</div>}

      {/* Takes the slack whether or not `meta` is present, so `actions`
          stays pinned right on a bar that has neither. */}
      <div className="min-w-0 flex-1 text-right">
        {meta && (
          <span className="truncate text-[0.8125rem] text-ink-2 max-[760px]:hidden">{meta}</span>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
