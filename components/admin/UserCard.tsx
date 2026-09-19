"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { initials } from "@/lib/initials";
import { EllipsisGlyph } from "@/components/admin/icons";

/**
 * The signed-in user, pinned to the bottom of the sidebar: monogram, name,
 * email, and an overflow button holding the actions that used to sit loose
 * in SideNav's footer — sign out, and in the portal the locale switch.
 *
 * Those actions arrive as `children` rather than as props, because the two
 * call sites need different ones and one of them is bilingual. That also
 * keeps the server actions on the server: a sign-out `<form>` rendered by
 * a server component passes through here as an already-formed element, so
 * this file never imports an action and never needs to know which of the
 * two sign-outs (admin's or the portal's) it is showing.
 *
 * The popover is not a `<dialog>`: it is a menu attached to a control in
 * the corner of a persistent frame, and making it modal would trap focus
 * and dim the page behind it for what is two links.
 */
export function UserCard({
  name,
  email,
  menuLabel,
  children,
}: {
  name: string;
  email?: string;
  /** Accessible name for the overflow trigger — localised by the portal. */
  menuLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape and any pointer landing outside close the menu. Both listeners
  // are only attached while it is open, so a closed card costs nothing.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Escape must put focus back on the trigger, or it lands on <body>
      // and the next Tab restarts from the top of the sidebar.
      triggerRef.current?.focus();
    };
    // `pointerdown`, not `click`: a click fires after the pressed element
    // has already run its own handler, so a menu item that navigates would
    // race the close. Down-then-outside is also what a mouse user reads as
    // dismissal.
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Opening with the keyboard should land inside the menu rather than
  // leaving focus on the trigger with the menu merely visible.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  const monogram = initials(name);

  return (
    <div ref={rootRef} className="relative flex items-center gap-2.5 px-2 py-1.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.75rem] font-semibold text-ink"
      >
        {monogram}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.8125rem] font-medium leading-tight text-ink">{name}</span>
        {email && <span className="truncate text-[0.6875rem] leading-tight text-ink-3">{email}</span>}
      </span>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-xs)] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <EllipsisGlyph />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          onClick={() => setOpen(false)}
          className="absolute bottom-[calc(100%+6px)] right-2 z-20 flex w-[176px] flex-col gap-1 rounded-[var(--radius-sm)] border border-line bg-surface-2 p-1.5 shadow-[var(--shadow-card)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
