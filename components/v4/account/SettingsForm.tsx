"use client";

import { useActionState } from "react";

import { updateBillingDetails } from "@/app/[locale]/_account-actions";
import { Button } from "@/components/ui/Button";
import { portal } from "@/lib/content/portal";
import { v4 as t } from "@/lib/content/v4";
import type { ActionResult } from "@/lib/forms";
import type { Locale } from "@/lib/i18n";

const initialState: ActionResult | Record<string, never> = {};

export type BillingDetails = {
  billingEmail: string;
  cvr: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
};

const SHELL =
  "w-full rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)] disabled:text-ink-3";

function Input({
  label,
  name,
  error,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="flex items-baseline gap-1.5 text-[0.875rem] text-ink-2">
        {label}
        {hint && <span className="text-[0.8125rem] text-ink-3">({hint})</span>}
      </span>
      <input
        name={name}
        aria-invalid={error ? true : undefined}
        className={`${SHELL} ${error ? "border-warn" : ""}`}
        {...rest}
      />
      {error && <span className="text-[0.8125rem] text-warn">{error}</span>}
    </label>
  );
}

/**
 * The left-hand column of Indstillinger: the company name, read-only,
 * over everything `updateBillingDetails` can write.
 *
 * `canEdit` is `role === "owner"`, resolved on the server and passed
 * down. It gates the UI only — every field renders `disabled` for a
 * manager, with a line saying why — but that is courtesy dressing, not
 * the control: the action refuses the write itself under the
 * `customers_owner_update` RLS policy, and would refuse it identically
 * if a manager re-enabled these fields from devtools or posted the form
 * with no UI in front of it at all.
 *
 * The inputs are uncontrolled, and the page deliberately does not force
 * a remount on save: on a successful save the value on screen is exactly
 * what was typed, which is exactly what the server now holds. Keying
 * this on anything that changes across a save remounts the component in
 * the same commit as the action's result and the "saved" line never gets
 * a render to appear in — which is what an earlier version of this form
 * did, and why it looked like saving silently failed.
 */
export function SettingsForm({
  locale: l,
  canEdit,
  companyName,
  initial,
}: {
  locale: Locale;
  canEdit: boolean;
  companyName: string;
  initial: BillingDetails;
}) {
  const [state, formAction, pending] = useActionState(updateBillingDetails, initialState as ActionResult);
  const a = t.account.settings;
  const p = portal.settings;

  const errors = state && "ok" in state && !state.ok ? state.errors : undefined;
  const saved = Boolean(state && "ok" in state && state.ok);
  const errorText = (code?: string): string | undefined =>
    code ? (p.errors[code] ?? p.errors.save)[l] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="u-card flex flex-col">
        <header className="border-b border-line px-6 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink">{a.companyPanel[l]}</h2>
        </header>
        <div className="flex flex-col gap-2 p-6">
          {/* Never writable here, by anyone: the company name is what
              already-issued invoices say, so changing it is a
              conversation with Odatone rather than a form field. */}
          <Input label={a.companyName[l]} name="companyName" defaultValue={companyName} disabled readOnly />
          <p className="text-[0.8125rem] leading-relaxed text-ink-3">{p.companyNote[l]}</p>
        </div>
      </section>

      <section className="u-card flex flex-col">
        <header className="border-b border-line px-6 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink">{a.billingPanel[l]}</h2>
        </header>
        <div className="flex flex-col gap-4 p-6">
          {!canEdit && (
            <p role="status" className="text-[0.8125rem] leading-relaxed text-ink-2">
              {p.managerNotice[l]}
            </p>
          )}

          <Input
            label={p.billingEmailLabel[l]}
            name="billingEmail"
            type="email"
            autoComplete="email"
            defaultValue={initial.billingEmail}
            disabled={!canEdit}
            required
            error={errorText(errors?.billingEmail)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={p.cvrLabel[l]}
              name="cvr"
              hint={p.cvrHint[l]}
              inputMode="numeric"
              defaultValue={initial.cvr}
              disabled={!canEdit}
              error={errorText(errors?.cvr)}
            />
            <Input
              label={p.phoneLabel[l]}
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={initial.phone}
              disabled={!canEdit}
              error={errorText(errors?.phone)}
            />
          </div>
          <Input
            label={p.addressLabel[l]}
            name="address"
            autoComplete="street-address"
            defaultValue={initial.address}
            disabled={!canEdit}
            error={errorText(errors?.address)}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_1.6fr]">
            <Input
              label={p.postcodeLabel[l]}
              name="postcode"
              autoComplete="postal-code"
              defaultValue={initial.postcode}
              disabled={!canEdit}
              error={errorText(errors?.postcode)}
            />
            <Input
              label={p.cityLabel[l]}
              name="city"
              autoComplete="address-level2"
              defaultValue={initial.city}
              disabled={!canEdit}
              error={errorText(errors?.city)}
            />
          </div>
        </div>
      </section>

      {errors?.form && (
        <p role="alert" className="text-[0.875rem] text-bad">
          {errorText(errors.form)}
        </p>
      )}
      {saved && (
        <p role="status" className="text-[0.875rem] text-ok">
          {p.saved[l]}
        </p>
      )}

      {canEdit && (
        <div>
          <Button type="submit" size="md" disabled={pending}>
            {pending ? p.submitPending[l] : p.submit[l]}
          </Button>
        </div>
      )}
    </form>
  );
}
