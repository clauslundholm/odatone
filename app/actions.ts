"use server";

import { EMAIL_RE, type ActionResult, type FieldErrors } from "@/lib/forms";
import {
  buildSignup,
  decideSignupDedupe,
  inviteCreatedNewUser,
  type ExistingCustomer,
  type ExistingProfile,
  type SignupInput,
} from "@/lib/signup";
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

type AdminClient = ReturnType<typeof createAdminClient>;

/** GoTrue's error shape for an already-registered, *confirmed* address
    (verified live against the local stack: HTTP 422, `code: "email_exists"`).
    Distinct from the unconfirmed-existing-user case below — that one
    doesn't error at all, it silently re-invites, which is the shape the
    Critical in fix round 1 exploited. */
function isAlreadyRegisteredError(error: unknown): boolean {
  const e = error as { code?: string; status?: number } | null | undefined;
  return e?.code === "email_exists" || e?.status === 422;
}

/** Deletes a customer this request is compensating away (a failed write
    past it, or a customer that can never get an owner because its email
    belongs to someone else). Fix round 2's Minor: the delete's own result
    used to be discarded, so a failed cleanup logged "removing the
    customer" while the customer stayed — demonstrated live. `context` goes
    straight into the log line so a failure here is diagnosable without
    guessing which of several call sites it came from. */
async function deleteCustomer(admin: AdminClient, customerId: string, context: string): Promise<void> {
  const { error } = await admin.from("customers").delete().eq("id", customerId);
  if (error) {
    console.error(`[odatone] signup: failed to remove the customer (${context}) — it was NOT removed`, {
      customer: customerId,
      error,
    });
  }
}

type LookupResult =
  | { ok: true; customers: ExistingCustomer[]; profiles: ExistingProfile[] }
  | { ok: false };

/** Everything already on file for a billing email: every `customers` row,
    and every `profiles` row against any of them. decideSignupDedupe
    (lib/signup.ts) turns this into the actual decision; this only reads. */
async function lookupSignup(admin: AdminClient, email: string): Promise<LookupResult> {
  const { data: customersRaw, error: customersError } = await admin
    .from("customers")
    .select("id, created_at")
    .eq("billing_email", email);
  if (customersError) {
    console.error("[odatone] signup: failed to check for an existing customer", customersError);
    return { ok: false };
  }
  const customers = customersRaw ?? [];
  if (customers.length === 0) return { ok: true, customers, profiles: [] };

  const { data: profilesRaw, error: profilesError } = await admin
    .from("profiles")
    .select("customer_id")
    .in(
      "customer_id",
      customers.map((c) => c.id),
    );
  if (profilesError) {
    console.error("[odatone] signup: failed to check for an existing profile", profilesError);
    return { ok: false };
  }
  return { ok: true, customers, profiles: profilesRaw ?? [] };
}

type OrderResult = { ok: true } | { ok: false };

/** Writes `value`'s order onto an *existing* customer — its own contact and
    billing fields, its locations (replaced, not merged) and its
    subscription (replaced, not merged).

    Fix round 2's Important: the `reuse` path used to skip this entirely and
    only insert a `profiles` row, silently discarding the visitor's real
    plan, locations and business details onto whatever a pre-existing,
    unrelated customer row happened to hold — reproduced live (a Main Stage
    / annual / 7-location / 900m² order was bound to an old "Small Venue /
    monthly / 1 location" customer, every new field discarded, and the
    visitor was told their subscription was active). Refusing outright
    would be safer against writing onto someone else's row, but with no
    re-invite affordance anywhere in /admin, refusing would permanently
    strand exactly the people `reuse` exists to help — a repeat visitor
    whose first invite never arrived. The risk is bounded: `reuse` only
    ever targets a customer decideSignupDedupe already confirmed has no
    owner, and the invite that follows only ever goes to the email on that
    customer's own record — never to anyone else's address. */
