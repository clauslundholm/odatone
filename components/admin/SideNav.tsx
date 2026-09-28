import Link from "next/link";
import type { ReactNode } from "react";

import Wordmark from "@/components/ui/Wordmark";
import { activeNavHref } from "@/lib/nav-active";

export type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  /** A count shown as a pill on the right of the row — unread work, not
      decoration. Zero renders nothing: a badge reading "0" is noise that
      still draws the eye. `undefined` means this row has no count at all. */
  badge?: number;
  /** Overrides what a screen reader reads for `badge`. Without it the
      count is announced bare ("Customers 3"), which does not say what
      three of. */
  badgeLabel?: string;
};

/**
 * The frame's content: wordmark, an identity card, the link list, the
 * theme control, and whoever is signed in — in that order, top to bottom.
 * Rendered inside the dark `.on-dark` frame by AppShell, both for the
 * desktop sidebar and the mobile drawer, so it never assumes which one it
 * is in.
 *
 * Every slot but `items` is optional, so a screen can mount the frame
 * before it has an identity to put in it.
 */
export function SideNav({
  items,
  activeHref,
  header,
  theme,
  footer,
  navLabel = "Admin",
}: {
  items: NavItem[];
  activeHref?: string;
  /** Sits under the wordmark — in practice `WorkspaceCard`. */
  header?: ReactNode;
  /** Sits above the footer divider — in practice `ThemeSegments`. */
  theme?: ReactNode;
  /** The bottom of the frame — in practice `UserCard`. */
  footer?: ReactNode;
  /** Task 14 (/my-odatone) is this component's first consumer outside
      /admin — a customer's screen reader must not announce their own
      portal's primary navigation as "Admin". Defaults to the English
      admin label so every existing call site is unchanged. */
  navLabel?: string;
}) {
  /* Resolved against the whole list, not per row: the winner is the most
     specific match, which is a fact about the candidates rather than about
     any one of them. See lib/nav-active.ts for what the per-row rule got
     wrong. */
  const highlighted = activeNavHref(
    items.map((item) => item.href),
    activeHref,
  );

  return (
    <div className="flex h-full flex-col gap-1">
      {/* .brand: padding 2px 8px 16px */}
      <div className="px-2 pb-4 pt-0.5">
        <Wordmark height={20} tone="on-dark" />
      </div>

      {header}

      <nav aria-label={navLabel} className="mt-2.5 flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === highlighted;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              /* 8px, not --radius-sm's 10px: measured off the reference
                 design, and on a 34px-tall row the 10px token starts
                 rounding the row towards a lozenge.
                 The type styling is spelled out rather than reusing
                 `.u-label`, whose own `color: var(--c-ink-3)` outranks a
                 Tailwind text-* utility and flattened the active row to
                 the same grey as the rest. */
              className={`flex items-center gap-[11px] rounded-[8px] px-2.5 py-2 text-[0.875rem] font-medium leading-[1.3] tracking-[-0.004em] transition-colors ${
                active
                  ? "bg-surface-3 text-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  aria-label={item.badgeLabel}
                  className="ml-auto min-w-[20px] shrink-0 rounded-full px-1.5 py-px text-center text-[0.71875rem] font-semibold tabular-nums"
                  style={{ background: "var(--count-bg)", color: "var(--count-ink)" }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {theme && <div className="border-b border-line pb-3">{theme}</div>}
      {footer}
    </div>
  );
}
