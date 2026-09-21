"use client";

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";

import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * A centred overlay for editing one record — the products screen's plan and
 * add-on dialogs.
 *
 * Unlike AppShell's nav drawer this one is genuinely modal: it holds a form
 * with unsaved input, so the page behind it is inert while it is open and
 * the body does not scroll underneath it.
 *
 * `trigger` is the box that opened it. Focus returns there on close, so a
 * keyboard user who opens a plan, closes it and carries on Tabbing resumes
 * from the plan they were looking at rather than the top of the page.
 */
export function Modal({
  open,
  onClose,
  title,
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  trigger?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useFocusTrap(open, close, dialogRef, trigger);

  // The page behind a modal must not scroll. Restores whatever `overflow`
  // was there rather than assuming "visible" — the shell sets its own.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4 sm:p-8">
      {/* Pointer dismissal only, and deliberately out of the tab order: a
          keyboard user closes with Escape, not by tabbing onto an invisible
          full-screen button before reaching the form. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
        className="fixed inset-0 bg-black/45"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-focus-container
        className="relative my-auto w-full max-w-[640px] rounded-[var(--radius-md)] border border-line bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-[7px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="m4 4 8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
