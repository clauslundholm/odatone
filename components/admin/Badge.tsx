export type BadgeTone = "ok" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
  // --c-warn has no -soft companion token (Step 3 only added one for ok/bad),
  // so its tint is mixed from the token itself at the use site rather than
  // inventing a new --c-warn-soft variable this component alone would need.
  warn: "text-warn",
  neutral: "bg-surface-2 text-ink-2",
};

/** Maps the domain statuses admin renders — customer, subscription and
    invoice state — onto the three tones the design has colours for. Anything
    unrecognised is neutral rather than guessed at. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
    case "trialing":
    case "paid":
      return "ok";
    case "pending":
    case "past_due":
      return "warn";
    case "suspended":
    case "cancelled":
    case "overdue":
      return "bad";
    default:
      return "neutral";
  }
}

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`u-label inline-flex items-center rounded-full px-2.5 py-1 leading-none ${TONE_CLASS[tone]}`}
      style={tone === "warn" ? { backgroundColor: "color-mix(in srgb, var(--c-warn) 12%, transparent)" } : undefined}
    >
      {children}
    </span>
  );
}
