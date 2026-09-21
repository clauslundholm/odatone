"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard containment for an open overlay — the admin shell's mobile nav
 * drawer and the products edit dialog. Both need the same four things, and
 * the reasoning below was paid for once in the drawer; a second copy in
 * the dialog would eventually lose one of them.
 *
 * 1. Focus moves INTO the overlay when it opens. A trap that only cycles
 *    Tab still leaves a keyboard user reading whatever sat underneath.
 * 2. Focus returns to whatever opened it on close, or the next Tab
 *    restarts from the top of the document.
 * 3. Escape closes.
 * 4. Tab and Shift+Tab cycle within the overlay.
 *
 * The subtle case is Shift+Tab from the container itself. The container is
 * the initial focus target, so a backwards Tab before any forward one has
 * moved focus onto a real control must wrap to the LAST item. Without
 * that it falls through to the (tabIndex -1) backdrop and from there back
 * into the page underneath — reopening the exact hole the trap exists to
 * close.
 *
 * @param open      whether the overlay is currently shown
 * @param onClose   called on Escape
 * @param container the overlay's root; it must be focusable (tabIndex -1)
 * @param trigger   the control that opened it, focused again on close
 */
export function useFocusTrap(
  open: boolean,
  onClose: () => void,
  container: RefObject<HTMLElement | null>,
  trigger?: RefObject<HTMLElement | null>,
) {
  // Only restore focus on a real close, never on mount. Without the guard
  // the `else` branch runs on first render too, so every closed overlay on
  // a page grabs focus onto its own trigger as it mounts — and the last one
  // mounted wins. Seen live on /admin/products: the add-on box came up
  // focused on page load, before any interaction, because its dialog
  // mounted last.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      container.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      trigger?.current?.focus();
    }
    // `container`/`trigger` are refs — stable across renders, and listing
    // them would not make this re-run when their `.current` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !container.current) return;

      const focusable = Array.from(container.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === container.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}
