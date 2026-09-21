"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useFocusTrap } from "@/lib/use-focus-trap";

import Wordmark from "@/components/ui/Wordmark";

function MenuGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The shell every admin and portal screen renders inside: a fixed 248px dark
 * frame next to a rounded panel, inset 8px on three sides and flush against
 * the frame on the fourth. Below 760px the frame collapses into a slim dark
 * top strip with a hamburger that opens the same nav as a drawer, rather
 * than trying to squeeze a 248px column onto a phone.
 *
 * The panel is two surfaces, not one: TopBar paints itself `bg-surface`
 * across the top, and everything below it is this `bg-bg` canvas. That is
 * what makes a card a card — every card here is already
 * `border-line bg-surface`, which on a white panel drew a hairline around
 * white and read as nothing.
 *
 * The frame is `.on-dark` — the same island class the marketing site uses
 * for the player dock — so it reads as dark chrome in both the light and
 * dark theme, using the theme's own dark-mode token values rather than a
 * hard-coded colour.
 *
 * The mobile menu (hamburger + drawer) is entirely AppShell's own — see
 * TopBar.tsx for why a page's breadcrumb bar does not also carry one.
 */
export function AppShell({
  nav,
  children,
  menuLabel = "Open menu",
  menuDialogLabel = "Menu",
}: {
  nav: ReactNode;
  children: ReactNode;
  /** Task 14 (/my-odatone) is this component's first consumer outside the
      English-only /admin — these two default to the existing English
      strings so admin is unchanged, but a Danish portal page passes
      localised ones instead of leaving English text on a lang="da-DK"
      page. */
  menuLabel?: string;
  menuDialogLabel?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Escape, Tab cycling, focus in on open and back to the hamburger on
  // close all come from the shared trap (lib/use-focus-trap.ts), which the
  // products dialog uses too.
  useFocusTrap(drawerOpen, closeDrawer, dialogRef, triggerRef);

  // The drawer must not stay mounted-but-invisible once the viewport grows
  // past the breakpoint that made it necessary — that is this component's
  // own concern, not the trap's.
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia("(min-width: 760px)");
    const onResize = () => mq.matches && setDrawerOpen(false);
    mq.addEventListener("change", onResize);
    return () => mq.removeEventListener("change", onResize);
  }, [drawerOpen]);

  return (
    <div className="app-frame-bg grid h-dvh grid-cols-[248px_minmax(0,1fr)] max-[760px]:grid-cols-1 max-[760px]:grid-rows-[auto_1fr]">
      <nav className="on-dark app-frame flex min-h-0 flex-col overflow-auto px-3 pb-3 pt-[18px] max-[760px]:hidden">
        {nav}
      </nav>

      <header className="on-dark app-frame hidden h-14 items-center gap-2 px-3 max-[760px]:flex">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={menuLabel}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MenuGlyph />
        </button>
        <Wordmark height={18} tone="on-dark" />
      </header>

      <main className="m-2 ml-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] bg-bg max-[760px]:mx-1.5 max-[760px]:mb-1.5 max-[760px]:mt-0 max-[760px]:rounded-[12px]">
        {children}
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 min-[760px]:hidden">
          {/* Backdrop: pointer/touch dismissal only. It's deliberately not
              part of the tab order (tabIndex -1) — a keyboard user closes
              with Escape, not by tabbing onto an invisible full-screen
              button before ever reaching the nav links. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={menuDialogLabel}
            tabIndex={-1}
            data-focus-container
            className="on-dark app-frame relative flex h-full w-[min(84vw,300px)] flex-col overflow-auto px-3 pb-3 pt-[18px] shadow-[var(--shadow-card)]"
          >
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
