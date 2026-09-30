"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/forms";
import { buildInvoiceLines } from "@/lib/invoicing";
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
  if (!customerId || !periodStart || !periodEnd) return { ok: false, errors: { form: "invalid" } };

  /* formData.get returns null only when the key is entirely absent — an
     empty string (a cleared input, or a crafted POST) comes back as "",
     which is neither null nor NaN, so the old `Number(raw ?? default)`
     let Number("") === 0 sail straight through the range check below as a
     silent "due today". A raw value that isn't a non-empty numeric string
     is rejected outright here, before it ever reaches Number.isInteger. */
  const dueDaysRaw = formData.get("dueDays");
  const dueDays = typeof dueDaysRaw === "string" && dueDaysRaw.trim() !== "" ? Number(dueDaysRaw) : NaN;
  if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) {
    return { ok: false, errors: { dueDays: "invalid" } };
  }

  /* The location count the dialog actually priced its preview from, captured
     when the page rendered and submitted back here so it can be compared
     against the count this action re-reads below. The spec's rule is "what is
     shown is what is issued", and without this the two can differ: a
     colleague adding a third location while the dialog sits open produces a
     preview of 2 x unit and an immutable invoice of 3 x. issue_invoice only
     checks `count > 0`, so nothing downstream would notice. Parsed the same
     defensive way as dueDays above — "" is not null, and Number("") is 0. */
  const previewedRaw = formData.get("locationCount");
  const previewedLocations =
    typeof previewedRaw === "string" && previewedRaw.trim() !== "" ? Number(previewedRaw) : NaN;
  if (!Number.isInteger(previewedLocations) || previewedLocations < 1) {
    return { ok: false, errors: { form: "invalid" } };
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
  /* Refused rather than silently repriced. An invoice cannot be amended once
     issued, so the staff member must reopen the dialog and see the real
     figure — not discover it afterwards on a document they can only void. */
  if (locations !== previewedLocations) {
    return { ok: false, errors: { form: "locations-changed" } };
  }

  const plan = resolvePlan(sub.plan_id, planMap((planRows ?? []) as PlanRow[]), "issue invoice");
  /* The one place an unresolvable plan must stop the request rather than be
     worked around. Everywhere else a missing plan degrades a number on a
     screen that can be reloaded once the cause is fixed; here it would be
     printed onto an invoice that is immutable the moment it is issued
     (0010_invoice_lines.sql's allowlist trigger) and gapless in its
     numbering, so the only remedy would be a void and a credit note. */
  if (!plan) return { ok: false, errors: { form: "unknown-plan" } };

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

  /* issue_invoice computed issued_at/due_at itself, inside its own
     transaction, from Postgres's now()/make_interval — not from this
     process's clock. Re-deriving them here with `new Date()` and
     `dueDays * 86_400_000` read a second clock for the same two dates: a
     network round-trip near a UTC midnight can already put JS's "today" a
     calendar day away from what Postgres already committed, and
     make_interval(days => n) itself diverges from n * 86_400_000ms across
     a DST change. Reading the row back and formatting *those* values is
     the only way the PDF's Fakturadato/Betalingsfrist can be guaranteed to
     agree with what the admin table renders for the same row.

     The three totals are read back for exactly the same reason, taken one
     step further. The 25% VAT rate exists independently in three places:
     VAT_PCT (lib/pricing.ts), the literal 0.25 inside issue_invoice
     (0012_issue_invoice.sql), and the literal "Moms 25%" in
     lib/invoice-pdf.tsx. Rendering the PDF from lineTotals(lines) would
     archive a *recomputed* subtotal/VAT/total instead of the ones the
     immutable ledger row actually carries — so the moment those three
     definitions diverge, the archived legal document would state a different
     VAT and total than the row both billing pages display, silently, with
     nothing failing. One row, one truth: what the PDF says is what the
     database stored. (lineTotals keeps its job — pricing the dialog's
     preview, client-side, before any row exists.) */
  const { data: issuedRow, error: issuedRowError } = await admin
    .from("invoices")
    .select("issued_at, due_at, subtotal_ore, vat_ore, total_ore")
    .eq("id", invoiceId)
    .maybeSingle();

  if (
    issuedRowError ||
    !issuedRow?.issued_at ||
    !issuedRow?.due_at ||
    typeof issuedRow.subtotal_ore !== "number" ||
    typeof issuedRow.vat_ore !== "number" ||
    typeof issuedRow.total_ore !== "number"
  ) {
    console.error("[odatone] issue invoice: could not read the issued row back for the pdf", {
      invoiceId,
      error: issuedRowError,
    });
    revalidatePath(`/admin/customers/${customerId}`);
    revalidatePath("/admin/billing");
    return { ok: true, message: "no-pdf" };
  }

  const issuedAt = issuedRow.issued_at.slice(0, 10);
  const dueAt = issuedRow.due_at.slice(0, 10);

  /* Deliberately not awaited inside a try that could roll anything back: the
     invoice exists and is numbered whatever happens here. */
  const path = await storeInvoicePdf(invoiceId, customerId, {
    number, issuedAt, dueAt, periodStart, periodEnd,
    customer: {
      name: customer.name, cvr: customer.cvr, address: customer.address,
      postcode: customer.postcode, city: customer.city, country: customer.country,
    },
    lines,
    subtotalOre: issuedRow.subtotal_ore,
    vatOre: issuedRow.vat_ore,
    totalOre: issuedRow.total_ore,
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/billing");
  return path ? { ok: true } : { ok: true, message: "no-pdf" };
}

const PAYMENT_METHODS = ["bank_transfer", "card", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Marks one invoice paid, and voids one — the two ordinary status
 * transitions staff make after an invoice has been issued.
 *
 * Unlike `issueInvoice` above, neither of these goes near the service-role
 * client. Minting a number needed `issue_invoice`'s SECURITY DEFINER
 * because `invoice_counters` has no RLS policy any session role can satisfy;
 * these two are plain updates to `invoices` itself, and `invoices_staff_write`
 * (0003_tenancy.sql) already permits any staff role to make them. Reaching
 * for the admin client here would bypass a policy that works, for no reason
 * — so both write through the session client, and RLS does the authorising.
 *
 * That has a consequence to handle rather than a shortcut to take: when RLS
 * refuses an update, Postgres does not raise — it matches zero rows. Same
 * shape as `updatePlan` (app/admin/products/actions.ts) refusing a
 * `plans_admin_write` violation: `.select("id")` on the update is not for
 * reading data back, it is how a *refused* write is told apart from a
 * *successful* one, since an empty `data` array is otherwise indistinguishable
 * from a real success.
 *
 * A second, unrelated race is handled the same way: the invoice's current
 * status is read first (through the session client, same as the RLS/role
 * check) purely to produce a specific, readable refusal — "already paid",
 * "void, needs a credit note" — for staff. That read is not itself the
 * guard: two staff clicking at once could both pass it before either writes.
 * The actual guard is `.eq("status", invoice.status)` on the update itself,
 * so only the request that still matches the status this action just read
 * can succeed; a concurrent change in between makes the update match zero
 * rows and lose cleanly, reported the same way an RLS refusal is.
 */
export async function markInvoicePaid(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const callerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : undefined;
  if (!callerId) return { ok: false, errors: { form: "forbidden" } };

  const { data: caller } = await supabase
    .from("profiles").select("role").eq("id", callerId).maybeSingle();
  if (caller?.role !== "staff_admin" && caller?.role !== "staff_support") {
    return { ok: false, errors: { form: "forbidden" } };
  }

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { ok: false, errors: { form: "invalid" } };

  const paymentMethodRaw = String(formData.get("paymentMethod") ?? "");
  if (!PAYMENT_METHODS.includes(paymentMethodRaw as PaymentMethod)) {
    return { ok: false, errors: { paymentMethod: "invalid" } };
  }
  const paymentMethod = paymentMethodRaw as PaymentMethod;
  const paymentReference = String(formData.get("paymentReference") ?? "").trim();

  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select("id, customer_id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (readError || !invoice) return { ok: false, errors: { form: "invalid" } };
  if (invoice.status === "paid") return { ok: false, errors: { form: "already-paid" } };
  if (invoice.status === "void") return { ok: false, errors: { form: "void" } };

  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_reference: paymentReference === "" ? null : paymentReference,
    })
    .eq("id", invoiceId)
    .eq("status", invoice.status)
    .select("id");

  if (error) {
    console.error("[odatone] mark invoice paid: update failed", { invoiceId, error });
    return { ok: false, errors: { form: "service" } };
  }
  if (!data || data.length === 0) return { ok: false, errors: { form: "conflict" } };

  revalidatePath(`/admin/customers/${invoice.customer_id}`);
  revalidatePath("/admin/billing");
  return { ok: true };
}

/** See `markInvoicePaid`'s doc comment just above for the shared shape:
    session client, RLS-refusal detected via `.select("id")` coming back
    empty, and a read-then-conditional-write against the invoice's own
    current status to close the gap between reading it and writing it. */
export async function voidInvoice(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const callerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : undefined;
  if (!callerId) return { ok: false, errors: { form: "forbidden" } };

  const { data: caller } = await supabase
    .from("profiles").select("role").eq("id", callerId).maybeSingle();
  if (caller?.role !== "staff_admin" && caller?.role !== "staff_support") {
    return { ok: false, errors: { form: "forbidden" } };
  }

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { ok: false, errors: { form: "invalid" } };

  /* Refused here, before invoices_void_reason_ck (0010_invoice_lines.sql)
     ever has to: that constraint only requires void_reason is not null, so
     "   " would sail through it and leave a voided invoice with a reason
     no human ever wrote. */
  const voidReason = String(formData.get("voidReason") ?? "").trim();
  if (!voidReason) return { ok: false, errors: { voidReason: "required" } };

  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select("id, customer_id, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (readError || !invoice) return { ok: false, errors: { form: "invalid" } };
  if (invoice.status === "void") return { ok: false, errors: { form: "already-void" } };
  /* Reversing a paid invoice needs a credit note — explicitly out of scope
     for this slice, so voiding a paid invoice is refused rather than quietly
     wiping out a payment that was actually received. */
  if (invoice.status === "paid") return { ok: false, errors: { form: "paid" } };

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void", void_reason: voidReason })
    .eq("id", invoiceId)
    .eq("status", invoice.status)
    .select("id");

  if (error) {
    console.error("[odatone] void invoice: update failed", { invoiceId, error });
    return { ok: false, errors: { form: "service" } };
  }
  if (!data || data.length === 0) return { ok: false, errors: { form: "conflict" } };

  revalidatePath(`/admin/customers/${invoice.customer_id}`);
  revalidatePath("/admin/billing");
  return { ok: true };
}
