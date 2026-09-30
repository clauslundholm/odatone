"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextField } from "@/components/ui/Field";
import { toKroner } from "@/lib/money";
import type { PlanRow } from "@/lib/plans-row";
import {
  type ProductFormState,
  createAddon,
  createPlan,
  deleteAddon,
  deletePlan,
  updateAddon,
  updatePlan,
} from "@/app/admin/products/actions";

type AddonRow = {
  id: string;
  name: { da: string; en: string };
  monthly_ore: number;
  active: boolean;
};

const INITIAL_STATE: ProductFormState = {};

/** Prefers a value the server echoed back over the form's own default.
    React resets an uncontrolled form once its Server Action resolves, so
    without this a rejected submit handed back an empty dialog (on create) or
    silently undid the operator's edits (on edit) — see actions.ts's
    PLAN_FIELDS comment. */
const kept = (state: ProductFormState, field: string, fallback: string | number) =>
  state.values?.[field] ?? fallback;

/** The checkbox equivalent. An unchecked checkbox sends nothing at all, so
    `values.active` is "" rather than absent — which is why this cannot be
    written as `kept(...) === "on"` against a missing key. */
const keptActive = (state: ProductFormState, fallback: boolean) =>
  state.values ? state.values.active === "on" : fallback;

/** "forbidden" is the one actually reachable when a staff_support account
    submits this form — see actions.ts's `.select("id")` comment. "save" is
    left as a generic fallback for a genuine, unexpected database error
    (a dropped connection, a constraint this form doesn't already check),
    which is a real but different situation from a refused write. */
const PLAN_ERRORS: Record<string, string> = {
  "missing-id": "Something went wrong identifying this plan. Reload and try again.",
  id: "An id must be lowercase letters, digits and single hyphens, starting with a letter — e.g. arena-stage.",
  duplicate: "A plan with that id already exists. Pick another id, or edit the existing plan.",
  price: "Enter a price of 0 or more, e.g. 149 or 149.50.",
  maxM2: "Max area must be a whole number of m², or blank for unbounded.",
  name: "A plan needs a name.",
  tagline: "Both taglines are required — a blank one shows as a blank card on the public site.",
  forbidden: "Only staff_admin can save this. Ask an admin to make the change.",
  save: "Something went wrong saving this plan. Try again in a moment.",
};

/** The form for one plan, shown inside the products dialog
    (components/admin/ProductsBoxes.tsx). It carries no card chrome of its
    own — the Modal supplies the frame, the heading and the close control.
 *
 *  `plan` is null when creating. One form serves both so a field can never be
 *  validated on edit and not on create, or offered on one and forgotten on the
 *  other; ./actions.ts's `parsePlanFields` is the same arrangement on the
 *  server side, and for the same reason.
 *
 *  Every save round-trips through updatePlan / createPlan
 *  (app/admin/products/actions.ts), which authorise nothing themselves — the
 *  `plans_admin_write` RLS policy (staff_admin only) is what decides whether
 *  the write happens at all, so a staff_support account sees this exact form
 *  submit and the database refuse it (surfaced here as the "forbidden" error,
 *  not a silent no-op). */
