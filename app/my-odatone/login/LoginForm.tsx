"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MIN_PASSWORD_LEN, useInviteFragment } from "@/lib/use-invite-fragment";
import { href, type Locale } from "@/lib/i18n";
import { portal } from "@/lib/content/portal";
import { PROOF } from "@/lib/site";
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
            hint={t.passwordHint[locale]}
            minLength={MIN_PASSWORD_LEN}
            required
          />
          {/* A typo guard, not an authorisation step: the password is
              typed once with no way to see it and no way back if it is
              wrong, because the link that got here is spent. */}
          <Field
            label={t.repeatLabel[locale]}
            name="repeat"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LEN}
            required
          />
          {passwordError && (
            <p role="alert" className="text-[0.8125rem] text-bad">
              {passwordError === "short"
                ? t.tooShort[locale]
                : passwordError === "mismatch"
                  ? t.mismatch[locale]
                  : t.generic[locale]}
            </p>
          )}
          <Button type="submit" size="md" className="mt-2 w-full" disabled={passwordPending}>
            {passwordPending ? t.submitPending[locale] : t.submit[locale]}
          </Button>
          <p className="u-label text-center leading-relaxed text-ink-3">{t.consent[locale]}</p>
        </form>
      </>
    );
  }

  return (
    <>
      <Header heading={portal.login.heading[locale]} subtitle={portal.login.subtitle[locale]} />
      <form action={formAction} className="flex flex-col gap-4">
        <p className="text-[0.875rem] text-ink-2">{portal.login.lede[locale]}</p>
        <Field
          label={portal.login.emailLabel[locale]}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={portal.login.emailPlaceholder[locale]}
          required
        />
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
        {/* Only on the ordinary sign-in. Someone who arrived on an invite or
            a recovery link is already holding the token this would mail
            them, and offering it there sends them round a loop. */}
        <Link href="/my-odatone/nulstil" className="u-link mt-1 text-center text-[0.875rem]">
          {portal.reset.forgot[locale]}
        </Link>
        {/* The portal has no locale segment (lib/portal-locale.ts), so
            this points at the signup page in whichever language the
            visitor is already reading the card in. */}
        <p className="u-label text-center text-ink-3">
          <Link href={href(locale, "signup")} className="u-link">
            {portal.login.noAccount[locale].replace("{n}", String(PROOF.trialDays))}
          </Link>
        </p>
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
