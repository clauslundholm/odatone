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
    <div ref={rootRef} className="relative flex items-center gap-2.5 p-2">
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold"
        style={{ background: "#2e2e36", color: "#ececf0" }}
      >
        {monogram}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.875rem] font-medium leading-[1.3] text-ink">{name}</span>
        {email && <span className="truncate text-[0.75rem] leading-[1.3] text-ink-2">{email}</span>}
      </span>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-xs)] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <EllipsisGlyph />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          /* Deliberately no `onClick={() => setOpen(false)}` here. A click
             on an item inside bubbles to this element, React re-renders
             synchronously during the click, and the item is unmounted
             before the browser performs the click's default action — so a
             `<form>` item never submits. That is precisely what broke sign
             out: the button appeared to work, the menu closed, and the
             session stayed open. The menu already closes on Escape and on
             an outside pointerdown, and every item in it navigates, which
             unmounts the whole card anyway. An item that does NOT navigate
             must close the menu itself, after its own work. */
          /* The reference makes this a light sheet floating off the dark
             frame. Doing that here would mean either portalling the menu
             out of `.app-frame` or restating the whole light palette on a
             reset class — both more machinery than a two-item menu earns.
             It keeps the frame's own raised tone and the reference's
             geometry: 10px radius, 236px minimum, 6px padding. */
          className="absolute bottom-[calc(100%+4px)] left-0 right-0 z-30 flex min-w-[236px] flex-col gap-0.5 rounded-[10px] border border-line bg-surface-3 p-1.5 shadow-[var(--shadow-card)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
