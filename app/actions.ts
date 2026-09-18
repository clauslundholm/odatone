"use server";

import { EMAIL_RE, type ActionResult, type FieldErrors } from "@/lib/forms";
import { buildSignup } from "@/lib/signup";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const built = buildSignup(formData);
  if (!built.ok) return { ok: false, errors: built.errors };

  /* The service role is required here and only here: an anonymous visitor
     creating a customer has no session for row-level security to authorise
     against. Everything it writes was validated above by buildSignup —
     nothing from the form reaches a price column, because nothing here
     ever writes one: `subscriptions` stores a `plan_id`, never a price, so
     what a plan costs is always read fresh from `plans` (see
     lib/plans-server.ts), including for a plan whose price staff changed
     after this signup happened. */
  const admin = createAdminClient();

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      name: built.value.customer.name,
      billing_email: built.value.customer.email,
      status: "pending",
    })
    .select("id")
    .single();
  if (customerError || !customer) {
    console.error("[odatone] signup: failed to create customer", customerError);
    return { ok: false, errors: { email: "server" } };
  }

  const { error: locationsError } = await admin.from("locations").insert(
    built.value.locations.map((l) => ({ customer_id: customer.id, ...l })),
  );
  if (locationsError) {
    console.error("[odatone] signup: failed to create locations", locationsError, {
      customer: customer.id,
    });
    return { ok: false, errors: { email: "server" } };
  }

  const { error: subscriptionError } = await admin.from("subscriptions").insert({
    customer_id: customer.id,
    plan_id: built.value.planId,
    billing: built.value.billing,
    status: "pending",
  });
  if (subscriptionError) {
    console.error("[odatone] signup: failed to create subscription", subscriptionError, {
      customer: customer.id,
    });
    return { ok: false, errors: { email: "server" } };
  }

  /* An invite rather than a password: no password for this account ever
     passes through Odatone's servers. Task 7's gate denies anyone whose
     session has no matching `profiles` row, from both portals (see
     lib/supabase/proxy.ts) — so the profile must exist before the invited
     person can land anywhere, and it is created immediately after the
     invite succeeds, in the same request, rather than deferred.

     If the invite call itself fails, no auth user was ever created, so
     there is nothing to roll back — the customer, its locations and its
     pending subscription are left exactly as a legitimate lead, and the
     signup still reports success so the visitor isn't told their own valid
     submission failed. There is, as of this task, no button in /admin that
     re-sends an invite; recovering one today means calling
     `admin.auth.admin.inviteUserByEmail` again by hand (Supabase Studio's
     SQL editor can drive it via the auth admin API, or a one-off script).
     That gap is real and is called out in task-13-report.md rather than
     implied away. */
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    built.value.customer.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/my-odatone/login` },
  );

  if (inviteError || !invited?.user) {
    console.error("[odatone] signup: invite failed — customer created without a portal user", {
      customer: customer.id,
      email: built.value.customer.email,
      error: inviteError,
    });
    return { ok: true };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    customer_id: customer.id,
    role: "owner",
    full_name: built.value.customer.contactName,
  });

  if (profileError) {
    /* The dangerous state: an auth user now exists who can complete the
       invite and authenticate, but with no `profiles` row — Task 7's gate
       (lib/supabase/proxy.ts) 404s that session out of both portals with no
       explanation on screen, and no way for the person to tell it apart
       from a broken link. That is worse than the invite having failed
       outright, so the just-created auth user is deleted, putting this
       back into the same, already-handled "customer created, no portal
       user yet" state as an invite failure above. */
    console.error("[odatone] signup: profile insert failed after invite — rolling back the invite", {
      customer: customer.id,
      user: invited.user.id,
      error: profileError,
    });
    const { error: cleanupError } = await admin.auth.admin.deleteUser(invited.user.id);
    if (cleanupError) {
      console.error("[odatone] signup: failed to roll back the orphaned invite", {
        customer: customer.id,
        user: invited.user.id,
        error: cleanupError,
      });
    }
    return { ok: true };
  }

  return { ok: true };
}
