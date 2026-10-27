"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { submitSignup } from "@/app/actions";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CheckIcon } from "@/components/player/Icons";
import { signup as tDefaults } from "@/lib/content/signup";
import { href, type Locale } from "@/lib/i18n";
import { kr } from "@/lib/format";
import { quote, type Plan } from "@/lib/pricing";
import type { ActionResult, FieldErrors } from "@/lib/forms";

/**
 * The v4 signup: three steps — Profil, Betaling, Spil i butikken —
 * presented as a card over the page rather than as a page of its own.
 *
 * It replaces the one-page form this file used to hold, and the shape of
 * the thing changed more than the fields did:
 *
 *  - **The account is created at step one, not at the end.** "Opret profil"
 *    is the submit. Steps two and three happen to someone who already has
 *    an account, which is why skipping payment is a real option rather than
 *    an abandoned signup.
 *  - **No plan picker.** The design shows one line — "Odatone, 1 lokation"
 *    — so the account is created on the default plan, which is the first
 *    active plan by `sort`. The price shown is that plan's real price read
 *    from the database, not the 149 kr. drawn in the mockup: Small Venue is
 *    no longer in the catalogue and quoting a plan nobody can buy is how a
 *    pricing page ends up lying.
 *  - **No CVR.** It is asked for in the portal under Indstillinger instead.
 *    An invoice cannot be issued without one (see
 *    app/admin/customers/[id]/invoice-actions.ts), so step three says so
 *    rather than leaving it to be discovered at the first invoice.
 */
export default function SignupFlow({
  locale,
  plans,
}: {
  locale: Locale;
  /** Database-backed, from lib/plans-server.ts's activePlans(), ordered by
      `sort`. The first is the default the account is created on. */
  plans: Plan[];
}) {
  const t = tDefaults.modal;
  const l = locale;
  const search = useSearchParams();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");

  /* `?plan=` still works as a deep link from the pricing page, because the
     landing page's "Prøv gratis" is not the only way in. Without one, the
     first active plan is the default — which is what the design's single
     summary line assumes. */
  const plan: Plan | null = useMemo(() => {
    const wanted = search.get("plan");
    return (wanted && plans.find((p) => p.id === wanted)) || plans[0] || null;
  }, [search, plans]);

  return (
    <div className="u-card mx-auto w-full max-w-[520px] p-8 sm:p-10">
      <Stepper locale={l} step={step} />
      {step === 0 && (
        <ProfileStep
          locale={l}
          plan={plan}
          onCreated={(createdEmail) => {
            setEmail(createdEmail);
            setStep(1);
          }}
        />
      )}
      {step === 1 && <PaymentStep locale={l} plan={plan} onDone={() => setStep(2)} />}
      {step === 2 && <PlayStep locale={l} email={email} />}
    </div>
  );
}

