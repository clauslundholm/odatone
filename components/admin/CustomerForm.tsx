"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { updateCustomer, type CustomerFormState } from "@/app/admin/customers/[id]/actions";
import { CUSTOMER_STATUSES } from "@/app/admin/customers/[id]/validate";

/**
 * The customer's own details, editable in place.
 *
 * Everything on this page was read-only until now: an operator who found
 * a misspelled company name or a dead billing address had no way to fix
 * it short of the Supabase dashboard. This is the smallest thing that
 * changes that — the same nine columns the panel already displayed,
 * behind the same `customers_staff_update` policy any staff role already
 * holds.
 *
 * Deliberately a plain uncontrolled form with `defaultValue`, matching
 * the products editor. The values come from the row on first render and
 * from `state.values` after a rejected save, because React resets an
 * uncontrolled form the moment its action resolves — without the echo, a
 * bad postcode would silently revert the other eight fields to the
 * stored row and look like a save that had worked backwards.
 */

const initial: CustomerFormState = {};

/** One message per failure the action can return. Keyed by the field the
    parser names, so adding a rule to validate.ts surfaces here rather
    than falling through to the generic line. */
const MESSAGES: Record<string, string> = {
  name: "A company name is required.",
  billing_email: "That does not look like an email address.",
  cvr: "A Danish CVR is eight digits. For a company outside Denmark, set the country first.",
  postcode: "A Danish postcode is four digits.",
  country: "Use a two-letter country code, like DK or DE.",
  status: "Pick one of the listed statuses.",
  conflict: "Another customer already uses that billing email.",
  denied: "Your account is not allowed to change this customer.",
  save: "Something went wrong saving this customer. Nothing was changed.",
};

type Customer = {
  id: string;
  name: string;
  cvr: string | null;
  billing_email: string;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  status: string;
};

function Input({
  name, label, defaultValue, type = "text", required = false, mono = false,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="u-label">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className={`rounded-[var(--radius-sm)] border border-line bg-bg px-3 py-2 text-[0.875rem] text-ink outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--c-accent-soft)] ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

export function CustomerForm({ customer }: { customer: Customer }) {
  const [state, formAction, pending] = useActionState(updateCustomer, initial);
  /* The submitted value wins over the stored one, so a rejected save
     leaves the operator looking at what they typed. */
  const v = (key: keyof Customer, fallback: string | null) =>
    state.values?.[key] ?? fallback ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={customer.id} />

      <div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
        <Input name="name" label="Company name" defaultValue={v("name", customer.name)} required />
        <Input name="cvr" label="CVR" defaultValue={v("cvr", customer.cvr)} mono />
        <Input
          name="billing_email"
          label="Billing email"
          type="email"
          defaultValue={v("billing_email", customer.billing_email)}
          required
        />
        <Input name="phone" label="Phone" defaultValue={v("phone", customer.phone)} mono />
        <Input name="address" label="Address" defaultValue={v("address", customer.address)} />
        <Input name="postcode" label="Postcode" defaultValue={v("postcode", customer.postcode)} mono />
        <Input name="city" label="City" defaultValue={v("city", customer.city)} />
        <Input name="country" label="Country" defaultValue={v("country", customer.country ?? "DK")} mono />
        <label className="flex flex-col gap-1.5">
          <span className="u-label">Status</span>
          <select
            name="status"
            defaultValue={v("status", customer.status)}
            className="rounded-[var(--radius-sm)] border border-line bg-bg px-3 py-2 text-[0.875rem] text-ink outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          >
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {state.error && (
          <p role="alert" className="text-[0.8125rem] text-warn">
            {MESSAGES[state.error] ?? MESSAGES.save}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-[0.8125rem] text-ink-2">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
