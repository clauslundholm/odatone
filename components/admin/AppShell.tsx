"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

function MenuGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  // Move focus into the drawer when it opens, and back to the button that
  // opened it when it closes — a dialog that merely traps Tab but never
  // relocates focus on open still leaves a keyboard user reading whatever
  // was already focused underneath it.
  useEffect(() => {
    if (drawerOpen) {
      dialogRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [drawerOpen]);

  // Escape closes; Tab is trapped inside the dialog while it's open; and the
  // drawer doesn't stay mounted-but-invisible once the viewport grows past
  // the breakpoint that made it necessary.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // The dialog root itself is the initial focus target (see the effect
      // above), so shift+Tab from *it* — before any forward Tab has moved
      // focus onto a link — must also wrap to the last item, or it falls
      // through to the (skipped, tabIndex -1) backdrop and from there back
      // into the page underneath, reopening the exact defect this trap
      // exists to close.
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

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
      </header>

      <main className="m-2 ml-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] bg-surface max-[900px]:m-2 max-[900px]:mt-0">
        {children}
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          {/* Backdrop: pointer/touch dismissal only. It's deliberately not
              part of the tab order (tabIndex -1) — a keyboard user closes
              with Escape, not by tabbing onto an invisible full-screen
              button before ever reaching the nav links. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={menuDialogLabel}
            tabIndex={-1}
            className="on-dark relative flex h-full w-[248px] flex-col overflow-auto p-3 pt-4 shadow-[var(--shadow-card)] outline-none"
          >
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