function Stepper({ locale: l, step }: { locale: Locale; step: number }) {
  const t = tDefaults.modal;
  return (
    <ol className="mb-8 flex items-center gap-2">
      {t.steps.map((s, i) => {
        const state = i === step ? "current" : i < step ? "done" : "todo";
        return (
          <li key={i} className="flex items-center gap-2">
            <span
              className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[0.75rem] font-medium ${
                state === "todo"
                  ? "bg-surface-2 text-ink-3"
                  : "bg-accent text-accent-ink"
              }`}
            >
              {state === "done" ? <CheckIcon size={11} /> : i + 1}
            </span>
            <span
              className={`text-[0.8125rem] ${
                state === "current" ? "font-medium text-ink" : "text-ink-3"
              }`}
            >
              {s[l]}
            </span>
            {i < t.steps.length - 1 && <span className="mx-1 h-px w-5 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

const initialResult: ActionResult | Record<string, never> = {};

/** Server-side errors arrive as short codes ("required", "exists", …).
    Indexed through a widened view of the copy table so an unrecognised
    code falls back to the generic message instead of rendering itself. */
function errorText(code: string, l: Locale): string {
  const table = tDefaults.errors as unknown as Record<string, Record<Locale, string> | undefined>;
  return table[code]?.[l] ?? table.server?.[l] ?? code;
}

function ProfileStep({
  locale: l,
  plan,
  onCreated,
}: {
  locale: Locale;
  plan: Plan | null;
  onCreated: (email: string) => void;
}) {
  const t = tDefaults.modal.profile;
  /* The action's result says whether it worked, not who it worked for, and
     step three needs the address to tell them what to sign in with. The
     wrapper below runs on the client — it is a plain function calling the
     server action, not a server action itself — so the submitted value can
     be kept here rather than threaded back through the result type. */
  const emailRef = useRef("");
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, fd: FormData): Promise<ActionResult> => {
      /* The fields the design does not ask for, supplied here rather than
         left out: buildSignup still wants a plan and a location count, and
         the account has to land on something. One location and the default
         plan are what the summary on the next step then states back. */
      emailRef.current = String(fd.get("email") ?? "");
      if (plan) fd.set("planId", plan.id);
      fd.set("billing", "monthly");
      fd.set("locations", "1");
      return submitSignup(fd);
    },
    initialResult as ActionResult,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) onCreated(emailRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors: FieldErrors = state && "ok" in state && !state.ok ? state.errors : {};
  const formError = errors.form ? tDefaults.errors.server[l] : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="u-display text-[1.75rem]">{t.heading[l]}</h1>
        <p className="text-[0.9375rem] text-ink-2">{t.lede[l]}</p>
      </header>

      <Field label={t.nameLabel[l]} name="name" autoComplete="name" required error={errors.name && tDefaults.errors.required[l]} />
      <Field label={t.companyLabel[l]} name="company" autoComplete="organization" required error={errors.company && tDefaults.errors.required[l]} />
      <Field
        label={t.emailLabel[l]}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email ? errorText(errors.email, l) : undefined}
      />
      <Field
        label={t.passwordLabel[l]}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint={t.passwordHint[l]}
        error={errors.password ? errorText(errors.password, l) : undefined}
      />

      {formError && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.submitPending[l] : t.submit[l]}
      </Button>
      <p className="u-label text-center text-ink-3">{t.note[l]}</p>
    </form>
  );
}

function PaymentStep({
  locale: l,
  plan,
  onDone,
}: {
  locale: Locale;
  plan: Plan | null;
  onDone: () => void;
}) {
  const t = tDefaults.modal.payment;
  const LOCATIONS = 1;
  /* The real figure for the plan the account was just created on. The
     mockup's 149 kr. is Small Venue's price and Small Venue is not in the
     catalogue. */
  const monthly = plan ? kr(Math.round(quote(plan, "monthly", LOCATIONS).monthlyExVat), l) : "—";
  const planLine = (LOCATIONS === 1 ? t.linePlan : t.linePlanPlural)[l]
    .replace("{plan}", plan?.name ?? "Odatone")
    .replace("{n}", String(LOCATIONS));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="u-display text-[1.75rem]">{t.heading[l]}</h1>
        <p className="text-[0.9375rem] text-ink-2">{t.lede[l]}</p>
      </header>

      <dl className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-surface-2 p-5 text-[0.875rem]">
        <Row label={planLine} value={`${monthly} / md. ekskl. moms`} />
        <Row label={t.lineRights[l]} value="0 kr." />
        <Row label={t.lineToday[l]} value={t.todayValue[l]} strong />
      </dl>

      {/* The card is collected but never charged or stored — there is no
          payment provider wired up yet, which the note below says out loud
          rather than implying a card on file that does not exist. */}
      <Field label={tDefaults.payment.cardNumber[l]} name="card" inputMode="numeric" placeholder="4242 4242 4242 4242" autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tDefaults.payment.expiry[l]} name="expiry" placeholder="12 / 28" autoComplete="off" />
        <Field label={tDefaults.payment.cvc[l]} name="cvc" inputMode="numeric" placeholder="123" autoComplete="off" />
      </div>

      <Button type="button" size="lg" onClick={onDone}>
        {t.submit[l]}
      </Button>
      <button type="button" onClick={onDone} className="u-link text-center text-[0.875rem]">
        {t.skip[l]}
      </button>
      <p className="u-label text-center text-ink-3">{tDefaults.payment.demoNote[l]}</p>
    </div>
  );
}

function PlayStep({ locale: l, email }: { locale: Locale; email: string }) {
  const t = tDefaults.modal.play;
  return (
    <div className="flex flex-col gap-5 text-center">
      <h1 className="u-display text-[1.75rem]">{t.heading[l]}</h1>
      <p className="text-[0.9375rem] text-ink-2">
        {t.lede[l].replace("{email}", email || "—")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {/* The front page is the player now — there is no separate
            /afspiller to send them to. */}
        <LinkButton href={href(l, null)} size="lg">
          {t.openPlayer[l]}
        </LinkButton>
        <LinkButton href="/my-odatone" variant="outline" size="lg">
          {t.openPortal[l]}
        </LinkButton>
      </div>
      {/* Not a nicety: invoice issuing refuses without a CVR, and the
          customer is the only one who can supply it. */}
      <p className="u-label text-ink-3">{t.cvrNote[l]}</p>
      <Link href="/my-odatone/settings" className="u-link text-[0.875rem]">
        {tDefaults.modal.play.openPortal[l]}
      </Link>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className={strong ? "font-medium text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}
