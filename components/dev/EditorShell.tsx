"use client";

import { useEffect, useState } from "react";

import { useCopyEdits, type CopyEdits } from "@/components/dev/EditCapture";
import { HINT_COOKIE } from "@/lib/edit-cookies";

/**
 * Decides whether this visitor may edit, turns the body editable if so, and
 * gives them a Save button that says where the edits are heading.
 *
 * Nothing about editing is in the served HTML, so the page a visitor gets is
 * the same one the CDN caches. The decision is made here at runtime instead.
 */
export default function EditorShell({ dev }: { dev: boolean }) {
  const [editable, setEditable] = useState(false);
  const [asking, setAsking] = useState(false);
  const edits = useCopyEdits(editable);

  useEffect(() => {
    const hinted = document.cookie.split("; ").some((c) => c.startsWith(`${HINT_COOKIE}=`));
    const wants = new URLSearchParams(window.location.search).has("edit");
    /* Ordinary visitors have neither a session hint nor ?edit, and never
       reach the network on this account. */
    if (!dev && !hinted && !wants) return;

    let live = true;
    fetch("/api/edit-session")
      .then((r) => r.json())
      .then((data: { editable: boolean }) => {
        if (!live) return;
        if (data.editable) setEditable(true);
        else if (wants) setAsking(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dev]);

  useEffect(() => {
    if (!editable) return;
    document.body.contentEditable = "true";
    document.body.spellcheck = true;
    return () => {
      document.body.contentEditable = "false";
    };
  }, [editable]);

  if (asking) return <PasswordPrompt onUnlocked={() => window.location.reload()} />;
  if (!editable) return null;

  return <SaveButton dev={dev} edits={edits} />;
}

const CHIP =
  "fixed bottom-3 left-3 z-[200] rounded-full px-3 py-1 text-xs transition-colors";

/**
 * One control that doubles as the status line: it says where edits are going
 * while there are none, and becomes the way to publish them once there are.
 */
function SaveButton({ dev, edits }: { dev: boolean; edits: CopyEdits }) {
  const where = dev ? "editing source" : "editing live site";

  if (!edits.count && edits.status !== "saved" && edits.status !== "error") {
    return (
      <span contentEditable={false} className={`${CHIP} bg-accent text-accent-ink`}>
        {where}
      </span>
    );
  }

  const label =
    edits.status === "saving"
      ? "Saving…"
      : edits.status === "saved"
        ? dev ? "Saved to lib/content" : "Saved — now live"
        : edits.status === "error"
          ? "Save failed — try again"
          : `Save ${edits.count} ${edits.count === 1 ? "change" : "changes"}`;

  /* Nothing to send: the last save cleared the queue and this is just its
     result, so the button stands down until something is typed again. */
  const done = !edits.count;

  return (
    <button
      type="button"
      contentEditable={false}
      onClick={edits.save}
      disabled={done || edits.status === "saving"}
      aria-live="polite"
      title={done ? undefined : `${where} — ⌘S`}
      className={`${CHIP} font-medium ${
        edits.status === "error"
          ? "bg-red-600 text-white"
          : done
            ? "bg-accent text-accent-ink"
            : "bg-ink text-bg hover:opacity-85"
      }`}
    >
      {label}
    </button>
  );
}

function PasswordPrompt({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/edit-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) onUnlocked();
    else setError(res.status === 429 ? "Too many attempts. Wait 10 minutes." : "Wrong password.");
  }

  return (
    <form
      onSubmit={submit}
      contentEditable={false}
      className="fixed bottom-3 left-3 z-[200] flex gap-2 rounded-full bg-bg px-3 py-2 shadow"
    >
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Edit password"
        className="bg-transparent text-sm outline-none"
        autoFocus
      />
      <button type="submit" className="text-sm font-medium">
        Unlock
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
