"use server";

import { EMAIL_RE, type ActionResult, type FieldErrors } from "@/lib/forms";

/**
 * Prototype endpoints. They validate on the server and log — nothing is
 * mailed or persisted yet. Wire these to your CRM / mail provider and the
 * UI needs no changes: both return the same ActionResult shape.
 */

export async function submitSalesLead(formData: FormData): Promise<ActionResult> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: FieldErrors = {};

  if (!get("name")) errors.name = "required";
  if (!get("company")) errors.company = "required";
  if (!EMAIL_RE.test(get("email"))) errors.email = "email";

  if (Object.keys(errors).length) return { ok: false, errors };

  console.log("[odatone] sales lead", {
    name: get("name"),
    company: get("company"),
    email: get("email"),
    phone: get("phone"),
    locations: get("locations"),
    message: get("message").slice(0, 400),
    at: new Date().toISOString(),
  });

  return { ok: true };
}

export async function submitSignup(formData: FormData): Promise<ActionResult> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: FieldErrors = {};

  if (!get("name")) errors.name = "required";
  if (!get("company")) errors.company = "required";
  if (!EMAIL_RE.test(get("email"))) errors.email = "email";
  if (!get("planId")) errors.planId = "required";

  if (Object.keys(errors).length) return { ok: false, errors };

  console.log("[odatone] signup", {
    company: get("company"),
    email: get("email"),
    plan: get("planId"),
    billing: get("billing"),
    locations: get("locations"),
    paymentMethod: get("paymentMethod"),
    at: new Date().toISOString(),
  });

  return { ok: true };
}
