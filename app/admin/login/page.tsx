"use client";

import { useActionState } from "react";

import Wordmark from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { signIn } from "./actions";

const initialState: { error?: string } = {};

/* "invalid" deliberately covers both a wrong password and an unknown
   address -- see actions.ts. The other two are only reachable after a
   correct password, so spelling them out truthfully cannot reopen that
   hole; it would just be dishonest to call either of them a credential
   mismatch. */
const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That email and password don't match.",
  "no-access": "Your account isn't set up for admin access. Contact IT.",
  service: "Something went wrong on our end. Please try again in a moment.",
};

/**
 * The one door into /admin. No sidebar here — AppShell is for the screens
 * behind the gate, not the gate itself — so this centres a plain card on
 * the same dotted canvas EmptyState uses (a radial-gradient off
 * `--c-line-strong`), rather than reaching for AppShell for a single card.
 *
 * Staff are invited, not self-registered: there is deliberately no sign-up
 * link and no password-reset flow on this page.
 */
export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        backgroundImage: "radial-gradient(var(--c-line-strong) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark height={22} />
          <div>
            <h1 className="u-title text-[1.25rem] text-ink">Staff sign in</h1>
            <p className="mt-1 text-[0.875rem] text-ink-2">Odatone admin</p>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />

          {state.error && ERROR_MESSAGES[state.error] && (
            <p role="alert" className="text-[0.8125rem] text-bad">
              {ERROR_MESSAGES[state.error]}
            </p>
          )}

          <Button type="submit" size="md" className="mt-2 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
