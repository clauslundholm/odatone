"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { parseCustomerForm } from "./validate";

/* The fields the form echoes back on a rejected save. React resets an
   uncontrolled form once its Server Action resolves, so without this the
   operator loses eight fields because one of them was wrong — the same
   problem, and the same fix, as app/admin/products/actions.ts. Listed by
   name rather than returning the whole FormData, so a crafted POST cannot
   put arbitrary extra values back into the rendered page. */
const FIELDS = [
  "name", "cvr", "billing_email", "phone", "address", "postcode", "city", "country", "status",
] as const;

export type CustomerFormState = {
  ok?: boolean;
  /** A field name from the parser, or "conflict" / "denied" / "save". */
  error?: string;
  values?: Record<string, string>;
};

function echo(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FIELDS) out[key] = String(formData.get(key) ?? "");
  return out;
}

/**
 * Edit a customer's own details.
 *
 * Authorisation is `customers_staff_update` (0003_tenancy.sql) and
 * nothing else — the ordinary session client is used precisely so that
 * policy applies, the same way every other customer-facing write in this
 * app leans on RLS rather than on a check in TypeScript. Any staff role
 * may do this; it is not narrowed to staff_admin the way erasure is,
 * because correcting a misspelled street belongs to whoever is holding
 * the support inbox.
 *
 * `.select("id")` is what makes a refusal visible. PostgREST answers an
 * UPDATE that no policy admits with success and zero rows, so without
 * asking for the row back, a support user editing something they may not
 * touch would be told it saved.
 */
export async function updateCustomer(
  _prev: unknown,
  formData: FormData,
): Promise<CustomerFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "save", values: echo(formData) };

  const parsed = parseCustomerForm(echo(formData));
  if (!parsed.ok) return { error: parsed.error, values: echo(formData) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update(parsed.value)
    .eq("id", id)
    .select("id");

  if (error) {
    /* 23505 is the unique violation on `lower(billing_email)`. It is the
       one failure here an operator can actually fix, and the generic
       message would send them looking at the wrong field. */
    if (error.code === "23505") return { error: "conflict", values: echo(formData) };
    console.error("[admin] updateCustomer failed", { customerId: id, error });
    return { error: "save", values: echo(formData) };
  }
  if (!data || data.length === 0) {
    /* No error and no row: the policy refused it, or the id is gone. */
    return { error: "denied", values: echo(formData) };
  }

  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
  return { ok: true };
}
