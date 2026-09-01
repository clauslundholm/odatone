"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { PLANS, quote, recommendPlan, type Billing, type PlanId } from "@/lib/pricing";
import {
  HOURS_BANDS,
  VENUE_TYPES,
  calculate,
  venueType,
  type HoursBand,
  type VenueTypeId,
} from "@/lib/rates";
import { DEFAULT_PROFILE, loadProfile, saveProfile, type VenueProfile } from "@/lib/profile";
import { submitSignup } from "@/app/actions";
import { EMAIL_RE, digits, type FieldErrors } from "@/lib/forms";
import { signup as t } from "@/lib/content/signup";
import { ui } from "@/lib/content/common";
import { pricing as pricingCopy } from "@/lib/content/pricing";
import { href, type Locale } from "@/lib/i18n";
import { kr, m2 as fmtM2, num } from "@/lib/format";
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

type Payment = {
  method: "card" | "invoice";
  card: string;
  expiry: string;
  cvc: string;
  ean: string;
  po: string;
  terms: boolean;
};

const EMPTY_PAYMENT: Payment = {
  method: "card",
  card: "",
  expiry: "",
  cvc: "",
  ean: "",
  po: "",
  terms: false,
};

export default function SignupFlow({ locale }: { locale: Locale }) {
  const l = locale;
  const router = useRouter();
  const search = useSearchParams();

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<VenueProfile>(DEFAULT_PROFILE);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [account, setAccount] = useState<Account>(EMPTY_ACCOUNT);
  const [payment, setPayment] = useState<Payment>(EMPTY_PAYMENT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /* Pick up the calculator's answers and any ?plan= / ?billing= link. */
  useEffect(() => {
    setProfile(loadProfile());
    const p = search.get("plan");
    if (p && PLANS.some((x) => x.id === p)) setPlanId(p as PlanId);
    const b = search.get("billing");
    if (b === "annual" || b === "monthly") setBilling(b);
    const s = Number(search.get("step"));
    if (Number.isFinite(s) && s >= 1 && s <= 4) setStep(s - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggested = useMemo(
    () => recommendPlan(profile.m2, profile.type),
    [profile.m2, profile.type],
  );
  const activePlanId: PlanId = planId ?? suggested.id;

  const q = useMemo(
    () => quote(activePlanId, billing, profile.locations),
    [activePlanId, billing, profile.locations],
  );

  const result = useMemo(
    () =>
      calculate({
        type: profile.type,
        m2: profile.m2,
        hours: profile.hours,
        locations: profile.locations,
        includeStreaming: profile.includeStreaming,
        odatonePerLocationMonth: q.perLocation,
      }),
    [profile, q.perLocation],
  );

  const setProfilePatch = (patch: Partial<VenueProfile>) => {
    setProfile((prev) => {
      const nextProfile = { ...prev, ...patch };
      saveProfile(nextProfile);
      return nextProfile;
    });
  };

  const goto = (n: number) => {
    setStep(n);
    setErrors({});
    const params = new URLSearchParams(search.toString());
    params.set("step", String(n + 1));
    router.replace(`?${params.toString()}`, { scroll: false });
    if (typeof window !== "undefined") {
      document.getElementById("flow")?.scrollIntoView({ block: "start" });
    }
  };

  const validateAccount = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!account.name.trim()) e.name = t.errors.required[l];
    if (!account.company.trim()) e.company = t.errors.required[l];
    if (account.cvr && digits(account.cvr).length !== 8) e.cvr = t.errors.cvr[l];
    if (!EMAIL_RE.test(account.email)) e.email = t.errors.email[l];
    if (!account.address.trim()) e.address = t.errors.required[l];
    if (!account.zip.trim()) e.zip = t.errors.required[l];
    if (!account.city.trim()) e.city = t.errors.required[l];
    return e;
  };

  const validatePayment = (): FieldErrors => {
    const e: FieldErrors = {};
    if (payment.method === "card") {
      if (digits(payment.card).length !== 16) e.card = t.errors.card[l];
      if (!/^\d{2}\s*\/\s*\d{2}$/.test(payment.expiry.trim())) e.expiry = t.errors.expiry[l];
      if (digits(payment.cvc).length !== 3) e.cvc = t.errors.cvc[l];
    } else if (payment.ean && digits(payment.ean).length !== 13) {
      e.ean = t.errors.ean[l];
    }
    if (!payment.terms) e.terms = t.errors.terms[l];
    return e;
  };

  const advance = () => {
    if (step === 2) {
      const e = validateAccount();
      if (Object.keys(e).length) {
        setErrors(e);
        return;
      }
    }
    goto(Math.min(3, step + 1));
  };

  const finish = async () => {
    const e = validatePayment();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("name", account.name);
    fd.set("company", account.company);
    fd.set("cvr", account.cvr);
    fd.set("email", account.email);
    fd.set("phone", account.phone);
    fd.set("address", `${account.address}, ${account.zip} ${account.city}`);
    fd.set("planId", activePlanId);
    fd.set("billing", billing);
    fd.set("locations", String(profile.locations));
    fd.set("venueType", profile.type);
    fd.set("m2", String(profile.m2));
    fd.set("paymentMethod", payment.method);
    const res = await submitSignup(fd);
    setBusy(false);
    if (res.ok) setDone(true);
    else setErrors(res.errors);
  };

  if (done) return <Done locale={l} email={account.email} />;

  return (
    <div id="flow" className="u-card grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <ol className="grid grid-cols-4 border-b border-line">
          {t.steps.map((s, i) => {
            const state = i === step ? "current" : i < step ? "done" : "todo";
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => goto(i)}
                  className={`flex w-full flex-col items-start gap-2.5 px-4 py-4 text-left transition-colors sm:px-6 ${
                    state === "todo" ? "cursor-default" : "hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-[0.8125rem] font-medium ${
                      state === "current"
                        ? "text-accent"
                        : state === "done"
                          ? "text-ink-2"
                          : "text-ink-3"
                    }`}
                  >
                    {state === "done" ? (
                      <CheckIcon size={12} />
                    ) : (
                      <span>{String(i + 1).padStart(2, "0")}</span>
                    )}
                    <span className="hidden sm:inline">{s.label[l]}</span>
                  </span>
                  <span
                    className={`h-0.5 w-full rounded-full ${
                      state === "todo" ? "bg-surface-3" : "bg-accent"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ol>

        <div className="p-8 sm:p-11">
          {step === 0 && (
            <StepVenue locale={l} profile={profile} onChange={setProfilePatch} saving={result.savingYear} />
          )}
          {step === 1 && (
            <StepPlan
              locale={l}
              activePlanId={activePlanId}
              suggestedId={suggested.id}
              billing={billing}
              m2={profile.m2}
              onPlan={setPlanId}
              onBilling={setBilling}
            />
          )}
          {step === 2 && (
            <StepAccount locale={l} account={account} errors={errors} onChange={setAccount} />
          )}
          {step === 3 && (
            <StepPayment locale={l} payment={payment} errors={errors} onChange={setPayment} />
          )}

          <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-8">
            {step > 0 && (
              <Button variant="outline" onClick={() => goto(step - 1)}>
                {ui.back[l]}
              </Button>
            )}
            {step < 3 ? (
              <Button variant="primary" size="lg" onClick={advance}>
                {ui.next[l]}
                <Arrow />
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={finish} disabled={busy}>
                {busy ? t.payment.submitting[l] : t.payment.submit[l]}
                <Arrow />
              </Button>
            )}
            <p className="u-label ml-auto">
              {String(step + 1)} / {t.steps.length}
            </p>
          </div>
        </div>
      </div>

      <Summary
        locale={l}
        profile={profile}
        planId={activePlanId}
        billing={billing}
        savingYear={result.savingYear}
      />
    </div>
  );
}

/* ------------------------------- steps ------------------------------- */

function StepHead({ heading, body }: { heading: string; body: string }) {
  return (
    <header className="mb-8 flex flex-col gap-3">
      <h2 className="u-display text-[clamp(1.6rem,3.6vw,2.3rem)]">{heading}</h2>
      <p className="u-lede max-w-[54ch] text-[1.0625rem]">{body}</p>
    </header>
  );
}

function StepVenue({
  locale: l,
  profile,
  onChange,
  saving,
}: {
  locale: Locale;
  profile: VenueProfile;
  onChange: (p: Partial<VenueProfile>) => void;
  saving: number;
}) {
  const v = venueType(profile.type);
  return (
    <div className="flex flex-col gap-9">
      <StepHead heading={t.venue.heading[l]} body={t.venue.body[l]} />

      <fieldset>
        <legend className="u-label mb-4 text-ink-3">{t.summary.venue[l]}</legend>
        <div className="flex flex-wrap gap-2">
          {VENUE_TYPES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                const nv = venueType(x.id as VenueTypeId);
                onChange({
                  type: x.id,
                  m2: Math.min(Math.max(profile.m2, nv.minM2), nv.maxM2),
                });
              }}
              aria-pressed={profile.type === x.id}
              className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-colors ${
                profile.type === x.id
                  ? "bg-accent text-accent-ink"
                  : "bg-surface-2 text-ink-2 hover:text-ink"
              }`}
            >
              {x.label[l]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-3 flex items-baseline justify-between">
          <legend className="u-label text-ink-3">{t.summary.area[l]}</legend>
          <span className="u-num text-2xl text-accent">{fmtM2(profile.m2, l)}</span>
        </div>
        <input
          type="range"
          className="oda-range"
          min={v.minM2}
          max={v.maxM2}
          step={5}
          value={profile.m2}
          aria-label={t.summary.area[l]}
          style={{ ["--fill" as string]: `${((profile.m2 - v.minM2) / (v.maxM2 - v.minM2)) * 100}%` }}
          onChange={(e) => onChange({ m2: Number(e.target.value) })}
        />
      </fieldset>

      <div className="grid gap-8 sm:grid-cols-2">
        <fieldset>
          <legend className="u-label mb-3 text-ink-3">
            {l === "da" ? "Åbningstid" : "Opening hours"}
          </legend>
          <div className="flex flex-col gap-0.5 rounded-[var(--radius-lg)] bg-surface-2 p-1">
            {HOURS_BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onChange({ hours: b.id as HoursBand })}
                aria-pressed={profile.hours === b.id}
                className={`rounded-[var(--radius-md)] px-4 py-2.5 text-left text-[0.875rem] font-medium transition-colors ${
                  profile.hours === b.id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {b.label[l]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="u-label mb-3 text-ink-3">{t.summary.locations[l]}</legend>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => onChange({ locations: Math.max(1, profile.locations - 1) })}
              disabled={profile.locations <= 1}
              aria-label="-1"
              className="grid h-10 w-10 place-items-center rounded-full text-[1.0625rem] text-ink-2 transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
            >
              −
            </button>
            <span className="u-num flex-1 text-center text-[1.25rem]">{num(profile.locations, l)}</span>
            <button
              type="button"
              onClick={() => onChange({ locations: Math.min(99, profile.locations + 1) })}
              aria-label="+1"
              className="grid h-10 w-10 place-items-center rounded-full text-[1.0625rem] text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              +
            </button>
          </div>
        </fieldset>
      </div>

      <p className="rounded-[var(--radius-lg)] bg-surface-2 px-5 py-4 text-[0.9375rem] text-ink-2">
        {t.venue.savingsNote[l]}{" "}
        <span className="u-num text-accent">{kr(saving, l)}</span>{" "}
        {l === "da" ? "om året." : "a year."}{" "}
        <span className="text-ink-3">{ui.indicative[l]}</span>
      </p>
    </div>
  );
}

function StepPlan({
  locale: l,
  activePlanId,
  suggestedId,
  billing,
  m2,
  onPlan,
  onBilling,
}: {
  locale: Locale;
  activePlanId: PlanId;
  suggestedId: PlanId;
  billing: Billing;
  m2: number;
  onPlan: (id: PlanId) => void;
  onBilling: (b: Billing) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <StepHead heading={t.plan.heading[l]} body={t.plan.body[l]} />

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

      <div className="flex flex-col gap-3">
        {PLANS.map((p) => {
          const active = p.id === activePlanId;
          const tooSmall = p.maxM2 !== null && m2 > p.maxM2;
          const pq = quote(p.id, billing, 1);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPlan(p.id)}
              aria-pressed={active}
              disabled={tooSmall}
              className={`flex flex-col gap-3 rounded-[var(--radius-lg)] p-5 text-left transition-colors sm:flex-row sm:items-center sm:gap-6 ${
                active ? "bg-surface-2 ring-1 ring-accent/40" : "bg-surface-2/50 hover:bg-surface-2"
              } ${tooSmall ? "opacity-40" : ""}`}
            >
              <span
                className={`mt-1 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border ${
                  active ? "border-accent bg-accent text-accent-ink" : "border-line-strong"
                }`}
              >
                {active && <CheckIcon size={11} />}
              </span>
              <span className="flex-1">
                <span className="u-title block text-[1.0625rem]">
                  {p.name}
                  {p.id === suggestedId && (
                    <span className="u-label ml-3 align-middle text-accent">
                      {t.plan.recommended[l]}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-ink-2">
                  {tooSmall ? t.plan.tooSmall[l] : p.tagline[l]}
                </span>
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
    </div>
  );
}

function StepAccount({
  locale: l,
  account,
  errors,
  onChange,
}: {
  locale: Locale;
  account: Account;
  errors: FieldErrors;
  onChange: (a: Account) => void;
}) {
  const set = (k: keyof Account) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...account, [k]: e.target.value });

  return (
    <div className="flex flex-col gap-8">
      <StepHead heading={t.account.heading[l]} body={t.account.body[l]} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.fields.name[l]} name="name" value={account.name} onChange={set("name")} error={errors.name} autoComplete="name" />
        <Field label={t.fields.company[l]} name="company" value={account.company} onChange={set("company")} error={errors.company} autoComplete="organization" />
        <Field label={t.fields.email[l]} name="email" type="email" value={account.email} onChange={set("email")} error={errors.email} autoComplete="email" />
        <Field label={t.fields.phone[l]} name="phone" type="tel" hint={l === "da" ? "valgfri" : "optional"} value={account.phone} onChange={set("phone")} autoComplete="tel" />
        <Field label={t.fields.cvr[l]} name="cvr" inputMode="numeric" hint={l === "da" ? "valgfri" : "optional"} value={account.cvr} onChange={set("cvr")} error={errors.cvr} />
        <Field label={t.fields.address[l]} name="address" value={account.address} onChange={set("address")} error={errors.address} autoComplete="street-address" />
        <Field label={t.fields.zip[l]} name="zip" inputMode="numeric" value={account.zip} onChange={set("zip")} error={errors.zip} autoComplete="postal-code" />
        <Field label={t.fields.city[l]} name="city" value={account.city} onChange={set("city")} error={errors.city} autoComplete="address-level2" />
      </div>
    </div>
  );
}

function StepPayment({
  locale: l,
  payment,
  errors,
  onChange,
}: {
  locale: Locale;
  payment: Payment;
  errors: FieldErrors;
  onChange: (p: Payment) => void;
}) {
  const set = (k: keyof Payment) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...payment, [k]: e.target.value });

  return (
    <div className="flex flex-col gap-8">
      <StepHead heading={t.payment.heading[l]} body={t.payment.body[l]} />

      <div className="inline-flex gap-0.5 self-start rounded-full bg-surface-2 p-1">
        {(["card", "invoice"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...payment, method: m })}
            aria-pressed={payment.method === m}
            className={`rounded-full px-5 py-2 text-[0.875rem] font-medium transition-colors ${
              payment.method === m ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
            }`}
          >
            {m === "card" ? t.payment.card[l] : t.payment.invoice[l]}
          </button>
        ))}
      </div>

      {payment.method === "card" ? (
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label={t.payment.cardNumber[l]} name="card" inputMode="numeric" placeholder="0000 0000 0000 0000" value={payment.card} onChange={set("card")} error={errors.card} autoComplete="off" />
          <Field label={t.payment.expiry[l]} name="expiry" placeholder="12 / 29" value={payment.expiry} onChange={set("expiry")} error={errors.expiry} autoComplete="off" />
          <Field label={t.payment.cvc[l]} name="cvc" inputMode="numeric" placeholder="123" value={payment.cvc} onChange={set("cvc")} error={errors.cvc} autoComplete="off" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.payment.ean[l]} name="ean" inputMode="numeric" hint={l === "da" ? "valgfri" : "optional"} value={payment.ean} onChange={set("ean")} error={errors.ean} />
          <Field label={t.payment.po[l]} name="po" hint={l === "da" ? "valgfri" : "optional"} value={payment.po} onChange={set("po")} />
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={payment.terms}
          onChange={(e) => onChange({ ...payment, terms: e.target.checked })}
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
  planId,
  billing,
  savingYear,
}: {
  locale: Locale;
  profile: VenueProfile;
  planId: PlanId;
  billing: Billing;
  savingYear: number;
}) {
  const q = quote(planId, billing, profile.locations);
  const v = venueType(profile.type);

  return (
    <aside className="border-t border-line bg-surface-2/60 lg:border-l lg:border-t-0">
      <div className="sticky top-[64px] flex flex-col gap-6 p-7 sm:p-8">
        <h2 className="u-label text-ink-3">{t.summary.heading[l]}</h2>

        <dl className="flex flex-col gap-3 border-b border-line pb-6 text-[0.875rem]">
          <Row label={t.summary.venue[l]} value={v.label[l]} />
          <Row label={t.summary.area[l]} value={fmtM2(profile.m2, l)} />
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

        <div className="border-t border-line pt-6">
          <p className="u-label mb-2 text-ink-3">{t.summary.savingLine[l]}</p>
          <p className="u-num text-[1.5rem] text-accent">
            {kr(savingYear, l)}
            <span className="ml-1.5 text-[0.4em] tracking-normal text-ink-2">
              {l === "da" ? "/år" : "/yr"}
            </span>
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

function Done({ locale: l, email }: { locale: Locale; email: string }) {
  return (
    <div className="u-card p-9 sm:p-14">
      <div className="flex max-w-[62ch] flex-col gap-7">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-ink">
          <CheckIcon size={20} />
        </span>
        <h2 className="u-display text-[clamp(2.2rem,6vw,3.8rem)]">{t.done.heading[l]}</h2>
        <p className="u-lede">{t.done.body[l].replace("{email}", email || "—")}</p>

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
