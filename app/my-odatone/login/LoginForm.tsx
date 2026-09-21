"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MIN_PASSWORD_LEN, useInviteFragment } from "@/lib/use-invite-fragment";
import type { Locale } from "@/lib/i18n";
import { portal } from "@/lib/content/portal";
import { signIn } from "./actions";

const initialState: { error?: string } = {};

/**
 * Two very different forms behind one component, chosen by how the visitor
 * arrived rather than by anything server-rendered:
 *
 * - Ordinary visit: the plain email/password sign-in (signIn, actions.ts),
 *   the same action shape as app/admin/login with the messages localised
 *   client-side from lib/content/portal.ts.
 * - Arrived via an invite or password-reset link: handled by
 *   `useInviteFragment` (lib/use-invite-fragment.ts), which is shared with
 *   /admin/login and carries the reasoning for why this cannot be done on
 *   the server and why supabase-js's own detectSessionInUrl does not work.
 *
 * Without that second branch an invite would land here, the fragment would
 * sit unprocessed, and the visitor would face an email-and-password form
 * with no password to type yet — a subtler dead end than a 404.
 */
export default function LoginForm({ locale }: { locale: Locale }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const { mode, passwordError, passwordPending, submitPassword } =
    useInviteFragment("/my-odatone");

  if (mode === "checking") {
    return (
      <>
        <Header subtitle={portal.login.subtitle[locale]} />
        <p className="text-center text-[0.875rem] text-ink-2">{portal.login.loading[locale]}</p>
      </>
    );
  }

  if (mode === "expired") {
    const t = portal.login.expired;
    return (
      <>
        <Header heading={t.heading[locale]} subtitle={portal.login.subtitle[locale]} />
        <p role="alert" className="text-[0.875rem] text-ink-2">
          {t.body[locale]}
        </p>
      </>
    );
  }

  if (mode === "set-password") {
    const t = portal.login.setPassword;
    return (
      <>
        <Header heading={t.heading[locale]} subtitle={portal.login.subtitle[locale]} />
        <form onSubmit={submitPassword} className="flex flex-col gap-4">
          <p className="text-[0.875rem] text-ink-2">{t.body[locale]}</p>
          <Field
            label={t.passwordLabel[locale]}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LEN}
            required
          />
          {passwordError && (
            <p role="alert" className="text-[0.8125rem] text-bad">
              {passwordError === "short" ? t.tooShort[locale] : t.generic[locale]}
            </p>
          )}
          <Button type="submit" size="md" className="mt-2 w-full" disabled={passwordPending}>
            {passwordPending ? t.submitPending[locale] : t.submit[locale]}
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Header heading={portal.login.heading[locale]} subtitle={portal.login.subtitle[locale]} />
      <form action={formAction} className="flex flex-col gap-4">
        <Field label={portal.login.emailLabel[locale]} name="email" type="email" autoComplete="email" required />
        <Field
          label={portal.login.passwordLabel[locale]}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.error && (
          <p role="alert" className="text-[0.8125rem] text-bad">
            {(portal.login.errors[state.error] ?? portal.login.errors.service)[locale]}
          </p>
        )}
        <Button type="submit" size="md" className="mt-2 w-full" disabled={pending}>
          {pending ? portal.login.submitPending[locale] : portal.login.submit[locale]}
        </Button>
      </form>
    </>
  );
}

/** The card's heading + product-name subtitle, above whichever form/message
    this component is currently showing. `heading` is optional so the
    "checking" mode (before it's known whether this is an ordinary sign-in
    or an invite) can show just the subtitle rather than asserting "Sign
    in" for a beat before possibly switching to "Choose a password" —
    page.tsx used to render a single static heading here regardless of
    mode, which is exactly how "Log ind" ended up as the permanent title
    above a choose-a-password form. */
function Header({ heading, subtitle }: { heading?: string; subtitle: string }) {
  return (
    <div className="mb-8 flex flex-col items-center gap-1 text-center">
      {heading && <h1 className="u-title text-[1.25rem] text-ink">{heading}</h1>}
      <p className="text-[0.875rem] text-ink-2">{subtitle}</p>
    </div>
  );
}
