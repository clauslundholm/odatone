"use server";

import { EMAIL_RE, type ActionResult, type FieldErrors } from "@/lib/forms";
import {
  buildSignup,
  decideSignupDedupe,
  inviteCreatedNewUser,
  type ExistingCustomer,
  type ExistingProfile,
  type SignupInput,
  isAlreadyRegisteredError,
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
/** Deletes a customer this request is compensating away (a failed write
    past it, or a customer that can never get an owner because its email
    belongs to someone else). Fix round 2's Minor: the delete's own result
    used to be discarded, so a failed cleanup logged "removing the
    customer" while the customer stayed — demonstrated live. `context` goes
    straight into the log line so a failure here is diagnosable without
    guessing which of several call sites it came from.

    Fix round 5's Minor: every caller of this function only ever deletes a
    customer it believes has no owner — but "believes" is the operative
    word. In the narrow window a `create` request's own re-lookup-then-reuse
    race opens (create -> 23505 -> re-lookup -> reuse-after-race), a
    DIFFERENT concurrent signup for the identical email can legitimately
    finish its own invite and attach a real owner profile to this exact
    customer id between this request's last check and this delete actually
    running. Deleting it anyway would cascade away that other visitor's
    working profile (`profiles.customer_id references customers on delete
    cascade`) and orphan their auth user into Task 7's 404 trap — the exact
    failure class fix round 1 exists to close, reopened by this function's
    own cleanup path. Not reproduced locally (GoTrue rejected the losers'
    own invites in testing), reasoned from the code rather than observed —
    guarded regardless, since the cost of checking is one read and the cost
    of skipping the check is someone else's account. */
async function deleteCustomer(admin: AdminClient, customerId: string, context: string): Promise<void> {
  const { data: ownerCheck, error: ownerCheckError } = await admin
    .from("profiles")
    .select("id")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (ownerCheckError) {
    console.error(
      `[odatone] signup: failed to check for an owner before removing the customer (${context}) — leaving it in place`,
      { customer: customerId, error: ownerCheckError },
    );
    return;
  }
  if (ownerCheck) {
    console.error(
      `[odatone] signup: NOT removing the customer (${context}) — a concurrent signup already attached an owner to it`,
      { customer: customerId },
    );
    return;
  }

  const { error } = await admin.from("customers").delete().eq("id", customerId);
  if (error) {
    console.error(`[odatone] signup: failed to remove the customer (${context}) — it was NOT removed`, {
      customer: customerId,
      error,
    });
  }
}

type LookupResult =
  | {
      ok: true;
      customers: ExistingCustomer[];
      profiles: ExistingProfile[];
      customerIdsWithInvoices: Set<string>;
    }
  | { ok: false };

/** Everything already on file for a billing email: every `customers` row,
    every `profiles` row against any of them, and which of them already
    have an invoice. decideSignupDedupe (lib/signup.ts) turns this into the
    actual decision; this only reads.

    Fix round 3's Important: `customers_billing_email_unique_idx`
    (0006_customer_email_unique.sql) was on `lower(billing_email)`, but this
    lookup compared with a plain `.eq()`, which Postgres evaluates
    case-sensitively — a `customers` row holding "Mixed@Case.test" was
    invisible to a signup for "mixed@case.test".

    Fix round 4's Critical: round 3's own fix for that — matching via
    `.ilike()` against an escaped pattern — was itself exploitable.
    PostgREST rewrites a literal `*` in a `like`/`ilike` filter's pattern to
    `%` BEFORE Postgres ever sees it, and that rewrite happens entirely
    outside Postgres — no escaping on this app's side can reach it.
    `EMAIL_RE` (lib/forms.ts) permitted `*`, so an anonymous signup for an
    address like "*@*.test" reached the database as the pattern "%@%.test",
    matching every `customers` row; the `reuse` path (`applyOrderToCustomer`
    below) then rewrote whichever one it landed on — name, CVR, phone,
    address, every location, the subscription — as the attacker's own, and
    permanently refused the real business as "already registered" from
    then on. Reproduced live end to end through the real signup form.

    The fix is to never go through `like`/`ilike` for this lookup at all.
    `billing_email_lower` (0008_customer_email_lower_column.sql) is a
    generated, stored column — Postgres maintains it from `billing_email`
    itself — so this is now a plain `.eq()`, which PostgREST sends to
    Postgres as an ordinary `=` with no wildcard semantics from either
    side, and which can actually use an index (a functional index on
    `lower(billing_email)` could never serve a query filtering the raw
    `billing_email` column — every signup was a sequential scan before
    this). `EMAIL_RE` also now excludes `*`, as defence in depth, not as
    the fix itself. */
async function lookupSignup(admin: AdminClient, email: string): Promise<LookupResult> {
  const { data: customersRaw, error: customersError } = await admin
    .from("customers")
    .select("id, created_at, status")
    .eq("billing_email_lower", email);
  if (customersError) {
    console.error("[odatone] signup: failed to check for an existing customer", customersError);
    return { ok: false };
  }
  const customers = customersRaw ?? [];
  if (customers.length === 0) {
    return { ok: true, customers, profiles: [], customerIdsWithInvoices: new Set() };
  }

  const customerIds = customers.map((c) => c.id);
  const [profilesResult, invoicesResult] = await Promise.all([
    admin.from("profiles").select("customer_id").in("customer_id", customerIds),
    admin.from("invoices").select("customer_id").in("customer_id", customerIds),
  ]);
  if (profilesResult.error) {
    console.error("[odatone] signup: failed to check for an existing profile", profilesResult.error);
    return { ok: false };
  }
  if (invoicesResult.error) {
    console.error("[odatone] signup: failed to check for an existing invoice", invoicesResult.error);
    return { ok: false };
  }

  return {
    ok: true,
    customers,
    profiles: profilesResult.data ?? [],
    customerIdsWithInvoices: new Set((invoicesResult.data ?? []).map((r) => r.customer_id as string)),
  };
}

type OrderResult = { ok: true } | { ok: false };

/** Writes `value`'s order onto a customer — its own contact and billing
    fields, its locations (replaced, not merged) and its subscription
    (replaced, not merged) — via `apply_signup_order`
    (0007_apply_signup_order.sql), a single Postgres transaction rather than
    a sequence of separate statements from here. Called for both the
    `reuse` path (an existing, ownerless customer) and, since fix round 4,
    the `create` path too (a customer this same request just inserted) —
    see `createCustomerWithOrder`'s own doc comment for why every writer
    needs to go through the same locked function, not just `reuse`.

    Fix round 2's Important: the `reuse` path used to skip this entirely and
    only insert a `profiles` row, silently discarding the visitor's real
    plan, locations and business details onto whatever a pre-existing,
    unrelated customer row happened to hold. Refusing outright would be
    safer against writing onto someone else's row, but with no re-invite
    affordance anywhere in /admin, refusing would permanently strand exactly
    the people `reuse` exists to help — a repeat visitor whose first invite
    never arrived.

    Fix round 3's Important: doing that write as several separate statements
    from application code (`update`, then `delete`+`insert` on `locations`,
    then `delete`+`insert` on `subscriptions`) is not atomic, and two
    concurrent signups reusing the SAME customer interleaved their deletes
    and inserts — measured live with 4 concurrent requests: 8 `locations`
    rows drawn from three different visitors' orders, and 3 `subscriptions`
    rows for one customer, with the request that reported success back to
    its own visitor ending up with none of its own locations (a later
    request's `delete` had already removed them). Both admin screens price a
    customer as `quote(plan, billing, locations.length)`, so this wasn't
    just a display glitch — a race here bills whatever count of locations
    happens to survive it. `apply_signup_order` closes this by locking the
    customer row (`for update`) for the length of one transaction that does
    the update and both replacements together: a second, concurrent call for
    the same customer blocks behind the first rather than racing it, and
    whichever call runs second then fully overwrites the first's rows —
    always one visitor's complete, consistent order, never a mix of two.

    The risk of writing onto a stranger's row at all is bounded two ways:
    `reuse` only ever targets a customer decideSignupDedupe (lib/signup.ts)
    already confirmed has no owner AND is still `pending` with no invoice
    (fix round 3 — a real, active or already-billed customer is never a
    `reuse` target, however it lost its owner), and the invite that follows
    only ever goes to the email already on that customer's own record —
    never to anyone else's address. */
async function applyOrderToCustomer(
  admin: AdminClient,
  customerId: string,
  value: SignupInput,
  context: string,
): Promise<OrderResult> {
  const { error } = await admin.rpc("apply_signup_order", {
    p_customer_id: customerId,
    p_name: value.customer.name,
    p_cvr: value.customer.cvr,
    p_address: value.customer.address,
    p_postcode: value.customer.postcode,
    p_city: value.customer.city,
    p_phone: value.customer.phone,
    p_plan_id: value.planId,
    p_billing: value.billing,
    p_locations: value.locations,
  });
  if (error) {
    console.error(`[odatone] signup: failed to apply the customer's order (${context})`, {
      customer: customerId,
      error,
    });
    return { ok: false };
  }
  return { ok: true };
}

type CreateResult =
  | { status: "created"; customerId: string }
  | { status: "conflict" }
  | { status: "error" };

/** Creates a brand-new customer, then writes its locations and subscription
    via the SAME `apply_signup_order` function (0007_apply_signup_order.sql)
    the `reuse` path uses.

    Fix round 4's Important: this used to insert `locations` and
    `subscriptions` as two further statements of its own, with no lock of
    any kind — the bare `customers` row becomes visible to every other
    request the instant its own insert commits, so a concurrent signup that
    lost the `23505` race below, re-looked-up, and found this row
    `pending`/un-owned/uninvoiced could run `apply_signup_order`'s locked
    replacement in the gap *between* these two unlocked inserts. Reproduced
    once in 57 four-way concurrent runs: one customer left with one
    visitor's name and locations but TWO subscriptions — the interloper's
    and this path's own — which would have priced against whichever
    subscription a query happened to pick up first. Routing this write
    through the same locked function `reuse` uses closes it: every path
    that can write a customer's order now takes the same row lock, so no
    other request's write can ever land in the middle of this one's.

    Any failure past the customer insert deletes that customer via
    `deleteCustomer`, and `on delete cascade` (0002_commerce.sql) takes its
    locations and subscription with it, so a failed signup never leaves a
    half-created customer sitting in /admin/customers indistinguishable from
    a real pending one.

    `customers_billing_email_lower_unique_idx` (0008_customer_email_lower_column.sql)
    means the customer insert itself can lose a race to a concurrent signup
    for the same email — reported as `"conflict"` rather than a generic
    error, so the caller can recover via decideSignupDedupe instead of
    showing the visitor a raw database error for something that isn't
    really a failure. */
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

  const applied = await applyOrderToCustomer(admin, customerId, value, "create");
  if (!applied.ok) {
    await deleteCustomer(admin, customerId, "order write failed after create");
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

  const dedupe = decideSignupDedupe(lookup.customers, lookup.profiles, lookup.customerIdsWithInvoices);

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
      const redecide = decideSignupDedupe(relookup.customers, relookup.profiles, relookup.customerIdsWithInvoices);

      if (redecide.action === "already-registered") {
        return { ok: false, errors: { email: "exists" } };
      }
      if (redecide.action === "create") {
        /* The conflicting row must have vanished between the two reads
           (e.g. another request's own compensating delete) — vanishingly
           unlikely, and not safe to retry indefinitely from here. */
        /* No customer id to attach here -- this branch means the row that
           caused the original conflict has already vanished, so there is
           nothing left to identify by id. The email is still not logged:
           a log line is a place erasure can never reach, so it is exactly
           the wrong place for the one piece of PII this whole request is
           built around. */
        console.error("[odatone] signup: unique-email conflict but no customer found on re-check");
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
