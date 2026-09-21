"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { inviteStaff } from "@/app/admin/users/actions";
import { STAFF_ROLES, STAFF_ROLE_HINT, STAFF_ROLE_LABEL } from "@/lib/staff-invite";
import type { ActionResult } from "@/lib/forms";

const initialState: ActionResult | Record<string, never> = {};

const FIELD_MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  exists: "That address already has an Odatone account.",
  long: "That's too long.",
  required: "This is required.",
  forbidden: "Only an Admin can invite staff.",
  service: "Something went wrong on our end. Please try again in a moment.",
};

/**
 * The invite form on /admin/users. Rendered only for a `staff_admin` —
 * `inviteStaff` refuses anyone else regardless, so this is about not
 * showing a control that would only ever fail, not about enforcement.
 */
export function InviteStaffForm() {
  const [state, formAction, pending] = useActionState(inviteStaff, initialState as ActionResult);

  const errors = state && "ok" in state && !state.ok ? state.errors : undefined;
  const sent = Boolean(state && "ok" in state && state.ok);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Field
          label="Full name"
          name="fullName"
          autoComplete="off"
          required
          error={errors?.fullName && FIELD_MESSAGES[errors.fullName]}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          required
          error={errors?.email && FIELD_MESSAGES[errors.email]}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="u-label mb-1">Role</legend>
        {STAFF_ROLES.map((role, i) => (
          <label
            key={role}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-line p-3 transition-colors hover:border-line-strong"
          >
            <input
              type="radio"
              name="role"
              value={role}
              defaultChecked={i === 0}
              className="mt-0.5 accent-[var(--c-accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.875rem] font-medium text-ink">{STAFF_ROLE_LABEL[role]}</span>
              <span className="text-[0.8125rem] text-ink-2">{STAFF_ROLE_HINT[role]}</span>
            </span>
          </label>
        ))}
        {errors?.role && (
          <p role="alert" className="text-[0.8125rem] text-bad">
            Choose a role.
          </p>
        )}
      </fieldset>

      {errors?.form && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {FIELD_MESSAGES[errors.form] ?? FIELD_MESSAGES.service}
        </p>
      )}
      {sent && (
        <p role="status" className="text-[0.8125rem] text-ok">
          Invitation sent. The link is good for 24 hours.
        </p>
      )}

      <div>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}
