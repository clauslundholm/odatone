import Link from "next/link";
import type { ReactNode } from "react";

import Wordmark from "@/components/ui/Wordmark";

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
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="px-2 pt-1">
        <Wordmark height={18} tone="on-dark" />
      </div>

      {header}

      <nav aria-label={navLabel} className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const active =
            activeHref === item.href ||
            (activeHref?.startsWith(item.href + "/") ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              /* The type styling is spelled out rather than reusing
                 `.u-label`, whose own `color: var(--c-ink-3)` outranks a
                 Tailwind text-* utility and flattened the active row to
                 the same grey as the rest. */
              className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[0.8125rem] font-medium leading-[1.3] tracking-[-0.004em] transition-colors ${
                active
                  ? "bg-surface-2 text-ink"
                  : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"
              }`}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  aria-label={item.badgeLabel}
                  className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none text-ink"
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {theme}
      {footer && <div className="border-t border-line pt-2">{footer}</div>}
    </div>
  );
}
