"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePlans } from "@/lib/plans-server";
import { toOre } from "@/lib/money";

/** Parses one line-per-feature textarea into the `L10n[]` shape `plans.features`
    stores, pairing Danish and English lines by position. A trailing blank line
    from the textarea's own newline is dropped; any other blank line becomes an
    empty string in that slot rather than being silently skipped, so the two
    languages' feature lists cannot drift out of alignment with each other. */
function parseFeatures(da: string, en: string): { da: string; en: string }[] {
  const daLines = da.split("\n").map((s) => s.trim());
  const enLines = en.split("\n").map((s) => s.trim());
  while (daLines.length && daLines[daLines.length - 1] === "") daLines.pop();
  while (enLines.length && enLines[enLines.length - 1] === "") enLines.pop();
  const count = Math.max(daLines.length, enLines.length);
  const out: { da: string; en: string }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ da: daLines[i] ?? "", en: enLines[i] ?? "" });
  }
  return out;
}

export async function updatePlan(_prev: unknown, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const monthly = Number(formData.get("monthly"));
  const maxM2raw = String(formData.get("maxM2") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const taglineDa = String(formData.get("taglineDa") ?? "").trim();
  const taglineEn = String(formData.get("taglineEn") ?? "").trim();
  const featuresDa = String(formData.get("featuresDa") ?? "");
  const featuresEn = String(formData.get("featuresEn") ?? "");
  const active = formData.get("active") === "on";

  if (!id) return { error: "missing-id" };
  if (!Number.isFinite(monthly) || monthly < 0) return { error: "price" };
  if (!name) return { error: "name" };

  const supabase = await createClient();
  /* No service role here: the staff_admin policy from Task 4 is what authorises
     this, so a staff_support account is refused by the database rather than by
     a check in this file that someone could forget to write. */
  const { error } = await supabase
    .from("plans")
    .update({
      name,
      monthly_ore: toOre(monthly),
      max_m2: maxM2raw === "" ? null : Number(maxM2raw),
      tagline: { da: taglineDa, en: taglineEn },
      features: parseFeatures(featuresDa, featuresEn),
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "save" };

  revalidatePlans();
  return {};
}

/** The add-on (currently just "streaming") lives in its own table with its
    own RLS policy (`addons_admin_write`, also staff_admin-only — see
    supabase/migrations/0003_tenancy.sql), so it gets its own action rather
    than being folded into updatePlan's. Nothing on the marketing site reads
    `addons` from the database yet (Task 6 wired the `plans` table only,
    lib/rates.ts's STREAMING_MONTHLY_DEFAULT is still compiled-in), so unlike
    a plan price this has no revalidatePlans()-equivalent to call and no
    live surface to verify against today — see task-12-report.md. */
export async function updateAddon(_prev: unknown, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const monthly = Number(formData.get("monthly"));
  const active = formData.get("active") === "on";

  if (!id) return { error: "missing-id" };
  if (!Number.isFinite(monthly) || monthly < 0) return { error: "price" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("addons")
    .update({ monthly_ore: toOre(monthly), active })
    .eq("id", id);

  if (error) return { error: "save" };
  return {};
}