export function PlanForm({
  plan,
  onSaved,
}: {
  /** The plan being edited, or null to create a new one. */
  plan: (PlanRow & { active: boolean }) | null;
  /** Called once the write actually succeeded. The dialog closes on it —
      the new figure appearing on the box behind is better confirmation
      than a line of text inside a panel that is about to disappear. */
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(plan ? updatePlan : createPlan, INITIAL_STATE);

  useEffect(() => {
    if (state.ok && !state.error) onSaved?.();
  }, [state.ok, state.error, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {plan ? (
        /* An existing plan's id is fixed. It is the primary key
           `subscriptions.plan_id` references (0002_commerce.sql), so changing
           it is a migration rather than an edit — and every audit_log row
           already written about this plan names the old one. */
        <input type="hidden" name="id" value={plan.id} />
      ) : (
        <Field
          label="Id"
          name="id"
          required
          autoFocus
          hint="permanent, lowercase"
          placeholder="arena-stage"
          defaultValue={kept(state, "id", "")}
        />
      )}

      <Field label="Name" name="name" defaultValue={kept(state, "name", plan?.name ?? "")} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Price (kr / location / month, ex. VAT)"
          name="monthly"
          type="number"
          min={0}
          max={21474836.47}
          step="0.01"
          defaultValue={kept(state, "monthly", plan ? toKroner(plan.monthly_ore) : "")}
          required
        />
        <Field
          label="Max area (m²)"
          name="maxM2"
          type="number"
          min={0}
          max={2147483647}
          hint="blank = unbounded"
          defaultValue={kept(state, "maxM2", plan?.max_m2 ?? "")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tagline (Danish)" name="taglineDa" defaultValue={kept(state, "taglineDa", plan?.tagline.da ?? "")} />
        <Field label="Tagline (English)" name="taglineEn" defaultValue={kept(state, "taglineEn", plan?.tagline.en ?? "")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Features (Danish)"
          name="featuresDa"
          hint="one per line"
          defaultValue={kept(state, "featuresDa", plan?.features.map((f) => f.da).join("\n") ?? "")}
        />
        <TextField
          label="Features (English)"
          name="featuresEn"
          hint="one per line, same order"
          defaultValue={kept(state, "featuresEn", plan?.features.map((f) => f.en).join("\n") ?? "")}
        />
      </div>

      {/* A new plan defaults to active: someone filling in a price and two
          taglines is publishing a plan, not drafting one. Unchecking it here
          is how you stage one instead. */}
      <ActiveToggle defaultChecked={keptActive(state, plan?.active ?? true)} />

      {state.error && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {PLAN_ERRORS[state.error] ?? "Something went wrong saving this plan."}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={pending}>
        {pending ? (plan ? "Saving…" : "Creating…") : plan ? "Save plan" : "Create plan"}
      </Button>
    </form>
  );
}

const ADDON_ERRORS: Record<string, string> = {
  "missing-id": "Something went wrong identifying this add-on. Reload and try again.",
  id: "An id must be lowercase letters, digits and single hyphens, starting with a letter — e.g. live-sets.",
  duplicate: "An add-on with that id already exists. Pick another id, or edit the existing add-on.",
  price: "Enter a price of 0 or more, e.g. 199 or 199.50.",
  name: "Both names are required — a blank one shows as a blank label wherever that language is used.",
  forbidden: "Only staff_admin can save this. Ask an admin to make the change.",
  save: "Something went wrong saving this add-on. Try again in a moment.",
};

/** The form for one add-on, same arrangement as PlanForm — `addon` is null
    when creating.
    Nothing on the marketing site reads `addons` from the database yet
    (lib/rates.ts's STREAMING_MONTHLY_DEFAULT is still a compiled constant),
    so saving here changes the row but — unlike a plan — has no live public
    surface to verify against today. See task-12-report.md. */
export function AddonForm({
  addon,
  onSaved,
}: {
  addon: AddonRow | null;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    addon ? updateAddon : createAddon,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok && !state.error) onSaved?.();
  }, [state.ok, state.error, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {addon ? (
        <input type="hidden" name="id" value={addon.id} />
      ) : (
        <Field
          label="Id"
          name="id"
          required
          autoFocus
          hint="permanent, lowercase"
          placeholder="live-sets"
          defaultValue={kept(state, "id", "")}
        />
      )}

      {/* Until now an add-on's name could be set only by the seed migration,
          so a created one would have had no way to be corrected — and the box
          on this page is labelled from `name.en`. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name (Danish)" name="nameDa" defaultValue={kept(state, "nameDa", addon?.name.da ?? "")} required />
        <Field label="Name (English)" name="nameEn" defaultValue={kept(state, "nameEn", addon?.name.en ?? "")} required />
      </div>

      <Field
        label="Price (kr / month, ex. VAT)"
        name="monthly"
        type="number"
        min={0}
        max={21474836.47}
        step="0.01"
        defaultValue={kept(state, "monthly", addon ? toKroner(addon.monthly_ore) : "")}
        required
      />

      <ActiveToggle defaultChecked={keptActive(state, addon?.active ?? true)} />

      {state.error && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {ADDON_ERRORS[state.error] ?? "Something went wrong saving this add-on."}
        </p>
      )}
      <Button type="submit" size="sm" className="self-start" disabled={pending}>
        {pending ? (addon ? "Saving…" : "Creating…") : addon ? "Save add-on" : "Create add-on"}
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

const DELETE_ERRORS: Record<string, string> = {
  "missing-id": "Something went wrong identifying this. Reload and try again.",
  confirm: "Type the id exactly as shown to confirm.",
  forbidden: "Only staff_admin can delete this. Ask an admin to make the change.",
  save: "Something went wrong deleting this. Try again in a moment.",
};

/** The delete control for an existing plan or add-on, rendered inside the
    same dialog as its form but deliberately outside it — a `<form>` cannot
    nest, and a single form with two submit buttons makes "which one did
    Enter press" a question nobody should have to answer about a delete.
 *
 *  Collapsed until asked for, then it wants the id typed. The id rather than
 *  a plain "are you sure": every product box in the grid opens a dialog that
 *  looks like this one, and typing "arena-stage" is the step that cannot be
 *  completed on the wrong dialog by muscle memory. The server checks the same
 *  thing (./actions.ts), because this endpoint is a POST anyone can send.
 *
 *  A plan that subscriptions reference cannot be deleted at all — the answer
 *  is the Active toggle above, which keeps existing subscriptions working and
 *  removes the plan from new signups. The refusal says so with the number of
 *  subscriptions involved, because "you cannot" without "how many" leaves an
 *  operator with nothing to check. */
export function DeleteProduct({
  kind,
  id,
  name,
  onDeleted,
}: {
  kind: "plan" | "addon";
  id: string;
  name: string;
  /** Called once the row is actually gone; the dialog closes on it. */
  onDeleted?: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    kind === "plan" ? deletePlan : deleteAddon,
    INITIAL_STATE,
  );
  const noun = kind === "plan" ? "plan" : "add-on";

  useEffect(() => {
    if (state.ok && !state.error) onDeleted?.();
  }, [state.ok, state.error, onDeleted]);

  const inUse =
    state.error === "in-use"
      ? typeof state.count === "number"
        ? `${state.count} subscription${state.count === 1 ? " is" : "s are"} on this ${noun}, so it cannot be deleted. Switch Active off instead — existing subscriptions keep working and it disappears from new signups.`
        : `A subscription was added to this ${noun} just now, so it cannot be deleted. Switch Active off instead.`
      : null;

  return (
    <div className="mt-6 border-t border-line pt-5">
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="text-[0.8125rem] text-bad underline decoration-bad/40 underline-offset-2 transition-colors hover:decoration-bad focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Delete this {noun}
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-[0.8125rem] text-ink-2">
            Deleting <span className="font-medium text-ink">{name}</span> cannot be undone. Type{" "}
            <span className="font-mono text-ink">{id}</span> to confirm.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="Confirm id"
              name="confirm"
              autoFocus
              autoComplete="off"
              placeholder={id}
              className="max-w-[240px]"
              defaultValue={kept(state, "confirm", "")}
            />
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? "Deleting…" : `Delete ${noun}`}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setArmed(false)}>
              Cancel
            </Button>
          </div>
          {(inUse || state.error) && (
            <p role="alert" className="text-[0.8125rem] text-bad">
              {inUse ?? DELETE_ERRORS[state.error as string] ?? `Something went wrong deleting this ${noun}.`}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
