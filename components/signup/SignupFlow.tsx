"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { quote, type Billing, type Plan, type PlanId } from "@/lib/pricing";
import { DEFAULT_PROFILE, loadProfile, saveProfile, type VenueProfile } from "@/lib/profile";
import { submitSignup } from "@/app/actions";
import { EMAIL_RE, digits, type FieldErrors } from "@/lib/forms";
/* The server's own CVR parser, imported rather than reimplemented. lib/signup.ts
   is pure — it pulls in nothing but types and lib/forms — so a client
   component can use it, and sharing it is what keeps the message this form
   shows and the rule buildSignup enforces from ever disagreeing. */
import { parseCvr } from "@/lib/signup";
import { signup as tDefaults } from "@/lib/content/signup";
import { ui as uiDefaults } from "@/lib/content/common";
import { pricing as pricingCopyDefaults } from "@/lib/content/pricing";
import { href, type Locale } from "@/lib/i18n";
import { kr, num } from "@/lib/format";
import { Button, LinkButton, Arrow } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CheckIcon } from "@/components/player/Icons";

type Account = {
  name: string;
  company: string;
  cvr: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
};

const EMPTY_ACCOUNT: Account = {
  name: "",
  company: "",
  cvr: "",
  email: "",
  phone: "",
  address: "",
  zip: "",
  city: "",
};

/* Card only. There used to be a "Faktura / EAN" alternative here — a
   payment-method toggle, an EAN field and a requisition-number field — and
   it is gone from signup. Note that staff choosing how an ISSUED invoice is
   payable is a different thing entirely and still has both: see
   `payment_method` on `invoices` (0010_invoice_lines.sql) and the selector
   in components/admin/InvoiceActions.tsx. This is only about what a visitor
   is offered when they sign up. */
type Payment = {
  card: string;
  expiry: string;
  cvc: string;
  terms: boolean;
};

const EMPTY_PAYMENT: Payment = {
  card: "",
  expiry: "",
  cvc: "",
  terms: false,
};

