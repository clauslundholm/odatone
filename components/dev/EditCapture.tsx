"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* Companion to the contentEditable body: watches text being typed over on the
   page and posts it to /api/edits when the editor asks for it.

   Saving is deliberate rather than automatic. On the deployed site a save is
   published to every visitor the moment it lands, so it waits for the Save
   button in EditorShell; nothing goes out because a pause happened to be long
   enough. Locally the same button rewrites lib/content instead, which also
   keeps Fast Refresh from re-rendering the text under the caret mid-sentence.

   With the whole body as the editing host, `input` events fire on the body
   rather than on the paragraph being typed in — so the caret's own position
   is what tells us which element is under edit. */

const SKIP = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION"]);

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type CopyEdits = {
  /** How many distinct strings are changed and not yet saved. */
  count: number;
  status: SaveStatus;
  save: () => void;
};

function editedElement(): HTMLElement | null {
  const node = document.getSelection()?.anchorNode ?? null;
  if (!node) return null;

  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;

  if (!el || el === document.body || SKIP.has(el.tagName)) return null;
  if (!el.isContentEditable) return null;
  /* The editor's own chrome sits inside the editable body. It is page
     furniture, not copy, so it is never treated as edited text. */
  if (el.closest("[contenteditable='false']")) return null;
  return el;
}

/** Collects what has been typed over on this page and saves it on request.
    Pass `false` while the visitor may not edit: the listeners come off and
    nothing is collected. */
export function useCopyEdits(enabled: boolean): CopyEdits {
  const pathname = usePathname();
  /* First text we ever saw in an element. That is the string the route
     resolves the override against, so repeated passes over one sentence keep
     pointing at the same key rather than at our own last edit. */
  const originals = useRef(new WeakMap<HTMLElement, string>());
  const pending = useRef(new Map<string, string>());
  const page = useRef(pathname);
  const saving = useRef(false);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    page.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;

    const remember = () => {
      const el = editedElement();
      if (el && !originals.current.has(el)) {
        originals.current.set(el, el.textContent ?? "");
      }
    };

    const onInput = () => {
      const el = editedElement();
      if (!el) return;

      const before = originals.current.get(el);
      if (before === undefined || !before.trim()) return;

      const after = el.textContent ?? "";
      /* Typed back to where it started, so there is nothing left to save. */
      if (after === before) pending.current.delete(before);
      else pending.current.set(before, after);

      setCount(pending.current.size);
      setStatus("idle");
    };

    document.addEventListener("selectionchange", remember);
    document.addEventListener("input", onInput);
    return () => {
      document.removeEventListener("selectionchange", remember);
      document.removeEventListener("input", onInput);
    };
  }, [enabled]);

  const save = useCallback(() => {
    if (!pending.current.size || saving.current) return;
    saving.current = true;
    setStatus("saving");

    const edits = Object.fromEntries(pending.current);
    void fetch("/api/edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: page.current, edits }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        /* Only forget an edit once it is actually stored, and only if it has
           not been typed over again while the request was in flight. */
        for (const [key, value] of Object.entries(edits)) {
          if (pending.current.get(key) === value) pending.current.delete(key);
        }
        setCount(pending.current.size);
        setStatus("saved");
      })
      .catch(() => setStatus("error"))
      .finally(() => {
        saving.current = false;
      });
  }, []);

  /* Unsaved text is only in this tab, so leaving would lose it silently. */
  useEffect(() => {
    if (!count) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);

  /* The body is an editing host, so the browser's own Save-page dialog is
     never what someone pressing ⌘S here is after. */
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        save();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, save]);

  return { count, status, save };
}
