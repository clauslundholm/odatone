// scripts/seed-invoices.mjs
/* Development data only. Every row is written with source = 'seed' so the
   customer detail page can find and label them, and so nobody reads these
   totals as revenue.

   Deviation from the task brief's given script: the brief's own code called
   `quote(sub.plan_id, sub.billing, count ?? 1)` — a bare PlanId. quote()'s
   PlanId branch (lib/pricing.ts) resolves against the compiled PLANS
   constant and never consults the database, which is precisely the defect
   this task's brief calls "the most important thing" and says has already
   shipped twice on this branch. Seeding a customer's invoice history from
   the compiled price rather than whatever is actually in `plans` would
   reintroduce it a third time, quietly, in data instead of in a render.
   This script instead reads every `plans` row once and resolves each
   subscription's plan_id against it (lib/admin/plans.ts — the same helper
   app/admin/page.tsx and the customers pages use), falling back to the
   compiled plan with a logged warning only if a plan_id has no matching
   row. */
import { createClient } from "@supabase/supabase-js";
import { quote } from "../lib/pricing.ts";
import { toOre, invoiceTotals } from "../lib/money.ts";
import { planMap, resolvePlan } from "../lib/admin/plans.ts";
import { resolveSupabaseEnv, resolveServiceKey } from "../lib/supabase/env.ts";

const env = resolveSupabaseEnv();
const serviceKey = resolveServiceKey();
if (!env || !serviceKey) {
  throw new Error("Supabase is not configured (need a URL and a service role key).");
}

const db = createClient(env.url, serviceKey);

const { data: planRows, error: planError } = await db
  .from("plans")
  .select("id, name, monthly_ore, max_m2, tagline, features");
if (planError) throw planError;
const planById = planMap(planRows ?? []);

const { data: subs, error: subsError } = await db
  .from("subscriptions")
  .select("customer_id, plan_id, billing, status")
  .in("status", ["active", "trialing", "past_due"]);
if (subsError) throw subsError;

let seeded = 0;

for (const sub of subs ?? []) {
  const { count } = await db
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", sub.customer_id);

  const plan = resolvePlan(sub.plan_id, planById, "seed-invoices");
  const subtotal = toOre(quote(plan, sub.billing, count ?? 1).monthlyExVat);
  const totals = invoiceTotals(subtotal);

  for (let month = 11; month >= 0; month--) {
    const issued = new Date();
    issued.setMonth(issued.getMonth() - month, 1);
    const { error } = await db.from("invoices").insert({
      customer_id: sub.customer_id,
      number: `SEED-${sub.customer_id.slice(0, 8)}-${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}`,
      issued_at: issued.toISOString(),
      period_start: issued.toISOString().slice(0, 10),
      subtotal_ore: totals.subtotalOre,
      vat_ore: totals.vatOre,
      total_ore: totals.totalOre,
      status: month === 0 ? "open" : "paid",
      source: "seed",
    });
    if (error) throw error;
    seeded += 1;
  }
}

console.log(`Seeded ${seeded} invoice(s) across ${subs?.length ?? 0} subscription(s).`);
