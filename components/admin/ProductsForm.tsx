"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextField } from "@/components/ui/Field";
import { toKroner } from "@/lib/money";
import type { PlanRow } from "@/lib/plans-row";
import { updateAddon, updatePlan } from "@/app/admin/products/actions";

type AddonRow = {
  id: string;
  name: { da: string; en: string };
  monthly_ore: number;
  active: boolean;
};

type FormState = { error?: string; ok?: boolean };
const INITIAL_STATE: FormState = {};

/** "forbidden" is the one actually reachable when a staff_support account
    submits this form — see actions.ts's `.select("id")` comment. "save" is
    left as a generic fallback for a genuine, unexpected database error
    (a dropped connection, a constraint this form doesn't already check),
    which is a real but different situation from a refused write. */
const PLAN_ERRORS: Record<string, string> = {
  "missing-id": "Something went wrong identifying this plan. Reload and try again.",
  price: "Enter a price of 0 or more, e.g. 149 or 149.50.",
  maxM2: "Max area must be a whole number of m², or blank for unbounded.",
  name: "A plan needs a name.",
  tagline: "Both taglines are required — a blank one shows as a blank card on the public site.",
  forbidden: "Only staff_admin can save this. Ask an admin to make the change.",
  save: "Something went wrong saving this plan. Try again in a moment.",
};

/** The edit form for one plan, shown inside the products dialog
    (components/admin/ProductsBoards.tsx). It carries no card chrome of its
    own — the Modal supplies the frame, the heading and the close control.

    Every save round-trips through updatePlan
    (app/admin/products/actions.ts), which authorises nothing itself — the
    `plans_admin_write` RLS policy (staff_admin only) is what decides
    whether the write happens at all, so a staff_support account sees this
    exact form submit and the database refuse it (surfaced here as the
    "forbidden" error, not a silent no-op). */
export function PlanForm({
  plan,
  onSaved,
}: {
  plan: PlanRow & { active: boolean };
  /** Called once the write actually succeeded. The dialog closes on it —
      the new figure appearing on the box behind is better confirmation
      than a line of text inside a panel that is about to disappear. */
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updatePlan, INITIAL_STATE);
  const featuresDa = plan.features.map((f) => f.da).join("\n");
  const featuresEn = plan.features.map((f) => f.en).join("\n");

  useEffect(() => {
    if (state.ok && !state.error) onSaved?.();
  }, [state.ok, state.error, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={plan.id} />

      <Field label="Name" name="name" defaultValue={plan.name} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Price (kr / location / month, ex. VAT)"
          name="monthly"
          type="number"
          min={0}
          max={21474836.47}
          step="0.01"
          defaultValue={toKroner(plan.monthly_ore)}
          required
        />
        <Field
          label="Max area (m²)"
          name="maxM2"
          type="number"
          min={0}
          max={2147483647}
          hint="blank = unbounded"
          defaultValue={plan.max_m2 ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tagline (Danish)" name="taglineDa" defaultValue={plan.tagline.da} />
        <Field label="Tagline (English)" name="taglineEn" defaultValue={plan.tagline.en} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Features (Danish)"
          name="featuresDa"
          hint="one per line"
          defaultValue={featuresDa}
        />
        <TextField
          label="Features (English)"
          name="featuresEn"
          hint="one per line, same order"
          defaultValue={featuresEn}
        />
      </div>

      <ActiveToggle defaultChecked={plan.active} />

      {state.error && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {PLAN_ERRORS[state.error] ?? "Something went wrong saving this plan."}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={pending}>
        {pending ? "Saving…" : "Save plan"}
      </Button>
    </form>
  );
}

const ADDON_ERRORS: Record<string, string> = {
  "missing-id": "Something went wrong identifying this add-on. Reload and try again.",
  price: "Enter a price of 0 or more, e.g. 199 or 199.50.",
  forbidden: "Only staff_admin can save this. Ask an admin to make the change.",
  save: "Something went wrong saving this add-on. Try again in a moment.",
};

/** The edit form for the one add-on (currently "streaming"), same
    arrangement as PlanForm.
    Nothing on the marketing site reads `addons` from the database yet
    (lib/rates.ts's STREAMING_MONTHLY_DEFAULT is still a compiled constant),
    so saving here changes the row but — unlike a plan — has no live public
    surface to verify against today. See task-12-report.md. */
export function AddonForm({ addon, onSaved }: { addon: AddonRow; onSaved?: () => void }) {
  const [state, formAction, pending] = useActionState(updateAddon, INITIAL_STATE);

  useEffect(() => {
    if (state.ok && !state.error) onSaved?.();
  }, [state.ok, state.error, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={addon.id} />

      <Field
        label="Price (kr / month, ex. VAT)"
        name="monthly"
        type="number"
        min={0}
        max={21474836.47}
        step="0.01"
        defaultValue={toKroner(addon.monthly_ore)}
        required
      />

      <ActiveToggle defaultChecked={addon.active} />

      {state.error && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {ADDON_ERRORS[state.error] ?? "Something went wrong saving this add-on."}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={pending}>
        {pending ? "Saving…" : "Save add-on"}
      </Button>
    </form>
  );
}

/** The same switch pattern components/marketing/Calculator.tsx uses for its
    streaming toggle: a visually-hidden checkbox driving a styled track via
    the peer selector, so it's a real, keyboard- and form-submittable
    checkbox (name="active") rather than a div pretending to be one. */
function ActiveToggle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        name="active"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      {/* The knob's offset is driven from the TRACK, not from the knob.
          `peer-checked:` compiles to a following-sibling selector, and the
          knob is a descendant of a sibling rather than a sibling itself —
          so `peer-checked:left-[20px]` on the knob never matched anything
          and it sat on the left however the checkbox was set. The track
          recoloured correctly, which is what made it look plausible. */}
      <span className="relative grid h-[26px] w-[44px] shrink-0 items-center rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-checked:[&>span]:left-[20px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        <span className="absolute left-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-all duration-200" />
      </span>
      <span className="text-[0.875rem] text-ink-2">Active on the public site</span>
    </label>
  );
}
