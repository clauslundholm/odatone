"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/forms";
import { buildInvoiceLines, lineTotals } from "@/lib/invoicing";
import { ISSUER } from "@/lib/invoice-issuer";
import { storeInvoicePdf } from "@/lib/invoice-pdf-store";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { latestSubscription } from "@/lib/admin/customers";
import type { PlanRow } from "@/lib/plans-row";
import type { Billing } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Issues one invoice for a customer from the admin customer page.
 *
 * Order is the security argument: the caller is authorised against their
 * own session, under RLS, before the service-role client is even
 * constructed below — that client bypasses every RLS policy, so nothing
 * it does is protected by them. Any staff role may issue (`invoices_staff_
 * write`, 0003_tenancy.sql, admits both `staff_admin` and `staff_support`
 * — support chasing a payment is the normal case, not an oversight); the
 * check below exists only because `issue_invoice` itself runs as
 * `service_role` and so bypasses that policy the same way this action's
 * own admin client does.
 */
export async function issueInvoice(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const callerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : undefined;
  if (!callerId) return { ok: false, errors: { form: "forbidden" } };

  const { data: caller } = await supabase
    .from("profiles").select("role").eq("id", callerId).maybeSingle();
  /* Any staff role may issue: support chasing a payment is the normal case.
     invoices_staff_write (0003_tenancy.sql) says the same, and this check is
     here only because the RPC below runs as service_role and bypasses it. */
  if (caller?.role !== "staff_admin" && caller?.role !== "staff_support") {
    return { ok: false, errors: { form: "forbidden" } };
  }

  const customerId = String(formData.get("customerId") ?? "");
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  const dueDays = Number(formData.get("dueDays") ?? ISSUER.paymentTermsDays);
  if (!customerId || !periodStart || !periodEnd) return { ok: false, errors: { form: "invalid" } };
  if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) {
    return { ok: false, errors: { dueDays: "invalid" } };
  }

  const [{ data: customer }, { data: subs }, { data: locs }, { data: planRows }] = await Promise.all([
    supabase.from("customers")
      .select("id, name, cvr, address, postcode, city, country").eq("id", customerId).maybeSingle(),
    supabase.from("subscriptions")
      .select("plan_id, billing, status, created_at").eq("customer_id", customerId),
    supabase.from("locations").select("id").eq("customer_id", customerId),
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  if (!customer) return { ok: false, errors: { form: "invalid" } };
  const sub = latestSubscription((subs ?? []) as { plan_id: string; billing: string; status: string; created_at: string }[]);
  if (!sub) return { ok: false, errors: { form: "no-subscription" } };
  const locations = locs?.length ?? 0;
  if (locations === 0) return { ok: false, errors: { form: "no-locations" } };

  const plan = resolvePlan(sub.plan_id, planMap((planRows ?? []) as PlanRow[]), "issue invoice");

  let lines;
  try {
    lines = buildInvoiceLines({
      plan, billing: sub.billing as Billing, locations, periodStart, periodEnd,
    });
  } catch (error) {
    console.error("[odatone] issue invoice: could not build lines", error);
    return { ok: false, errors: { form: "invalid" } };
  }

  const admin = createAdminClient();
  const { data: issued, error: rpcError } = await admin.rpc("issue_invoice", {
    p_customer_id: customerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_days: dueDays,
    p_issued_by: callerId,
    p_lines: lines,
  });

  if (rpcError || !issued?.[0]) {
    console.error("[odatone] issue invoice: rpc failed", { customerId, error: rpcError });
    /* Switch on SQLSTATE, never on the message text. issue_invoice tags each
       refusal with its own code precisely so this does not have to
       string-match English prose that a later edit would silently break. */
    switch (rpcError?.code) {
      case "P0104": return { ok: false, errors: { form: "duplicate-period" } };
      case "P0102": return { ok: false, errors: { form: "no-subscription" } };
      case "P0103": return { ok: false, errors: { form: "no-locations" } };
      case "P0101": return { ok: false, errors: { form: "invalid" } };
      default:      return { ok: false, errors: { form: "service" } };
    }
  }

  const { invoice_id: invoiceId, invoice_number: number } = issued[0];
  const totals = lineTotals(lines);
  const issuedAt = new Date().toISOString().slice(0, 10);
  const dueAt = new Date(Date.now() + dueDays * 86_400_000).toISOString().slice(0, 10);

  /* Deliberately not awaited inside a try that could roll anything back: the
     invoice exists and is numbered whatever happens here. */
  const path = await storeInvoicePdf(invoiceId, customerId, {
    number, issuedAt, dueAt, periodStart, periodEnd,
    customer: {
      name: customer.name, cvr: customer.cvr, address: customer.address,
      postcode: customer.postcode, city: customer.city, country: customer.country,
    },
    lines, ...totals,
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/billing");
  return path ? { ok: true } : { ok: true, message: "no-pdf" };
}
