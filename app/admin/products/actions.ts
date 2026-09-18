"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePlans } from "@/lib/plans-server";
import { toOre } from "@/lib/money";
import { parseFeatures, parseMaxM2, parsePriceKr } from "./validate";

export async function updatePlan(_prev: unknown, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const taglineDa = String(formData.get("taglineDa") ?? "").trim();
  const taglineEn = String(formData.get("taglineEn") ?? "").trim();
  const featuresDa = String(formData.get("featuresDa") ?? "");
  const featuresEn = String(formData.get("featuresEn") ?? "");
  const active = formData.get("active") === "on";

  if (!id) return { error: "missing-id" };
  const monthly = parsePriceKr(String(formData.get("monthly") ?? ""));
  if (monthly === null) return { error: "price" };
  const maxM2 = parseMaxM2(String(formData.get("maxM2") ?? ""));
  if (maxM2 === null) return { error: "maxM2" };
  if (!name) return { error: "name" };
  /* A blank tagline in one language isn't a placeholder a visitor never
     sees — PricingTable/Calculator/HeroSavings all render `tagline[l]`
     directly, so a blank here is a blank card on the public site in that
     language, with no error anywhere to explain why. */
  if (!taglineDa || !taglineEn) return { error: "tagline" };

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
    .update({
      name,
      monthly_ore: toOre(monthly),
      max_m2: maxM2.value,
      tagline: { da: taglineDa, en: taglineEn },
      features: parseFeatures(featuresDa, featuresEn),
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: "save" };
  if (!data || data.length === 0) return { error: "forbidden" };

  revalidatePlans();
  return { ok: true } as const;
}

/** The add-on (currently just "streaming") lives in its own table with its
    own RLS policy (`addons_admin_write`, also staff_admin-only — see
    supabase/migrations/0003_tenancy.sql), so it gets its own action rather
    than being folded into updatePlan's. Nothing on the marketing site reads
    `addons` from the database yet (Task 6 wired the `plans` table only,
    lib/rates.ts's STREAMING_MONTHLY_DEFAULT is still compiled-in), so unlike
    a plan price this has no revalidatePlans()-equivalent to call and no
    live surface to verify against today — see task-12-report.md. It is,
    however, audited exactly like a plan change (0004_audit_triggers.sql's
    `addons_audit` trigger, added in this task's fix round after a review
    found a `staff_admin` could reprice the add-on with no audit trail at
    all while the equivalent plan edit was recorded). */
export async function updateAddon(_prev: unknown, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "on";

  if (!id) return { error: "missing-id" };
  const monthly = parsePriceKr(String(formData.get("monthly") ?? ""));
  if (monthly === null) return { error: "price" };

  const supabase = await createClient();
  /* See updatePlan's comment on `.select("id")` — same reasoning, same
     RLS-refusal shape, same `addons_admin_write` policy. */
  const { data, error } = await supabase
    .from("addons")
    .update({ monthly_ore: toOre(monthly), active })
    .eq("id", id)
    .select("id");

  if (error) return { error: "save" };
  if (!data || data.length === 0) return { error: "forbidden" };

  return { ok: true } as const;
}
