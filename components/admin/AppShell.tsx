"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

function MenuGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The shell every admin and portal screen renders inside: a fixed 248px dark
 * frame next to a rounded light panel. Below 900px the frame collapses into
 * a slim dark top strip with a hamburger that opens the same nav as a
 * drawer, rather than trying to squeeze a 248px column onto a phone.
 *
 * The frame is `.on-dark` — the same island class the marketing site uses
 * for the player dock — so it reads as dark chrome in both the light and
 * dark theme, using the theme's own dark-mode token values rather than a
 * hard-coded colour.
 */
export function AppShell({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on Escape, and don't leave it mounted-but-invisible
  // once the viewport grows past the breakpoint that made it necessary.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    const mq = window.matchMedia("(min-width: 900px)");
    const onResize = () => mq.matches && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onResize);
    };
  }, [drawerOpen]);

  return (
    <div className="grid h-dvh grid-cols-[248px_minmax(0,1fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_1fr]">
      <nav className="on-dark flex min-h-0 flex-col overflow-auto p-3 pt-4 max-[900px]:hidden">
        {nav}
      </nav>

      <header className="on-dark hidden items-center gap-3 px-3 py-3 max-[900px]:flex">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MenuGlyph />
        </button>
      </header>

      <main className="m-2 ml-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] bg-surface max-[900px]:m-2 max-[900px]:mt-0">
        {children}
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="on-dark relative flex h-full w-[248px] flex-col overflow-auto p-3 pt-4 shadow-[var(--shadow-card)]">
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