async function applyOrderToCustomer(
  admin: AdminClient,
  customerId: string,
  value: SignupInput,
  context: string,
): Promise<OrderResult> {
  const { error: updateError } = await admin
    .from("customers")
    .update({
      name: value.customer.name,
      cvr: value.customer.cvr,
      address: value.customer.address,
      postcode: value.customer.postcode,
      city: value.customer.city,
      phone: value.customer.phone,
    })
    .eq("id", customerId);
  if (updateError) {
    console.error(`[odatone] signup: failed to update the reused customer's details (${context})`, {
      customer: customerId,
      error: updateError,
    });
    return { ok: false };
  }

  /* Replaced, not appended: a customer only ever reaches this path with no
     owner yet, so its previous locations/subscription belong to an order
     nobody ever confirmed — the new submission is what the visitor actually
     wants set up. */
  const { error: deleteLocationsError } = await admin.from("locations").delete().eq("customer_id", customerId);
  if (deleteLocationsError) {
    console.error(`[odatone] signup: failed to clear the reused customer's old locations (${context})`, {
      customer: customerId,
      error: deleteLocationsError,
    });
    return { ok: false };
  }
  const { error: locationsError } = await admin.from("locations").insert(
    value.locations.map((l) => ({ customer_id: customerId, ...l })),
  );
  if (locationsError) {
    console.error(`[odatone] signup: failed to write the reused customer's new locations (${context})`, {
      customer: customerId,
      error: locationsError,
    });
    return { ok: false };
  }

  const { error: deleteSubscriptionsError } = await admin.from("subscriptions").delete().eq("customer_id", customerId);
  if (deleteSubscriptionsError) {
    console.error(`[odatone] signup: failed to clear the reused customer's old subscription (${context})`, {
      customer: customerId,
      error: deleteSubscriptionsError,
    });
    return { ok: false };
  }
  const { error: subscriptionError } = await admin.from("subscriptions").insert({
    customer_id: customerId,
    plan_id: value.planId,
    billing: value.billing,
    status: "pending",
  });
  if (subscriptionError) {
    console.error(`[odatone] signup: failed to write the reused customer's new subscription (${context})`, {
      customer: customerId,
      error: subscriptionError,
    });
    return { ok: false };
  }

  return { ok: true };
}

type CreateResult =
  | { status: "created"; customerId: string }
  | { status: "conflict" }
  | { status: "error" };

/** Creates a brand-new customer plus its locations and subscription. Not
    wrapped in a database transaction (no RPC function exists for this yet):
    any failure past the customer insert deletes that customer via
    `deleteCustomer`, and `on delete cascade` (0002_commerce.sql) takes its
    locations and subscription with it, so a failed signup never leaves a
    half-created customer sitting in /admin/customers indistinguishable from
    a real pending one.

    `customers_billing_email_unique_idx` (0006_customer_email_unique.sql,
    fix round 2) means this insert itself can now lose a race to a
    concurrent signup for the same email — reported as `"conflict"` rather
    than a generic error, so the caller can recover via decideSignupDedupe
    instead of showing the visitor a raw database error for something that
    isn't really a failure. */
