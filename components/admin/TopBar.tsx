"use client";

import type { ReactNode } from "react";

/** The hamburger glyph for the mobile menu button — three bars, matching the
    weight of Button.tsx's Chevron/Arrow glyphs rather than an icon font. */
function MenuGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path
        d="M1 1h16M1 7h16M1 13h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The breadcrumb bar above the scrolling canvas, inside the panel. On phone
 * width it also carries the button that opens the drawer — `onMenu` is only
 * passed by AppShell, so a page using TopBar on its own just gets crumbs.
 */
export function TopBar({
  crumbs,
  actions,
  onMenu,
}: {
  crumbs: string[];
  actions?: ReactNode;
  onMenu?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      {onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="-ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink min-[900px]:hidden"
        >
          <MenuGlyph />
        </button>
      )}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[0.875rem]">
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
