import Link from "next/link";
import type { ReactNode } from "react";

import Wordmark from "@/components/ui/Wordmark";

export type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

/**
 * The frame's content: wordmark plus a flat list of links. Rendered inside
 * the dark `.on-dark` frame by AppShell, both for the desktop sidebar and
 * the mobile drawer, so it never assumes which one it is in.
 */
export function SideNav({
  items,
  activeHref,
  footer,
}: {
  items: NavItem[];
  activeHref?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="px-2 pt-1">
        <Wordmark height={18} />
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const active =
            activeHref === item.href ||
            (activeHref?.startsWith(item.href + "/") ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`u-label flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 transition-colors ${
                active
                  ? "bg-surface-2 text-ink"
                  : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      {footer && <div className="border-t border-line pt-3">{footer}</div>}
    </div>
  );
}
