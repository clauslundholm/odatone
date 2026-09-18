"use client";

import { useActionState } from "react";

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

const PLAN_ERRORS: Record<string, string> = {
  "missing-id": "Something went wrong identifying this plan. Reload and try again.",
  price: "Enter a price of 0 or more.",
  name: "A plan needs a name.",
  save: "The database refused this save. If you're signed in as staff_support, that's expected — only staff_admin may change prices.",
};

/** One card per plan (Task 12). Every save round-trips through updatePlan
    (app/admin/products/actions.ts), which authorises nothing itself — the
    `plans_admin_write` RLS policy (staff_admin only) is what decides
    whether the write happens at all, so a staff_support account sees this
    exact form submit and the database refuse it. */
export function PlanCard({ plan }: { plan: PlanRow & { active: boolean } }) {
  const [state, formAction, pending] = useActionState(updatePlan, {} as { error?: string });
  const featuresDa = plan.features.map((f) => f.da).join("\n");
  const featuresEn = plan.features.map((f) => f.en).join("\n");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-[var(--radius-md)] border border-line bg-surface p-6"
    >
      <input type="hidden" name="id" value={plan.id} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.0625rem] font-medium text-ink">{plan.name}</h2>
        <span className="u-label text-ink-3">{plan.id}</span>
      </div>

      <Field label="Name" name="name" defaultValue={plan.name} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Price (kr / location / month, ex. VAT)"
          name="monthly"
          type="number"
          min={0}
          step="0.01"
          defaultValue={toKroner(plan.monthly_ore)}
          required
        />
        <Field
          label="Max area (m²)"
          name="maxM2"
          type="number"
          min={0}
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
        <p role="alert" className="text-[0.8125rem] text-warn">
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
  price: "Enter a price of 0 or more.",
  save: "The database refused this save. If you're signed in as staff_support, that's expected — only staff_admin may change prices.",
};

/** Same card shape as PlanCard, for the one add-on (currently "streaming").
    Nothing on the marketing site reads `addons` from the database yet
    (lib/rates.ts's STREAMING_MONTHLY_DEFAULT is still a compiled constant),
    so saving here changes the row but — unlike a plan — has no live public
    surface to verify against today. See task-12-report.md. */
export function AddonCard({ addon }: { addon: AddonRow }) {
  const [state, formAction, pending] = useActionState(updateAddon, {} as { error?: string });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-[var(--radius-md)] border border-line bg-surface p-6"
    >
      <input type="hidden" name="id" value={addon.id} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.0625rem] font-medium text-ink">{addon.name.en} (add-on)</h2>
        <span className="u-label text-ink-3">{addon.id}</span>
      </div>

      <Field
        label="Price (kr / month, ex. VAT)"
        name="monthly"
        type="number"
        min={0}
        step="0.01"
        defaultValue={toKroner(addon.monthly_ore)}
        required
      />

      <ActiveToggle defaultChecked={addon.active} />

      {state.error && (
        <p role="alert" className="text-[0.8125rem] text-warn">
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
      <span className="relative grid h-[26px] w-[44px] shrink-0 items-center rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        <span className="absolute left-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-all duration-200 peer-checked:left-[20px]" />
      </span>
      <span className="text-[0.875rem] text-ink-2">Active on the public site</span>
    </label>
  );
}
