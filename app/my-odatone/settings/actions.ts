"use server";

import { revalidatePath } from "next/cache";

import { EMAIL_RE, type ActionResult, type FieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/* Every text field on this form (billing email included) is bounded here,
   rejected outright rather than truncated — the same "wrong record, not a
   safe one" doctrine lib/signup.ts's fix round 2 applies to the identical
   set of optional business fields on signup: a CVR number or invoicing
   address cut off mid-way is not a safe fallback for a real one. */
const MAX_TEXT_LEN = 200;

/* Danish CVR numbers are exactly 8 digits. Unlike lib/signup.ts (which only
   bounds these fields' length and leaves the CVR's own shape unchecked),
   this task's brief is explicit: exactly 8 digits, or blank — a 7-digit or
   punctuated CVR is rejected, not silently accepted or reformatted. */
const CVR_RE = /^\d{8}$/;

type Field<T> = { value: T } | { error: string };

function parseBillingEmail(raw: string): Field<string> {
  const trimmed = raw.trim();
  if (trimmed.length > MAX_TEXT_LEN) return { error: "long" };
  if (!EMAIL_RE.test(trimmed)) return { error: "email" };
  return { value: trimmed };
}

function parseCvr(raw: string): Field<string | null> {
  const trimmed = raw.trim();
  if (trimmed.length > MAX_TEXT_LEN) return { error: "long" };
  if (trimmed === "") return { value: null };
  if (!CVR_RE.test(trimmed)) return { error: "cvr" };
  return { value: trimmed };
}

/** address/postcode/city/phone: no shape beyond the length bound — unlike
    cvr and billing email, nothing downstream parses these as anything but
    free text. Blank is a legitimate "not given" (`null`, matching the
    nullable columns these write to, supabase/migrations/0001_core.sql /
    0005_customer_phone.sql), never a truncated leftover. */
function parseOptionalText(raw: string): Field<string | null> {
  const trimmed = raw.trim();
  if (trimmed.length > MAX_TEXT_LEN) return { error: "long" };
  return { value: trimmed === "" ? null : trimmed };
}

/**
 * Writes the caller's own billing details — everything on
 * app/my-odatone/settings/page.tsx's form except the company name, which
 * is not writable here at all (it is what already-issued invoices say;
 * changing it is a conversation with Odatone, not a form field).
 *
 * No customer id is read from `formData`, and none is passed to Supabase —
 * not even a bare `.update(...)` with no `.eq()` at all. The row this
 * reaches is found entirely by `auth_customer_id()`, through the
 * `customers_owner_update` policy (supabase/migrations/0003_tenancy.sql),
 * which restricts the write to a profile with role = 'owner'. That is the
 * only authorisation this action has or needs: there is no customer id
 * anywhere in this function for a crafted request to substitute another
 * customer's row for the caller's own.
 *
 * A `manager` submitting this form — the disabled state on the page is
 * courtesy, not enforcement, see page.tsx's own comment — is exactly the
 * case `updatePlan` (app/admin/products/actions.ts) already documents at
 * length for `plans_admin_write`: RLS does not raise when a policy's
 * `using` clause excludes every row from an UPDATE's affected set, it just
 * matches zero rows, and `error` comes back null. `.select("id")` on the
 * update is what tells that refusal apart from a real success; an empty
 * `data` array is exactly that refusal, reported here as `{ form:
 * "forbidden" }` rather than a silent, false "saved".
 */
export async function updateBillingDetails(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const emailField = parseBillingEmail(String(formData.get("billingEmail") ?? ""));
  const cvrField = parseCvr(String(formData.get("cvr") ?? ""));
  const addressField = parseOptionalText(String(formData.get("address") ?? ""));
  const postcodeField = parseOptionalText(String(formData.get("postcode") ?? ""));
  const cityField = parseOptionalText(String(formData.get("city") ?? ""));
  const phoneField = parseOptionalText(String(formData.get("phone") ?? ""));

  const errors: FieldErrors = {};
  if ("error" in emailField) errors.billingEmail = emailField.error;
  if ("error" in cvrField) errors.cvr = cvrField.error;
  if ("error" in addressField) errors.address = addressField.error;
  if ("error" in postcodeField) errors.postcode = postcodeField.error;
  if ("error" in cityField) errors.city = cityField.error;
  if ("error" in phoneField) errors.phone = phoneField.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .update({
      billing_email: "value" in emailField ? emailField.value : "",
      cvr: "value" in cvrField ? cvrField.value : null,
      address: "value" in addressField ? addressField.value : null,
      postcode: "value" in postcodeField ? postcodeField.value : null,
      city: "value" in cityField ? cityField.value : null,
      phone: "value" in phoneField ? phoneField.value : null,
      updated_at: new Date().toISOString(),
    })
    /* PostgREST refuses an UPDATE with no filter at all, unconditionally,
       before RLS or anything else on the database gets a say — confirmed
       live: this exact call with no `.not()` below came back
       `{ code: "21000", message: "UPDATE requires a WHERE clause" }`, not
       the empty-`data` RLS refusal this action is built to interpret.
       `id is not null` is true of every real row and identifies no
       customer at all — it satisfies PostgREST's own requirement without
       this action supplying any id of its own. `customers_owner_update`
       is still the only thing that decides which row(s), if any, this
       actually reaches. */
    .not("id", "is", null)
    .select("id");

  if (error) {
    console.error("[my-odatone settings] failed to save billing details", error);
    return { ok: false, errors: { form: "save" } };
  }
  if (!data || data.length === 0) return { ok: false, errors: { form: "forbidden" } };

  revalidatePath("/my-odatone/settings");
  return { ok: true };
}