async function createCustomerWithOrder(admin: AdminClient, value: SignupInput): Promise<CreateResult> {
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      name: value.customer.name,
      billing_email: value.customer.email,
      cvr: value.customer.cvr,
      address: value.customer.address,
      postcode: value.customer.postcode,
      city: value.customer.city,
      phone: value.customer.phone,
      status: "pending",
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    if (customerError?.code === "23505") return { status: "conflict" };
    console.error("[odatone] signup: failed to create customer", customerError);
    return { status: "error" };
  }

  const customerId = customer.id as string;

  const { error: locationsError } = await admin.from("locations").insert(
    value.locations.map((l) => ({ customer_id: customerId, ...l })),
  );
  if (locationsError) {
    console.error("[odatone] signup: failed to create locations — removing the customer", locationsError, {
      customer: customerId,
    });
    await deleteCustomer(admin, customerId, "locations insert failed");
    return { status: "error" };
  }

  const { error: subscriptionError } = await admin.from("subscriptions").insert({
    customer_id: customerId,
    plan_id: value.planId,
    billing: value.billing,
    status: "pending",
  });
  if (subscriptionError) {
    console.error("[odatone] signup: failed to create subscription — removing the customer", subscriptionError, {
      customer: customerId,
    });
    await deleteCustomer(admin, customerId, "subscription insert failed");
    return { status: "error" };
  }

  return { status: "created", customerId };
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
     must not become an unhandled rejection — before fix round 1 it did,
     which left SignupFlow.tsx's "Opretter…" button spinning forever with
     no error and no way out for the visitor. */
  let admin: AdminClient;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error("[odatone] signup: service role is not configured", err);
    return { ok: false, errors: { form: "server" } };
  }

  /* Duplicate-signup safety (fix round 1's Critical, closed further in fix
     round 2). `customers.billing_email` has a unique index now
     (0006_customer_email_unique.sql), but the lookup below still runs
     first — it's what turns "no row for this email" into a real decision
     (create vs. reuse vs. refuse) rather than just a constraint to bounce
     off of, and it's what makes the *reuse* path possible at all. The
     unique index exists for the case this lookup can't see on its own: two
     concurrent signups for the same brand-new email (see
     createCustomerWithOrder's `"conflict"` handling below). */
  const lookup = await lookupSignup(admin, built.value.customer.email);
  if (!lookup.ok) return { ok: false, errors: { form: "server" } };

  const dedupe = decideSignupDedupe(lookup.customers, lookup.profiles);

  if (dedupe.action === "already-registered") {
    /* An owner already exists for this email. Never invite, never create a
       second customer — the visitor already has an account. */
    return { ok: false, errors: { email: "exists" } };
  }

  let customerId: string;
  /* Only a customer this exact request created may ever be compensating-
     deleted below — a reused, pre-existing customer is never deleted by
     this request's own failure handling, only ever updated in place. */
  let createdCustomerThisRequest = false;

  if (dedupe.action === "reuse") {
    customerId = dedupe.customerId;
    const applied = await applyOrderToCustomer(admin, customerId, built.value, "reuse");
    if (!applied.ok) return { ok: false, errors: { form: "server" } };
  } else {
    const created = await createCustomerWithOrder(admin, built.value);

    if (created.status === "created") {
      customerId = created.customerId;
      createdCustomerThisRequest = true;
    } else if (created.status === "conflict") {
      /* Lost the race: a concurrent signup for this exact email committed
         between the lookup above and this insert. Re-running the lookup now
         sees the winner, and decideSignupDedupe recovers exactly as it
         would have if that row had existed from the start. */
      const relookup = await lookupSignup(admin, built.value.customer.email);
      if (!relookup.ok) return { ok: false, errors: { form: "server" } };
      const redecide = decideSignupDedupe(relookup.customers, relookup.profiles);

      if (redecide.action === "already-registered") {
        return { ok: false, errors: { email: "exists" } };
      }
      if (redecide.action === "create") {
        /* The conflicting row must have vanished between the two reads
           (e.g. another request's own compensating delete) — vanishingly
           unlikely, and not safe to retry indefinitely from here. */
        console.error("[odatone] signup: unique-email conflict but no customer found on re-check", {
          email: built.value.customer.email,
        });
        return { ok: false, errors: { form: "server" } };
      }

      customerId = redecide.customerId;
      const applied = await applyOrderToCustomer(admin, customerId, built.value, "reuse-after-race");
      if (!applied.ok) return { ok: false, errors: { form: "server" } };
    } else {
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
     or one that already existed — the fact fix round 1's Critical turned
     on. */
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
      /* Only reachable if the checks above raced or missed (e.g. an auth
         user confirmed out of band with no matching customer/profile row
         yet). This request's own speculative customer is removed — a
         customer that can never get an owner, because that email's owner
         already exists elsewhere, is not a lead worth keeping. A reused
         customer is left exactly as it was. */
      if (createdCustomerThisRequest) await deleteCustomer(admin, customerId, "invite target already registered");
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
    if (createdCustomerThisRequest) await deleteCustomer(admin, customerId, "invited user already has a profile");
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
       A pre-existing user (the exact Critical fix round 1 closed) is never
       deleted, no matter what error inserting its profile produced. */
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
