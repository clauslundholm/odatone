"use client";

import { useActionState } from "react";

import Wordmark from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MIN_PASSWORD_LEN, useInviteFragment } from "@/lib/use-invite-fragment";
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        backgroundImage: "radial-gradient(var(--c-line-strong) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </div>
  );
}

function Header({ heading, subtitle }: { heading?: string; subtitle: string }) {
  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      <Wordmark height={22} />
      <div>
        {heading && <h1 className="u-title text-[1.25rem] text-ink">{heading}</h1>}
        <p className="mt-1 text-[0.875rem] text-ink-2">{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * The one door into /admin, in the same four modes the customer portal's
 * login has (app/my-odatone/login/LoginForm.tsx) — the fragment handling
 * they share lives in lib/use-invite-fragment.ts.
 *
 * Staff are invited, never self-registered: there is deliberately no
 * sign-up link here. Until /admin/users existed, this page had only the
 * sign-in form, which meant an invited staff member landed here holding an
 * `#access_token…&type=invite` fragment and was shown an email-and-password
 * form with no password to type — a dead end with nothing on screen to
 * explain it. The "set-password" branch below is what closes that.
 *
 * There is still no password-reset flow: GoTrue's recovery links land here
 * with `type=recovery`, which this page already handles identically to an
 * invite, but nothing in the product sends one yet.
 */
export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const { mode, passwordError, passwordPending, submitPassword } = useInviteFragment("/admin");

  if (mode === "checking") {
    return (
      <Card>
        <Header subtitle="Odatone admin" />
        <p className="text-center text-[0.875rem] text-ink-2">Loading…</p>
      </Card>
    );
  }

  if (mode === "expired") {
    return (
      <Card>
        <Header heading="This link has expired" subtitle="Odatone admin" />
        <p role="alert" className="text-[0.875rem] text-ink-2">
          Invitation links last 24 hours and can only be used once. Ask an Odatone admin to send
          you a new one.
        </p>
      </Card>
    );
  }

  if (mode === "set-password") {
    return (
      <Card>
        <Header heading="Choose a password" subtitle="Odatone admin" />
        <form onSubmit={submitPassword} className="flex flex-col gap-4">
          <p className="text-[0.875rem] text-ink-2">
            Pick a password for your Odatone staff account. You&rsquo;ll use it to sign in from now
            on.
          </p>
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LEN}
            required
          />
          {passwordError && (
            <p role="alert" className="text-[0.8125rem] text-bad">
              {passwordError === "short"
                ? `Use at least ${MIN_PASSWORD_LEN} characters.`
                : "We couldn't set that password. Please try again."}
            </p>
          )}
          <Button type="submit" size="md" className="mt-2 w-full" disabled={passwordPending}>
            {passwordPending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <Header heading="Staff sign in" subtitle="Odatone admin" />
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
    </Card>
  );
}
