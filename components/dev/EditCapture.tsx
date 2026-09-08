"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* Development companion to the contentEditable body: watches text being
   typed over on the page and posts it to /api/edits, which writes it back
   into lib/content/. Renders nothing, and the layout only mounts it in
   development, so it disappears from production builds entirely.

   With the whole body as the editing host, `input` events fire on the body
   rather than on the paragraph being typed in — so the caret's own position
   is what tells us which element is under edit. */

const SKIP = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION"]);

/* Saving rewrites a source file, which trips Fast Refresh and re-renders the
   text under the caret. So we hold off until the sentence is finished: moving
   to another element saves immediately, and otherwise a pause does it. */
const IDLE_MS = 2000;

function editedElement(): HTMLElement | null {
  const node = document.getSelection()?.anchorNode ?? null;
  if (!node) return null;

  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;

  if (!el || el === document.body || SKIP.has(el.tagName)) return null;
  if (!el.isContentEditable) return null;
  return el;
}

export default function EditCapture() {
  const pathname = usePathname();
  /* First text we ever saw in an element. That is the string the route looks
     for in lib/content/, so repeated passes over one sentence keep pointing at
     the literal still on disk rather than at our own last edit. */
  const originals = useRef(new WeakMap<HTMLElement, string>());
  const pending = useRef(new Map<string, string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef<HTMLElement | null>(null);
  const page = useRef(pathname);

  useEffect(() => {
    page.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const remember = () => {
      const el = editedElement();
      if (el && !originals.current.has(el)) {
        originals.current.set(el, el.textContent ?? "");
      }
      /* Caret left the element being edited: that sentence is done, so save
         now rather than waiting out the idle timer. */
      if (el !== active.current) {
        active.current = el;
        if (pending.current.size) {
          if (timer.current) clearTimeout(timer.current);
          void flush();
        }
      }
    };

    const flush = async () => {
      timer.current = null;
      if (!pending.current.size) return;

      const edits = Object.fromEntries(pending.current);
      try {
        const res = await fetch("/api/edits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: page.current, edits }),
        });
        /* Only forget the edits once they are actually on disk; a failed
           save just rides along with the next one. */
        if (res.ok) {
          for (const key of Object.keys(edits)) {
            if (pending.current.get(key) === edits[key]) {
              pending.current.delete(key);
            }
          }
        }
      } catch {
        /* dev server restarting, most likely — keep them for next time */
      }
    };

    const onInput = () => {
      const el = editedElement();
      if (!el) return;

      const before = originals.current.get(el);
      if (before === undefined || !before.trim()) return;

      const after = el.textContent ?? "";
      if (after === before) {
        pending.current.delete(before);
      } else {
        pending.current.set(before, after);
      }

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, IDLE_MS);
    };

    /* Leaving the tab mid-sentence should not cost the last edit. */
    const onHide = () => {
      if (document.visibilityState !== "hidden" || !pending.current.size) return;
      const body = JSON.stringify({
        path: page.current,
        edits: Object.fromEntries(pending.current),
      });
      navigator.sendBeacon?.(
        "/api/edits",
        new Blob([body], { type: "application/json" }),
      );
    };

    /* Clicking outside the page entirely still ends the sentence. */
    const onBlur = () => {
      if (!pending.current.size) return;
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };

    document.addEventListener("selectionchange", remember);
    window.addEventListener("blur", onBlur);
    document.addEventListener("input", onInput);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      document.removeEventListener("selectionchange", remember);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("input", onInput);
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
