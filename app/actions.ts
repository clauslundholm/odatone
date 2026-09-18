"use server";

import { EMAIL_RE, type ActionResult, type FieldErrors } from "@/lib/forms";
import { buildSignup, decideSignupDedupe, inviteCreatedNewUser } from "@/lib/signup";
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

/** GoTrue's error shape for an already-registered, *confirmed* address
    (verified live against the local stack: HTTP 422, `code: "email_exists"`).
    Distinct from the unconfirmed-existing-user case below — that one
    doesn't error at all, it silently re-invites, which is the shape the
    Critical in this fix round exploited. */
function isAlreadyRegisteredError(error: unknown): boolean {
  const e = error as { code?: string; status?: number } | null | undefined;
  return e?.code === "email_exists" || e?.status === 422;
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
     after this signup happened.

     lib/supabase/env.ts documents a missing service key as a *normal*
     state (local dev before the integration is configured, or a deploy
     made before it), so createAdminClient() throwing synchronously here
     must not become an unhandled rejection — before this fix round it did,
     which left SignupFlow.tsx's "Opretter…" button spinning forever with
     no error and no way out for the visitor. */
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("[odatone] signup: service role is not configured", err);
    return { ok: false, errors: { form: "server" } };
  }

  /* Duplicate-signup safety (fix round 1's Critical). `customers.billing_email`
     has no unique constraint, and GoTrue's inviteUserByEmail does not fail
     for an existing *unconfirmed* user — it silently re-invites and returns
     that same user. The original code treated whatever inviteUserByEmail
     returned as "the user this request just created": a second signup for
     an email that hadn't yet accepted its first invite hit a `profiles`
     primary-key conflict against the FIRST attempt's real profile, and the
     "rollback" then deleted that auth user — cascading away the first
     customer's actual, working account. Reproduced live twice by the
     coordinator; exploitable by anyone who merely knows a customer's
     billing email, unauthenticated.

     The fix looks up what already exists for this email *before* creating
     anything or calling invite at all, and decideSignupDedupe (lib/signup.ts,
     unit tested) turns that into one of three outcomes. */
  const { data: existingCustomersRaw, error: existingCustomersError } = await admin
    .from("customers")
    .select("id, created_at")
    .eq("billing_email", built.value.customer.email);
  if (existingCustomersError) {
    console.error("[odatone] signup: failed to check for an existing customer", existingCustomersError);
    return { ok: false, errors: { form: "server" } };
  }
  const existingCustomers = existingCustomersRaw ?? [];

  let existingProfiles: { customer_id: string | null }[] = [];
  if (existingCustomers.length > 0) {
    const { data: existingProfilesRaw, error: existingProfilesError } = await admin
      .from("profiles")
      .select("customer_id")
      .in(
        "customer_id",
        existingCustomers.map((c) => c.id),
      );
    if (existingProfilesError) {
      console.error("[odatone] signup: failed to check for an existing profile", existingProfilesError);
      return { ok: false, errors: { form: "server" } };
    }
    existingProfiles = existingProfilesRaw ?? [];
  }

  const dedupe = decideSignupDedupe(existingCustomers, existingProfiles);

  if (dedupe.action === "already-registered") {
    /* An owner already exists for this email. Never invite, never create a
       second customer — the visitor already has an account. */
    return { ok: false, errors: { email: "exists" } };
  }

  let customerId: string;
  /* Only a customer this exact request created may ever be compensating-
     deleted below — a reused, pre-existing customer (dedupe.action ===
     "reuse") is never touched by this request's own failure handling. */
  let createdCustomerThisRequest = false;

  if (dedupe.action === "reuse") {
    customerId = dedupe.customerId;
  } else {
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .insert({
        name: built.value.customer.name,
        billing_email: built.value.customer.email,
        cvr: built.value.customer.cvr,
        address: built.value.customer.address,
        postcode: built.value.customer.postcode,
        city: built.value.customer.city,
        phone: built.value.customer.phone,
        status: "pending",
      })
      .select("id")
      .single();
    if (customerError || !customer) {
      console.error("[odatone] signup: failed to create customer", customerError);
      return { ok: false, errors: { form: "server" } };
    }
    customerId = customer.id;
    createdCustomerThisRequest = true;

    /* Not wrapped in a database transaction (the brief's own shape was
       three sequential inserts; this fix round did not introduce an RPC
       function). Instead: any failure past this point deletes the customer
       row this request just created, and `on delete cascade`
       (0002_commerce.sql) takes its locations and subscription with it —
       so a failed signup never leaves a half-created customer sitting in
       /admin/customers indistinguishable from a real pending one. */
    const { error: locationsError } = await admin.from("locations").insert(
      built.value.locations.map((l) => ({ customer_id: customerId, ...l })),
    );
    if (locationsError) {
      console.error("[odatone] signup: failed to create locations — removing the customer", locationsError, {
        customer: customerId,
      });
      await admin.from("customers").delete().eq("id", customerId);
      return { ok: false, errors: { form: "server" } };
    }

    const { error: subscriptionError } = await admin.from("subscriptions").insert({
      customer_id: customerId,
      plan_id: built.value.planId,
      billing: built.value.billing,
      status: "pending",
    });
    if (subscriptionError) {
      console.error("[odatone] signup: failed to create subscription — removing the customer", subscriptionError, {
        customer: customerId,
      });
      await admin.from("customers").delete().eq("id", customerId);
      return { ok: false, errors: { form: "server" } };
    }
  }

  /* An invite rather than a password: no password for this account ever
     passes through Odatone's servers. Task 7's gate denies anyone whose
     session has no matching `profiles` row, from both portals (see
     lib/supabase/proxy.ts) — so the profile must exist before the invited
     person can land anywhere, and it is created immediately after the
     invite succeeds, in the same request, rather than deferred.

     `inviteStartedAt` is captured immediately before the call so
     inviteCreatedNewUser (lib/signup.ts) can later tell, deterministically,
     whether the auth user this call returns is one this request just made
     or one that already existed — the fact the Critical above turned on. */
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    /* Documented in .env.example and the README's "Admin"/"The signup flow"
       sections, not just enforced here — a missing value degrades instead
       of failing outright (a relative redirect still resolves against
       whatever host serves the email client's request), so this is a
       warning an operator can act on, not a thrown error that would take
       the whole signup down for a cosmetic link problem. */
    console.warn(
      "[odatone] signup: NEXT_PUBLIC_SITE_URL is not set — the invite email's link will be a relative path, not an absolute URL",
    );
  }
  const inviteStartedAt = Date.now();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    built.value.customer.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/my-odatone/login` },
  );

  if (inviteError || !invited?.user) {
    if (isAlreadyRegisteredError(inviteError)) {
      /* Only reachable if the pre-check above raced or missed (e.g. an auth
         user confirmed out of band with no matching customer/profile row
         yet). This request's own speculative customer is removed — a
         customer that can never get an owner, because that email's owner
         already exists elsewhere, is not a lead worth keeping. A reused
         customer is left exactly as it was. */
      if (createdCustomerThisRequest) await admin.from("customers").delete().eq("id", customerId);
      console.error("[odatone] signup: email already fully registered", {
        customer: customerId,
        email: built.value.customer.email,
      });
      return { ok: false, errors: { email: "exists" } };
    }

    /* Any other invite failure (rate limit, mail transport down, ...): no
       auth user was created, so there is nothing to roll back. The
       customer, its locations and its pending subscription are kept —
       preserving a real lead beats losing it to a flaky mail send — but the
       Done screen must not claim an email was sent when it wasn't (fix
       round 1's finding), so `message: "no-invite"` says so.

       There is, as of this task, no button in /admin that re-sends an
       invite; recovering one today means calling
       `admin.auth.admin.inviteUserByEmail` again by hand. A customer stuck
       in this state is still visible to staff, though: /admin/customers/[id]
       renders "No users yet" for exactly this case (no profiles row), which
       is the flag this fix round was asked for — no schema change needed. */
    console.error("[odatone] signup: invite failed — customer created without a portal user", {
      customer: customerId,
      email: built.value.customer.email,
      error: inviteError,
    });
    return { ok: true, message: "no-invite" };
  }

  /* Just-in-time safety net for the same Critical, independent of the
     upfront dedupe check above: if the invited user already has a profile —
     reachable only via a race the pre-check can't see (two signups for the
     same brand-new email landing concurrently) — that profile belongs to
     someone else's completed signup. Insert would fail on the primary key
     anyway; checking first means the failure is diagnosed correctly instead
     of falling into the generic profileError branch below and being
     mistaken for "this request's own invite, awaiting its profile". */
  const { data: profileForUser, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", invited.user.id)
    .maybeSingle();
  if (profileLookupError) {
    console.error("[odatone] signup: failed to check for an existing profile on the invited user", profileLookupError, {
      customer: customerId,
      user: invited.user.id,
    });
    return { ok: true, message: "no-invite" };
  }
  if (profileForUser) {
    if (createdCustomerThisRequest) await admin.from("customers").delete().eq("id", customerId);
    console.error("[odatone] signup: invite returned a user that already has a profile — not touching it", {
      customer: customerId,
      user: invited.user.id,
    });
    return { ok: false, errors: { email: "exists" } };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    customer_id: customerId,
    role: "owner",
    full_name: built.value.customer.contactName,
  });

  if (profileError) {
    /* The dangerous state Decision 1 (task-13-report.md) exists to close:
       an auth user who can complete the invite and authenticate, but with
       no `profiles` row — Task 7's gate 404s that session out of both
       portals with no explanation on screen. Deleting the auth user is only
       safe when THIS request is the one that created it —
       inviteCreatedNewUser checks that deterministically via `created_at`,
       never by assuming the return value of inviteUserByEmail means "new".
       A pre-existing user (the exact Critical this fix round closes) is
       never deleted, no matter what error inserting its profile produced. */
    if (inviteCreatedNewUser(invited.user.created_at, inviteStartedAt)) {
      console.error("[odatone] signup: profile insert failed after invite — rolling back the new invite", {
        customer: customerId,
        user: invited.user.id,
        error: profileError,
      });
      const { error: cleanupError } = await admin.auth.admin.deleteUser(invited.user.id);
      if (cleanupError) {
        console.error("[odatone] signup: failed to roll back the orphaned invite", {
          customer: customerId,
          user: invited.user.id,
          error: cleanupError,
        });
      }
    } else {
      console.error(
        "[odatone] signup: profile insert failed for a PRE-EXISTING auth user — refusing to delete it",
        { customer: customerId, user: invited.user.id, error: profileError },
      );
    }
    return { ok: true, message: "no-invite" };
  }

  return { ok: true };
}
