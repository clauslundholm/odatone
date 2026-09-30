"use server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { revalidatePlans } from "@/lib/plans-server";
import { toOre } from "@/lib/money";
import { parseFeatures, parseMaxM2, parsePriceKr, parseProductId } from "./validate";

type L10nInput = { da: string; en: string };

type PlanFields = {
  name: string;
  monthly_ore: number;
  max_m2: number | null;
  tagline: L10nInput;
  features: L10nInput[];
  active: boolean;
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/* Shared by updatePlan and createPlan so the two cannot validate
   differently. They did not start out sharing it, and the risk that made
   them is concrete: every guard below was added by a fix round that found a
   specific bad value reaching the database (a blank price saved as 0 kr. and
   advertised on /da/priser, `Number("abc")` written as `max_m2 = null` and
   silently making a plan unbounded — see ./validate.ts). A create path with
   its own copy of this would have reopened each of them one at a time. */
function parsePlanFields(formData: FormData): Parsed<PlanFields> {
  const name = String(formData.get("name") ?? "").trim();
  const taglineDa = String(formData.get("taglineDa") ?? "").trim();
  const taglineEn = String(formData.get("taglineEn") ?? "").trim();
  const featuresDa = String(formData.get("featuresDa") ?? "");
  const featuresEn = String(formData.get("featuresEn") ?? "");
  const active = formData.get("active") === "on";

  const monthly = parsePriceKr(String(formData.get("monthly") ?? ""));
  if (monthly === null) return { ok: false, error: "price" };
  const maxM2 = parseMaxM2(String(formData.get("maxM2") ?? ""));
  if (maxM2 === null) return { ok: false, error: "maxM2" };
  if (!name) return { ok: false, error: "name" };
  /* A blank tagline in one language isn't a placeholder a visitor never
     sees — PricingTable/Calculator/HeroSavings all render `tagline[l]`
     directly, so a blank here is a blank card on the public site in that
     language, with no error anywhere to explain why. */
  if (!taglineDa || !taglineEn) return { ok: false, error: "tagline" };

  return {
    ok: true,
    value: {
      name,
      monthly_ore: toOre(monthly),
      max_m2: maxM2.value,
      tagline: { da: taglineDa, en: taglineEn },
      features: parseFeatures(featuresDa, featuresEn),
      active,
    },
  };
}

/* React resets an uncontrolled form once its Server Action resolves. Every
   field here is a `defaultValue`, so a rejected submit used to hand the
   operator an empty dialog: twelve fields typed, one of them wrong, all of
   them gone. On the edit forms the same reset was quieter and arguably
   worse — the fields snapped back to the stored row, so a failed save looked
   like it had worked in reverse.

   So every failure returns what was submitted, and the forms prefer those
   values over their defaults. Only these fields are echoed, by name: a
   blanket "return the whole FormData" would put whatever else a crafted POST
   carried straight back into the rendered page. */
const PLAN_FIELDS = [
  "id", "name", "monthly", "maxM2", "taglineDa", "taglineEn", "featuresDa", "featuresEn", "active",
] as const;
const ADDON_FIELDS = ["id", "nameDa", "nameEn", "monthly", "active"] as const;
/* The delete form has one field, and keeping it filled matters most on the
   "in use" refusal, where the operator did nothing wrong and is about to
   reach for the Active toggle instead. */
const DELETE_FIELDS = ["confirm"] as const;

export type ProductFormValues = Record<string, string>;

/** What every action in this file returns, and what the forms read. One type
    for all six so a form cannot be written against a shape only one action
    produces: `values` is present on every failure, `count` only on the
    "in-use" refusal, and `ok` only on success. */
export type ProductFormState = {
  ok?: boolean;
  error?: string;
  values?: ProductFormValues;
  count?: number;
};

function rawValues(formData: FormData, keys: readonly string[]): ProductFormValues {
  const out: ProductFormValues = {};
  for (const key of keys) out[key] = String(formData.get(key) ?? "");
  return out;
}

export async function updatePlan(_prev: unknown, formData: FormData): Promise<ProductFormState> {
  const fail = (error: string) => ({ error, values: rawValues(formData, PLAN_FIELDS) });
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("missing-id");

  const fields = parsePlanFields(formData);
  if (!fields.ok) return fail(fields.error);

  const supabase = await createClient();
  /* No service role here, and no role check either: the staff_admin-only
     `plans_admin_write` policy (supabase/migrations/0003_tenancy.sql) is
     the sole authority over whether this write happens. `.select("id")`
     is not for reading data back — it's how a *refused* write is told
     apart from a *successful* one. RLS enforces `plans_admin_write` by
     excluding a disallowed row from the UPDATE's affected set entirely,
     which Postgres does not treat as an error: a staff_support account's
     update matches zero rows and `error` comes back null. Without the
     `.select()`, that zero-row update is indistinguishable from a real
     one, `revalidatePlans()` would fire on a write that never happened,
     and the UI would report success for a save the database silently
     dropped. An empty `data` array is exactly that case. */
  const { data, error } = await supabase
    .from("plans")
    .update({ ...fields.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) return fail("save");
  if (!data || data.length === 0) return fail("forbidden");

  revalidatePlans();
  /* See createPlan's note: revalidatePlans() invalidates the public pricing
     cache, but this page's own grid is an uncached session-client read, and
     only revalidatePath re-renders the current route in the action's
     response. Without it the dialog closed onto the old price. */
  revalidatePath("/admin/products");
  return { ok: true };
}

/* An INSERT refused by RLS behaves the opposite way to the UPDATE above, and
   the difference is worth naming once here for all three create/delete
   actions. `plans_admin_write` carries an explicit `with check
   (is_staff_admin())` as well as its `using` clause, and a `with check`
   violation *raises* — SQLSTATE 42501, "new row violates row-level security
   policy" — rather than quietly matching zero rows the way a `using` clause
   filters an UPDATE or DELETE. So a create detects a refusal from the error
   code, and an update or delete detects it from an empty result. Neither
   check substitutes for the other: reading `data.length` on an insert would
   never see the refusal because the statement never returns, and looking for
   42501 on an update would never see it because no error is raised. */
const RLS_REFUSED = "42501";
const UNIQUE_VIOLATION = "23505";

export async function createPlan(_prev: unknown, formData: FormData): Promise<ProductFormState> {
  const fail = (error: string) => ({ error, values: rawValues(formData, PLAN_FIELDS) });
  const id = parseProductId(String(formData.get("id") ?? ""));
  if (id === null) return fail("id");

  const fields = parsePlanFields(formData);
  if (!fields.ok) return fail(fields.error);

  const supabase = await createClient();

  /* `plans.sort` is `integer not null` with no default (0002_commerce.sql),
     so an insert has to supply one, and a new plan belongs after the ones
     that exist — the products grid and the public pricing page both order by
     it. Two admins creating a plan at the same instant would compute the
     same number; `sort` is not unique and only decides display order, so the
     consequence is two cards in an arbitrary order relative to each other,
     which either admin can fix by editing. Worth a read rather than a lock. */
  const { data: last, error: sortError } = await supabase
    .from("plans")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1);
  if (sortError) return fail("save");
  const sort = ((last?.[0]?.sort as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from("plans")
    .insert({ id, ...fields.value, sort })
    .select("id");

  if (error?.code === UNIQUE_VIOLATION) return fail("duplicate");
  if (error?.code === RLS_REFUSED) return fail("forbidden");
  if (error) {
    console.error("[admin products] failed to create plan", error);
    return fail("save");
  }
  /* Belt and braces. A refusal should have arrived as 42501 above, but an
     insert that returns no row is a write this action cannot claim
     succeeded, whatever the reason — and reporting success here would leave
     an operator looking at a grid with no new plan in it and no error. */
  if (!data || data.length === 0) return fail("forbidden");

  revalidatePlans();
  /* The grid on this page is read with the session client, uncached, so it
     is not `revalidatePlans()`'s tag that refreshes it. Without this the
     dialog would close onto the same grid it opened from: revalidateTag does
     not re-render the current route as part of the action's response (see
     Next's Server Actions guide), revalidatePath does. */
  revalidatePath("/admin/products");
  return { ok: true };
}

/** The add-on lives in its own table with its own RLS policy
    (`addons_admin_write`, also staff_admin-only — see
    supabase/migrations/0003_tenancy.sql), so it gets its own actions rather
    than being folded into the plan ones. Nothing on the marketing site reads
    `addons` from the database yet (Task 6 wired the `plans` table only,
    lib/rates.ts's STREAMING_MONTHLY_DEFAULT is still compiled-in), so unlike
    a plan price this has no revalidatePlans()-equivalent to call and no
    live surface to verify against today — see task-12-report.md. It is,
    however, audited exactly like a plan change (0004_audit_triggers.sql's
    `addons_audit` trigger, added in Task 12's fix round after a review
    found a `staff_admin` could reprice the add-on with no audit trail at
    all while the equivalent plan edit was recorded). */
type AddonFields = { name: L10nInput; monthly_ore: number; active: boolean };

function parseAddonFields(formData: FormData): Parsed<AddonFields> {
  const nameDa = String(formData.get("nameDa") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const active = formData.get("active") === "on";

  const monthly = parsePriceKr(String(formData.get("monthly") ?? ""));
  if (monthly === null) return { ok: false, error: "price" };
  /* Both languages required for the same reason a plan's tagline is: the
     name is rendered from `name[locale]`, so a blank one is a blank label
     wherever that locale is shown — including on this page's own box, which
     reads `name.en`. */
  if (!nameDa || !nameEn) return { ok: false, error: "name" };

  return { ok: true, value: { name: { da: nameDa, en: nameEn }, monthly_ore: toOre(monthly), active } };
}

export async function updateAddon(_prev: unknown, formData: FormData): Promise<ProductFormState> {
  const fail = (error: string) => ({ error, values: rawValues(formData, ADDON_FIELDS) });
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("missing-id");

  const fields = parseAddonFields(formData);
  if (!fields.ok) return fail(fields.error);

  const supabase = await createClient();
  /* See updatePlan's comment on `.select("id")` — same reasoning, same
     RLS-refusal shape, same `addons_admin_write` policy. */
  const { data, error } = await supabase
    .from("addons")
    .update(fields.value)
    .eq("id", id)
    .select("id");

  if (error) return fail("save");
  if (!data || data.length === 0) return fail("forbidden");

  revalidatePath("/admin/products");
  return { ok: true };
}

export async function createAddon(_prev: unknown, formData: FormData): Promise<ProductFormState> {
  const fail = (error: string) => ({ error, values: rawValues(formData, ADDON_FIELDS) });
  const id = parseProductId(String(formData.get("id") ?? ""));
  if (id === null) return fail("id");

  const fields = parseAddonFields(formData);
  if (!fields.ok) return fail(fields.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addons")
    .insert({ id, ...fields.value })
    .select("id");

  if (error?.code === UNIQUE_VIOLATION) return fail("duplicate");
  if (error?.code === RLS_REFUSED) return fail("forbidden");
  if (error) {
    console.error("[admin products] failed to create add-on", error);
    return fail("save");
  }
  if (!data || data.length === 0) return fail("forbidden");

  revalidatePath("/admin/products");
  return { ok: true };
}

/* A plan or add-on that nothing references can be deleted outright; one that
   something references cannot, and must not be. `subscriptions.plan_id` and
   `subscription_addons.addon_id` are `not null references ...` with no
   `on delete` clause (0002_commerce.sql), so Postgres refuses the delete —
   and that refusal, not the count below, is the actual guarantee. The count
   exists to tell the operator *how many*, which a bare 23503 cannot, and to
   say so before anything is attempted.

   Two reasons the count is not load-bearing. It is read under the caller's
   own RLS, and `subscriptions_read` scopes non-staff to their own rows, so a
   caller who is not staff would see zero (they are refused at the delete
   itself by `plans_admin_write`, so this is not a hole — but a count they
   could trust would be). And a signup can create a subscription between the
   count and the delete, which is exactly what the foreign key is for. Hence
   23503 is handled as "in use" too, just without a number.

   The alternative to refusing — deleting the plan and moving its subscribers
   somewhere else — would silently change what those customers pay. That is a
   decision to record per customer, not a side effect of a delete button. */
const FK_VIOLATION = "23503";

export async function deletePlan(_prev: unknown, formData: FormData): Promise<ProductFormState> {
  const fail = (error: string) => ({ error, values: rawValues(formData, DELETE_FIELDS) });
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("missing-id");
  /* Typed confirmation, checked server-side rather than only in the dialog:
     this endpoint is a POST anyone can send, and the check is worth as much
     as where it runs. */
  if (String(formData.get("confirm") ?? "").trim() !== id) return fail("confirm");

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id);
  if (countError) {
    console.error("[admin products] failed to count subscriptions before delete", countError);
    return fail("save");
  }
  if ((count ?? 0) > 0) return { ...fail("in-use"), count: count ?? 0 };

  /* `.select("id")` for the same reason updatePlan uses it: a DELETE refused
     by `plans_admin_write`'s `using` clause matches zero rows and raises
     nothing, so an empty result is the only way to tell a refusal from a
     success. Distinct from the insert case, which raises 42501 — see
     RLS_REFUSED's comment above. */
  const { data, error } = await supabase.from("plans").delete().eq("id", id).select("id");

  if (error?.code === FK_VIOLATION) return fail("in-use");
  if (error) {
    console.error("[admin products] failed to delete plan", error);
    return fail("save");
  }
  if (!data || data.length === 0) return fail("forbidden");

  revalidatePlans();
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function deleteAddon(_prev: unknown, formData: FormData): Promise<ProductFormState> {
  const fail = (error: string) => ({ error, values: rawValues(formData, DELETE_FIELDS) });
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("missing-id");
  if (String(formData.get("confirm") ?? "").trim() !== id) return fail("confirm");

  const supabase = await createClient();

  /* `addon_id`, not `id`: subscription_addons is a join table whose primary
     key is (subscription_id, addon_id) and it has no `id` column at all
     (0002_commerce.sql), so selecting one would fail the request rather than
     count anything. */
  const { count, error: countError } = await supabase
    .from("subscription_addons")
    .select("addon_id", { count: "exact", head: true })
    .eq("addon_id", id);
  if (countError) {
    console.error("[admin products] failed to count subscription add-ons before delete", countError);
    return fail("save");
  }
  if ((count ?? 0) > 0) return { ...fail("in-use"), count: count ?? 0 };

  const { data, error } = await supabase.from("addons").delete().eq("id", id).select("id");

  if (error?.code === FK_VIOLATION) return fail("in-use");
  if (error) {
    console.error("[admin products] failed to delete add-on", error);
    return fail("save");
  }
  if (!data || data.length === 0) return fail("forbidden");

  revalidatePath("/admin/products");
  return { ok: true };
}