export default function SignupFlow({
  locale,
  plans,
}: {
  locale: Locale;
  /** Database-backed (lib/plans-server.ts's activePlans()), passed down
      from SignupPage (a server component) the same way PricingTable gets
      its plans — see that component's doc comment. SignupFlow is a client
      component and cannot call activePlans() itself.

      Every quote() call in this file must be handed one of these Plan
      objects, never a bare PlanId: quote()'s PlanId branch re-resolves
      against the compiled PLANS and ignores whatever a staff member has
      actually saved, which matters here more than almost anywhere else on
      the site — a stale price shown at checkout has contractual weight. */
  plans: Plan[];
}) {
  const t = tDefaults;

  const l = locale;
  const search = useSearchParams();

  const [profile, setProfile] = useState<VenueProfile>(DEFAULT_PROFILE);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [account, setAccount] = useState<Account>(EMPTY_ACCOUNT);
  const [payment, setPayment] = useState<Payment>(EMPTY_PAYMENT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | undefined>(undefined);

  /* Pick up the calculator's answers and any ?plan= / ?billing= link.

     `?step=` is gone with the wizard. It addressed a step, and there are no
     steps — all three sections are on the page at once, so a link that used
     to open the flow partway through now just opens the flow. */
  useEffect(() => {
    setProfile(loadProfile());
    const p = search.get("plan");
    if (p && plans.some((x) => x.id === p)) setPlanId(p);
    const b = search.get("billing");
    if (b === "annual" || b === "monthly") setBilling(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* No recommendation any more. The flow used to pick a plan for the
     visitor from the floor area they had just typed in; it no longer asks
     for one, and guessing from the location count would be worse than not
     guessing — a one-room café and a 900 m² hotel are both "1 location".
     `activePlan` is null until they choose, and the submit will not go
     without a choice. */
  const activePlan: Plan | null = useMemo(
    () => (planId && plans.find((p) => p.id === planId)) || null,
    [planId, plans],
  );

  /* The wizard cleared every error on each step change (`goto` did it), so
     a message never outlived the screen that produced it. One page has no
     step change, and without this an error sits under a field the visitor
     has already corrected while the count beside the button keeps counting
     it — the form telling them they are wrong about something they just
     fixed.

     Cleared per field as it is edited, rather than by re-running validateAll
     on every keystroke: re-validating would also clear an error about a
     field the visitor has not touched (typing a company name would dismiss
     "this email is already registered"), and it would start marking fields
     wrong while they are still being typed into. */
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const changeAccount = (next: Account, field?: string) => {
    setAccount(next);
    if (field) clearError(field);
  };

  const changePayment = (next: Payment, field?: string) => {
    setPayment(next);
    if (field) clearError(field);
  };

  const choosePlan = (id: PlanId) => {
    setPlanId(id);
    clearError("plan");
  };

  const setProfilePatch = (patch: Partial<VenueProfile>) => {
    setProfile((prev) => {
      const nextProfile = { ...prev, ...patch };
      saveProfile(nextProfile);
      return nextProfile;
    });
  };

  /* One validator for the whole page, where the wizard had one per step.
     That is the substantive change behind moving to a single form: a step
     could only ever be wrong in the handful of ways its own fields allowed,
     and pressing "Videre" showed all of them at once because they all fit on
     screen. Here a submit can surface a dozen at once, several of them
     scrolled out of view, so the order below matters — it is the order the
     fields are rendered in, which is what lets `firstInvalid` point at the
     one nearest the top of the page rather than an arbitrary one. */
  const validateAll = (): FieldErrors => {
    const e: FieldErrors = {};

    // 01 Virksomhed
    if (!account.company.trim()) e.company = t.errors.required[l];
    if (!account.cvr.trim()) e.cvr = t.errors.required[l];
    /* The same parser the server uses (lib/signup.ts), not a second copy of
       the rule: a client check that disagreed with buildSignup would either
       reject a CVR the server would have taken, or wave one through to a
       server refusal the visitor cannot see the reason for. */
    else if (parseCvr(account.cvr) === null) e.cvr = t.errors.cvr[l];
    if (!account.address.trim()) e.address = t.errors.required[l];
    if (!account.zip.trim()) e.zip = t.errors.required[l];
    if (!account.city.trim()) e.city = t.errors.required[l];

    // 02 Konto
    if (!account.name.trim()) e.name = t.errors.required[l];
    if (!EMAIL_RE.test(account.email)) e.email = t.errors.email[l];

    // 03 Abonnement
    if (!planId) e.plan = t.errors.planInvalid[l];
    if (digits(payment.card).length !== 16) e.card = t.errors.card[l];
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(payment.expiry.trim())) e.expiry = t.errors.expiry[l];
    if (digits(payment.cvc).length !== 3) e.cvc = t.errors.cvc[l];
    if (!payment.terms) e.terms = t.errors.terms[l];

    return e;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const e = validateAll();
    if (Object.keys(e).length) {
      setErrors(e);
      /* Scroll and focus, not just render. On a wizard step an inline error
         was always within a screen of the button that produced it; on this
         page the first thing wrong can be a thousand pixels up, and a button
         that appears to do nothing is how a form loses someone. */
      focusFirstInvalid(e);
      return;
    }
    setBusy(true);
    setErrors({});
    const fd = new FormData();
    fd.set("name", account.name);
    fd.set("company", account.company);
    fd.set("cvr", account.cvr);
    fd.set("email", account.email);
    fd.set("phone", account.phone);
    /* Sent as three separate fields, not concatenated into one string: they
       land in customers.address/postcode/city (0001_core.sql), three
       distinct columns — the fix round that added persisting them at all
       found the previous single combined "address" field had nowhere
       structured to go. */
    fd.set("address", account.address);
    fd.set("postcode", account.zip);
    fd.set("city", account.city);
    if (!planId) {
      /* Unreachable — validateAll above refuses a submit without a plan —
         but finish must not post a signup with no plan on that strength. */
      setErrors({ plan: t.errors.planInvalid[l] });
      setBusy(false);
      return;
    }
    fd.set("planId", planId);
    fd.set("billing", billing);
    fd.set("locations", String(profile.locations));
    try {
      const res = await submitSignup(fd);
      if (res.ok) {
        setDoneMessage(res.message);
        setDone(true);
      } else {
        /* Translated before it reaches state: the server answers in codes,
           and every field on this page renders errors[key] straight into the
           input's error slot, so an untranslated "exists" would print that
           word under the email field. See localiseServerErrors. */
        const shown = localiseServerErrors(res.errors, l);
        setErrors(shown);
        /* A server refusal lands on a field too — a duplicate email, or a
           CVR a raw POST got past the client. Same treatment. */
        focusFirstInvalid(shown);
      }
    } catch (err) {
      /* Belt and braces alongside submitSignup's own try/catch around
         createAdminClient() (app/actions.ts): an unconfigured service role
         used to throw here uncaught, and with no catch on this call the
         button sat on "Opretter…" forever with no error and no way out. */
      console.error("[odatone] signup submission failed unexpectedly", err);
      setErrors(localiseServerErrors({ form: "server" }, l));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Done locale={l} email={account.email} noInvite={doneMessage === "no-invite"} />;

  const problems = Object.keys(errors).filter((k) => k !== "form").length;
  /* Every key in FIELD_ORDER is rendered beside its own input. Anything else
     — `form`, or a key a future server check invents — has nowhere to appear,
     and an error nobody can see is worse than no validation at all. */
  const bannerKey = Object.keys(errors).find(
    (k) => !(FIELD_ORDER as readonly string[]).includes(k),
  );

  return (
    <form
      id="flow"
      noValidate
      onSubmit={submit}
      /* No `overflow-hidden` here, which the card carried until the flow
         became one page. It was there to clip the summary's background to
         the card's rounded corners, and it also made this element the
         scrollport for `position: sticky` inside it — and since the form
         itself does not scroll, the sticky summary never moved. That did not
         show while a step was one screen tall and the summary was always
         near the top. On a page three times that height it meant the summary
         sat far above the Abonnement section it describes, off screen for
         the whole of the choice it is there to price. The summary rounds its
         own corners instead. */
      className="u-card grid lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex flex-col gap-14 p-8 sm:p-11">
        {bannerKey && (
          <p role="alert" className="rounded-[var(--radius-lg)] bg-bad-soft px-5 py-4 text-[0.9375rem] text-bad">
            {errors[bannerKey]}
          </p>
        )}

        <Section index={0} locale={l} heading={t.company.heading[l]} body={t.company.body[l]}>
          <CompanyFields locale={l} account={account} errors={errors} onChange={changeAccount} />
        </Section>

        <Section index={1} locale={l} heading={t.account.heading[l]} body={t.account.body[l]}>
          <AccountFields locale={l} account={account} errors={errors} onChange={changeAccount} />
        </Section>

        <Section index={2} locale={l} heading={t.plan.heading[l]} body={t.plan.body[l]}>
          <SubscriptionFields
            locale={l}
            plans={plans}
            activePlanId={planId}
            billing={billing}
            locations={profile.locations}
            payment={payment}
            errors={errors}
            onPlan={choosePlan}
            onBilling={setBilling}
            onLocations={(n: number) => setProfilePatch({ locations: n })}
            onPayment={changePayment}
          />
        </Section>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {busy ? t.payment.submitting[l] : t.payment.submit[l]}
            <Arrow />
          </Button>
          {problems > 0 && (
            <p role="status" className="text-[0.875rem] text-warn">
              {problems === 1
                ? t.incomplete.one[l]
                : t.incomplete.many[l].replace("{n}", num(problems, l))}
            </p>
          )}
        </div>
      </div>

      {activePlan && (
        <Summary locale={l} profile={profile} plan={activePlan} billing={billing} />
      )}
    </form>
  );
}

/* ----------------------------- sections ------------------------------ */

/** Every field on the page, in render order. `firstInvalid` walks this, so
    an entry missing from it is a field the page can never scroll to. */
const FIELD_ORDER = [
  "company", "cvr", "address", "zip", "city",
  "name", "email",
  "plan", "card", "expiry", "cvc", "terms",
] as const;

/** Most fields are reachable by their input's `name`. The two that are not
    are the ones that have no text input at all: the plan is a row of
    buttons and the terms box is visually hidden, so both carry an id on the
    wrapper a visitor actually sees. */
const FIELD_TARGET: Record<string, string> = {
  plan: "#field-plan",
  terms: "#field-terms",
};

function focusFirstInvalid(errors: FieldErrors) {
  const key = FIELD_ORDER.find((k) => errors[k]);
  if (!key || typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>(FIELD_TARGET[key] ?? `[name="${key}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  /* preventScroll because scrollIntoView above is already doing it, and the
     two together produce a visible jerk. */
  el.focus({ preventScroll: true });
}

/** One numbered section. These replaced the wizard's step tabs: the number
    survives because it still tells you how much is left, but it labels a
    heading you scroll past rather than a tab you click. */
function Section({
  index,
  locale: l,
  heading,
  body,
  children,
}: {
  index: number;
  locale: Locale;
  heading: string;
  body: string;
  children: React.ReactNode;
}) {
  const t = tDefaults;
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="u-label flex items-center gap-2 text-accent">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>{t.sections[index].label[l]}</span>
        </p>
        <h2 className="u-display text-[clamp(1.5rem,3.2vw,2.05rem)]">{heading}</h2>
        <p className="u-lede max-w-[54ch] text-[1.0625rem]">{body}</p>
      </header>
      {children}
    </section>
  );
}



/** `plan` and `locations` have no text input of their own for a visitor to
    have left blank — they come from buttons and a counter — so the only
    way buildSignup rejects one is a raw field a legitimate browser session
    could not produce. Routing that through the generic "required" code
    said "Skal udfyldes" about a control where, from the visitor's point of
    view, nothing was blank at all. These get their own copy instead, naming
    what is actually wrong.

    `venueType` and `m2` used to be here too. Signup no longer collects them
    and buildSignup no longer validates them, so no server error can carry
    those keys; their copy stays in lib/content/signup.ts unused rather than
    being deleted, because the marketing calculator still speaks in those
    terms. */
const FIELD_ERROR_OVERRIDE: Record<string, string> = {
  plan: "planInvalid",
  locations: "locationsInvalid",
};

/** Server actions answer with short codes — "required", "exists", "server" —
    while client-side validation writes the shown string directly. The wizard
    got away with mixing the two because submission happened on the payment
    step, so a server error about the email arrived on a step where the email
    field was not rendered, and a banner translated it.
 *
 *  On one page that field IS rendered, and it would have printed the literal
 *  word "exists" under the input. So codes are translated on arrival and
 *  every error in state is displayable text from then on. A code with no copy
 *  falls back to the generic service message rather than showing itself. */
function localiseServerErrors(errors: FieldErrors, l: Locale): FieldErrors {
  const table = tDefaults.errors as unknown as Record<string, Record<Locale, string> | undefined>;
  const out: FieldErrors = {};
  for (const [key, code] of Object.entries(errors)) {
    const override = FIELD_ERROR_OVERRIDE[key];
    out[key] =
      (override ? table[override] : undefined)?.[l] ??
      table[code]?.[l] ??
      table.server?.[l] ??
      code;
  }
  return out;
}

function CompanyFields({
  locale: l,
  account,
  errors,
  onChange,
}: {
  locale: Locale;
  account: Account;
  errors: FieldErrors;
  /** The second argument is the field that changed, so the parent can drop
      that field's error and leave every other one alone. */
  onChange: (a: Account, field?: string) => void;
}) {
  const t = tDefaults;
  const set = (k: keyof Account) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...account, [k]: e.target.value }, k);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.fields.company[l]} name="company" value={account.company} onChange={set("company")} error={errors.company} autoComplete="organization" />
      {/* No "valgfri" hint: it is required now, and the hint is exactly what
          a visitor reads as permission to skip it. */}
      <Field label={t.fields.cvr[l]} name="cvr" inputMode="numeric" placeholder="12345678" value={account.cvr} onChange={set("cvr")} error={errors.cvr} />
      <Field label={t.fields.address[l]} name="address" value={account.address} onChange={set("address")} error={errors.address} autoComplete="street-address" className="sm:col-span-2" />
      <Field label={t.fields.zip[l]} name="zip" inputMode="numeric" value={account.zip} onChange={set("zip")} error={errors.zip} autoComplete="postal-code" />
      <Field label={t.fields.city[l]} name="city" value={account.city} onChange={set("city")} error={errors.city} autoComplete="address-level2" />
      <Field label={t.fields.phone[l]} name="phone" type="tel" hint={l === "da" ? "valgfri" : "optional"} value={account.phone} onChange={set("phone")} autoComplete="tel" />
    </div>
  );
}

function AccountFields({
  locale: l,
  account,
  errors,
  onChange,
}: {
  locale: Locale;
  account: Account;
  errors: FieldErrors;
  /** The second argument is the field that changed, so the parent can drop
      that field's error and leave every other one alone. */
  onChange: (a: Account, field?: string) => void;
}) {
  const t = tDefaults;
  const set = (k: keyof Account) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...account, [k]: e.target.value }, k);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.fields.name[l]} name="name" value={account.name} onChange={set("name")} error={errors.name} autoComplete="name" />
      <Field label={t.fields.email[l]} name="email" type="email" value={account.email} onChange={set("email")} error={errors.email} autoComplete="email" />
    </div>
  );
}

/** Plan, locations, billing term and payment, in one section. Payment was a
    step of its own; it is a subsection here, because "which plan, how many
    locations, billed how, paid how" is one decision described four ways and
    splitting it across a page boundary only made the summary beside it
    update in two places. */
function SubscriptionFields({
  locale: l,
  plans,
  activePlanId,
  billing,
  locations,
  payment,
  errors,
  onPlan,
  onBilling,
  onLocations,
  onPayment,
}: {
  locale: Locale;
  plans: Plan[];
  /** Null until the visitor picks. Nothing is recommended for them any
      more, so nothing is pre-selected. */
  activePlanId: PlanId | null;
  billing: Billing;
  locations: number;
  payment: Payment;
  errors: FieldErrors;
  onPlan: (id: PlanId) => void;
  onBilling: (b: Billing) => void;
  onLocations: (n: number) => void;
  onPayment: (p: Payment, field?: string) => void;
}) {
  const t = tDefaults;
  const ui = uiDefaults;
  const pricingCopy = pricingCopyDefaults;

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="u-label mb-3 text-ink-3">{t.summary.locations[l]}</legend>
        <div className="flex w-full max-w-[220px] items-center gap-1 rounded-full bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => onLocations(Math.max(1, locations - 1))}
            disabled={locations <= 1}
            aria-label="-1"
            className="grid h-10 w-10 place-items-center rounded-full text-[1.0625rem] text-ink-2 transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
          >
            −
          </button>
          <span className="u-num flex-1 text-center text-[1.25rem]">{num(locations, l)}</span>
          <button
            type="button"
            onClick={() => onLocations(Math.min(99, locations + 1))}
            aria-label="+1"
            className="grid h-10 w-10 place-items-center rounded-full text-[1.0625rem] text-ink-2 transition-colors hover:bg-surface hover:text-ink"
          >
            +
          </button>
        </div>
      </fieldset>

      <div className="inline-flex gap-0.5 self-start rounded-full bg-surface-2 p-1">
        {(["monthly", "annual"] as Billing[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onBilling(b)}
            aria-pressed={billing === b}
            className={`rounded-full px-5 py-2 text-[0.875rem] font-medium transition-colors ${
              billing === b ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
            }`}
          >
            {b === "monthly" ? pricingCopy.monthly[l] : pricingCopy.annual[l]}
          </button>
        ))}
      </div>

      {/* tabIndex so focusFirstInvalid can put focus here: there is no input
          to focus when the thing that is missing is a choice between
          buttons. */}
      <div id="field-plan" tabIndex={-1} className="flex flex-col gap-3 outline-none">
        {plans.map((p) => {
          const active = p.id === activePlanId;
          const pq = quote(p, billing, 1);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPlan(p.id)}
              aria-pressed={active}
              className={`flex flex-col gap-3 rounded-[var(--radius-lg)] p-5 text-left transition-colors sm:flex-row sm:items-center sm:gap-6 ${
                active ? "bg-surface-2 ring-1 ring-accent/40" : "bg-surface-2/50 hover:bg-surface-2"
              }`}
            >
              <span
                className={`mt-1 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border ${
                  active ? "border-accent bg-accent text-accent-ink" : "border-line-strong"
                }`}
              >
                {active && <CheckIcon size={11} />}
              </span>
              <span className="flex-1">
                <span className="u-title block text-[1.0625rem]">{p.name}</span>
                <span className="mt-1 block text-sm text-ink-2">{p.tagline[l]}</span>
              </span>
              <span className="text-right">
                <span className="u-num block text-[1.375rem]">{kr(Math.round(pq.perLocation), l)}</span>
                <span className="u-label mt-1 block text-ink-3">
                  {ui.perMonthPerLocation[l]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {errors.plan && <p className="u-label text-warn">{errors.plan}</p>}

      <PaymentFields locale={l} payment={payment} errors={errors} onChange={onPayment} />
    </div>
  );
}

function PaymentFields({
  locale: l,
  payment,
  errors,
  onChange,
}: {
  locale: Locale;
  payment: Payment;
  errors: FieldErrors;
  onChange: (p: Payment, field?: string) => void;
}) {
  const t = tDefaults;

  const set = (k: keyof Payment) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...payment, [k]: e.target.value }, k);

  return (
    <div className="flex flex-col gap-6 border-t border-line pt-8">
      <div className="flex flex-col gap-2">
        <h3 className="u-title text-[1.0625rem]">{t.payment.subheading[l]}</h3>
        <p className="text-[0.9375rem] text-ink-2">{t.payment.body[l]}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label={t.payment.cardNumber[l]} name="card" inputMode="numeric" placeholder="0000 0000 0000 0000" value={payment.card} onChange={set("card")} error={errors.card} autoComplete="off" />
        <Field label={t.payment.expiry[l]} name="expiry" placeholder="12 / 29" value={payment.expiry} onChange={set("expiry")} error={errors.expiry} autoComplete="off" />
        <Field label={t.payment.cvc[l]} name="cvc" inputMode="numeric" placeholder="123" value={payment.cvc} onChange={set("cvc")} error={errors.cvc} autoComplete="off" />
      </div>

      <label id="field-terms" tabIndex={-1} className="flex cursor-pointer items-start gap-3 outline-none">
        <input
          type="checkbox"
          name="terms"
          checked={payment.terms}
          onChange={(e) => onChange({ ...payment, terms: e.target.checked }, "terms")}
          className="peer sr-only"
        />
        <span
          className={`mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
            payment.terms ? "border-accent bg-accent text-accent-ink" : "border-line-strong"
          }`}
        >
          {payment.terms && <CheckIcon size={12} />}
        </span>
        <span className="text-[0.9375rem] text-ink-2">
          {t.payment.terms[l]}{" "}
          <Link href={href(l, "terms")} className="u-link">
            {l === "da" ? "Læs dem" : "Read them"}
          </Link>
        </span>
      </label>
      {errors.terms && <p className="u-label -mt-4 text-warn">{errors.terms}</p>}

      <p className="u-label text-ink-3">{t.payment.demoNote[l]}</p>
    </div>
  );
}

/* ------------------------------ summary ------------------------------ */

function Summary({
  locale: l,
  profile,
  plan,
  billing,
}: {
  locale: Locale;
  profile: VenueProfile;
  plan: Plan;
  billing: Billing;
}) {
  const t = tDefaults;
  const pricingCopy = pricingCopyDefaults;

  const q = quote(plan, billing, profile.locations);
  return (
    <aside className="rounded-b-[var(--radius-xl)] border-t border-line bg-surface-2/60 lg:rounded-b-none lg:rounded-r-[var(--radius-xl)] lg:border-l lg:border-t-0">
      <div className="sticky top-[64px] flex flex-col gap-6 p-7 sm:p-8">
        <h2 className="u-label text-ink-3">{t.summary.heading[l]}</h2>

        <dl className="flex flex-col gap-3 border-b border-line pb-6 text-[0.875rem]">
          <Row label={t.summary.locations[l]} value={num(profile.locations, l)} />
          <Row label={t.summary.plan[l]} value={q.plan.name} />
          <Row
            label={t.summary.billing[l]}
            value={billing === "annual" ? pricingCopy.annual[l] : pricingCopy.monthly[l]}
          />
        </dl>

        <dl className="flex flex-col gap-3 border-b border-line pb-6 text-[0.875rem]">
          <Row label={t.summary.perLocation[l]} value={kr(Math.round(q.perLocation), l)} />
          {q.volumeDiscountPct > 0 && (
            <Row
              label={t.summary.volumeDiscount[l]}
              value={`−${num(q.volumeDiscountPct, l)} %`}
              accent
            />
          )}
          {q.annualDiscountPct > 0 && (
            <Row
              label={t.summary.annualDiscount[l]}
              value={`−${num(q.annualDiscountPct, l)} %`}
              accent
            />
          )}
        </dl>

        <div className="flex flex-col gap-2">
          <p className="u-label text-ink-3">{t.summary.dueToday[l]}</p>
          <p className="u-num u-gradient text-[1.875rem]">{t.summary.freeTrial[l]}</p>
          <p className="u-tabular text-[0.8125rem] text-ink-2">
            {t.summary.thenPay[l]} {kr(Math.round(q.chargeExVat), l)}
            {billing === "annual" ? (l === "da" ? "/år" : "/yr") : l === "da" ? "/md." : "/mo"} ·{" "}
            {kr(Math.round(q.chargeIncVat), l)} {t.summary.incVat[l]}
          </p>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className={`text-right ${accent ? "text-accent" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

/* -------------------------------- done ------------------------------- */

function Done({
  locale: l,
  email,
  noInvite,
}: {
  locale: Locale;
  email: string;
  /** True when submitSignup (app/actions.ts) returned `message: "no-invite"`
      — the account was created but the invite email itself could not be
      sent. Fix round 1's finding: this screen used to say "we've sent a
      confirmation" regardless, which is simply false in that case. */
  noInvite?: boolean;
}) {
  const t = tDefaults;
  const body = (noInvite ? t.done.bodyNoInvite[l] : t.done.body[l]).replace("{email}", email || "—");

  return (
    <div className="u-card p-9 sm:p-14">
      <div className="flex max-w-[62ch] flex-col gap-7">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-ink">
          <CheckIcon size={20} />
        </span>
        <h2 className="u-display text-[clamp(2.2rem,6vw,3.8rem)]">{t.done.heading[l]}</h2>
        <p className="u-lede">{body}</p>

        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {t.done.next[l].map(([title, body], i) => (
            <li key={title} className="rounded-[var(--radius-lg)] bg-surface-2 p-6">
              <p className="u-num u-gradient mb-4 text-[1.75rem]">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="u-title mb-2 text-[1rem]">{title}</h3>
              <p className="text-[0.875rem] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-3">
          <LinkButton href={href(l, "player")} variant="primary" size="lg">
            {t.done.openPlayer[l]}
            <Arrow />
          </LinkButton>
          <LinkButton href={href(l, "signup")} variant="outline" size="lg">
            {t.done.startOver[l]}
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
