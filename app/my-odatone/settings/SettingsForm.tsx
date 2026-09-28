"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { ActionResult } from "@/lib/forms";
import type { Locale } from "@/lib/i18n";
import { portal } from "@/lib/content/portal";
import { updateBillingDetails } from "./actions";

const initialState: ActionResult | Record<string, never> = {};

export type BillingDetails = {
  billingEmail: string;
  cvr: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
};

/**
 * The settings page's one form: the caller's own billing details, plus a
 * read-only company-name row above it.
 *
 * `canEdit` is `role === "owner"`, resolved once by page.tsx (the same
 * `profiles.role` read every /my-odatone page already needs for
 * PortalShell's own WorkspaceCard subtitle) and passed down rather than
 * re-read here. It gates the UI only — every field renders `disabled` for
 * a manager, with `managerNotice` explaining why, but that is courtesy
 * dressing, not the control: `updateBillingDetails` (./actions.ts) refuses
 * the write itself, under the `customers_owner_update` RLS policy, and
 * would refuse it exactly the same way if a manager re-enabled these
 * fields from devtools or posted the form directly with no UI at all.
 *
 * This component's inputs are uncontrolled (`defaultValue`), and page.tsx
 * deliberately does not force a remount on save (see its own comment on
 * why an earlier draft's `key` broke the "saved" message below). That is
 * not a gap: on a successful save the value a visitor sees is exactly what
 * they just typed, which is exactly what the server now holds — a fresh
 * `defaultValue` from revalidated props would render the identical string.
 * Only a save from a *second* tab or device would leave this component
 * showing a stale value until the page is next reloaded, and nothing on
 * this single-operator form depends on that being instant.
 */
export function SettingsForm({
  locale,
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
  const t = portal.settings;

  const errors = state && "ok" in state && !state.ok ? state.errors : undefined;
  const saved = Boolean(state && "ok" in state && state.ok);

  const errorText = (code?: string): string | undefined =>
    code ? (t.errors[code] ?? t.errors.save)[locale] : undefined;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[0.9375rem] font-medium text-ink">{t.companyPanel[locale]}</h2>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <div className="flex flex-col gap-1">
            <span className="u-label">{t.companyLabel[locale]}</span>
            <span className="text-[0.875rem] text-ink">{companyName}</span>
          </div>
          <p className="text-[0.8125rem] text-ink-2">{t.companyNote[locale]}</p>
        </div>
      </div>

      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-5"
      >
        <h2 className="text-[0.9375rem] font-medium text-ink">{t.billingPanel[locale]}</h2>

        {!canEdit && (
          <p role="status" className="text-[0.8125rem] text-ink-2">
            {t.managerNotice[locale]}
          </p>
        )}

        <Field
          label={t.billingEmailLabel[locale]}
          name="billingEmail"
          type="email"
          defaultValue={initial.billingEmail}
          disabled={!canEdit}
          required
          error={errorText(errors?.billingEmail)}
        />
        <Field
          label={t.cvrLabel[locale]}
          name="cvr"
          hint={t.cvrHint[locale]}
          defaultValue={initial.cvr}
          disabled={!canEdit}
          error={errorText(errors?.cvr)}
        />
        <Field
          label={t.addressLabel[locale]}
          name="address"
          defaultValue={initial.address}
          disabled={!canEdit}
          error={errorText(errors?.address)}
        />
        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <Field
            label={t.postcodeLabel[locale]}
            name="postcode"
            defaultValue={initial.postcode}
            disabled={!canEdit}
            error={errorText(errors?.postcode)}
          />
          <Field
            label={t.cityLabel[locale]}
            name="city"
            defaultValue={initial.city}
            disabled={!canEdit}
            error={errorText(errors?.city)}
          />
        </div>
        <Field
          label={t.phoneLabel[locale]}
          name="phone"
          type="tel"
          defaultValue={initial.phone}
          disabled={!canEdit}
          error={errorText(errors?.phone)}
        />

        {errors?.form && (
          <p role="alert" className="text-[0.8125rem] text-bad">
            {errorText(errors.form)}
          </p>
        )}
        {saved && (
          <p role="status" className="text-[0.8125rem] text-ok">
            {t.saved[locale]}
          </p>
        )}

        {canEdit && (
          <div>
            <Button type="submit" size="md" disabled={pending}>
              {pending ? t.submitPending[locale] : t.submit[locale]}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
