"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { portal } from "@/lib/content/portal";
import type { Locale } from "@/lib/i18n";
import { requestPasswordReset, type ResetState } from "./actions";

const initial: ResetState = {};

/**
 * The request half of a password reset. The other half — choosing the new
 * password — happens at the portal root, because that is where the
 * recovery link lands and where lib/use-invite-fragment.ts can read the
 * token out of the URL fragment.
 *
 * On success this shows a confirmation rather than clearing the form,
 * because the message has to be the same for a registered address and an
 * unregistered one (see actions.ts) and "sent!" next to an empty field is
 * the only honest way to say that without implying the address was found.
 */
export default function ResetForm({
  locale,
  portalName = "portal",
}: {
  locale: Locale;
  /** Which root the emailed link returns to. Posted as a hidden field and
      re-checked against an allowlist server-side — see actions.ts. */
  portalName?: "portal" | "admin";
}) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial);
  const t = portal.reset;

  const backHref = portalName === "admin" ? "/admin" : "/my-odatone";

  if (state.ok) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <h1 className="u-title text-[1.25rem] text-ink">{t.heading[locale]}</h1>
        <p role="status" className="text-[0.9375rem] text-ink-2">
          {t.sent[locale].replace("{email}", state.email ?? "—")}
        </p>
        <Link href={backHref} className="u-link text-[0.875rem]">
          {t.back[locale]}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 flex flex-col items-center gap-2 text-center">
        <h1 className="u-title text-[1.25rem] text-ink">{t.heading[locale]}</h1>
        <p className="text-[0.875rem] text-ink-2">{t.lede[locale]}</p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="portal" value={portalName} />
        <Field
          label={portal.login.emailLabel[locale]}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email ?? ""}
        />
        {state.error && (
          <p role="alert" className="text-[0.8125rem] text-bad">
            {(t.errors[state.error] ?? t.errors.service)[locale]}
          </p>
        )}
        <Button type="submit" size="md" className="mt-2 w-full" disabled={pending}>
          {pending ? t.submitPending[locale] : t.submit[locale]}
        </Button>
        <Link href={backHref} className="u-link mt-1 text-center text-[0.875rem]">
          {t.back[locale]}
        </Link>
        {/* The two facts worth knowing before the email arrives, said
            before it is sent rather than only in the confirmation. */}
        <p className="u-label text-center leading-relaxed text-ink-3">{t.linkNote[locale]}</p>
      </form>
    </>
  );
}
