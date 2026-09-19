"use server";

import { anonymisedCustomer } from "@/lib/gdpr";
import { fetchAllRows } from "@/lib/admin/paginate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Row shape is deliberately loose here: every table's full columns go
    straight into the export, so a column added to any of these tables
    later is captured automatically rather than needing this file to be
    remembered and updated alongside the migration that added it. */
type Row = Record<string, unknown>;

/**
 * Every row this codebase's migrations let reference a customer, gathered
 * against the migration list rather than from memory:
 *   0001_core.sql      -- customers (the row itself), locations, profiles
 *   0002_commerce.sql  -- subscriptions, subscription_addons (via
 *                         subscriptions.id), invoices, audit_log
 * `plans` and `addons` (also 0002_commerce.sql) are the opposite direction
 * -- a global catalogue subscriptions point *into*, not something that
 * points at a customer -- so they hold nothing personal to export.
 *
 * Read via the caller's own session (`createClient`), not the service
 * role: every one of these tables' RLS policies already grants a staff
 * session read access (`customers_read`, `is_staff()` on locations/
 * profiles/subscriptions/invoices, `audit_read`), so there is nothing here
 * a service-role client would see that this session cannot -- and running
 * a data export as the actor who requested it, rather than as an
 * unaccountable service identity, is the safer default when the two are
 * equally capable. `fetchAllRows` (lib/admin/paginate.ts) is used for every
 * per-customer list so a customer that has grown past PostgREST's row cap
 * still gets a complete export rather than a silently truncated one -- an
 * export that quietly drops rows is a false statement to the data subject
 * it's made for.
 */
export async function exportCustomer(id: string): Promise<Blob> {
  const supabase = await createClient();

  const [
    { data: customer, error: customerError },
    locationsResult,
    profilesResult,
    subscriptionsResult,
    invoicesResult,
    auditResult,
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    fetchAllRows<Row>(
      (from, to) =>
        supabase
          .from("locations")
          .select("*", { count: "exact" })
          .eq("customer_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      `gdpr export: locations for ${id}`,
    ),
    fetchAllRows<Row>(
      (from, to) =>
        supabase
          .from("profiles")
          .select("*", { count: "exact" })
          .eq("customer_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      `gdpr export: profiles for ${id}`,
    ),
    fetchAllRows<Row>(
      (from, to) =>
        supabase
          .from("subscriptions")
          .select("*", { count: "exact" })
          .eq("customer_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      `gdpr export: subscriptions for ${id}`,
    ),
    fetchAllRows<Row>(
      (from, to) =>
        supabase
          .from("invoices")
          .select("*", { count: "exact" })
          .eq("customer_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      `gdpr export: invoices for ${id}`,
    ),
    // audit_log has no customer_id column of its own -- 0004_audit_triggers.sql's
    // triggers key every row by (entity, entity_id), and this task's own
    // erasure entry (below) follows the same shape: entity = 'customer'.
    fetchAllRows<Row>(
      (from, to) =>
        supabase
          .from("audit_log")
          .select("*", { count: "exact" })
          .eq("entity", "customer")
          .eq("entity_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      `gdpr export: audit_log for ${id}`,
    ),
  ]);

  // subscription_addons is reached through subscriptions.id, not
  // customer_id, so it can only be queried once the subscription rows
  // above are known. Skipped entirely for a customer with none -- .in()
  // against an empty array is a query PostgREST is happy to run, but
  // there is no point paying for the round trip.
  const subscriptionIds = subscriptionsResult.rows
    .map((row) => row.id)
    .filter((value): value is string => typeof value === "string");
  const subscriptionAddonsResult =
    subscriptionIds.length > 0
      ? await fetchAllRows<Row>(
          (from, to) =>
            supabase
              .from("subscription_addons")
              .select("*", { count: "exact" })
              .in("subscription_id", subscriptionIds)
              .order("subscription_id", { ascending: true })
              .order("addon_id", { ascending: true })
              .range(from, to),
          `gdpr export: subscription_addons for ${id}`,
        )
      : { rows: [] as Row[], error: null };

  for (const [label, error] of [
    ["customer", customerError],
    ["locations", locationsResult.error],
    ["profiles", profilesResult.error],
    ["subscriptions", subscriptionsResult.error],
    ["subscription_addons", subscriptionAddonsResult.error],
    ["invoices", invoicesResult.error],
    ["audit_log", auditResult.error],
  ] as const) {
    if (error) console.error(`[gdpr] exportCustomer: failed to read ${label}`, { customerId: id, error });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    customer: customer ?? null,
    locations: locationsResult.rows,
    profiles: profilesResult.rows,
    subscriptions: subscriptionsResult.rows,
    subscription_addons: subscriptionAddonsResult.rows,
    invoices: invoicesResult.rows,
    audit_log: auditResult.rows,
  };

  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

/** The caller's own profile, but only when it is `staff_admin`. Everything
    below this line either bypasses RLS outright (the service-role client,
    for the two things only it can do -- delete an auth user, and insert
    into `audit_log`, which 0003_tenancy.sql gives no INSERT policy to any
    role at all, staff included) or changes `customers.status`, which
    `guard_customer_status` (0003_tenancy.sql) already lets *any* staff role
    do. Neither of those checks the narrower thing this action needs: that
    erasure -- unlike viewing a customer, which `staff_support` does every
    day -- is staff_admin-only. Plan and add-on prices get that narrowing
    for free from `plans_admin_write`/`addons_admin_write`'s own
    `is_staff_admin()` check; erasure has no equivalent policy to lean on
    because the writes it needs to make don't go through a policy at all,
    so the check has to be made explicitly, here, before anything
    irreversible happens. */
async function currentStaffAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    // Deliberately no email/name here -- see gdpr-actions.ts's other
    // console.error calls and lib/signup.ts's Task 13 precedent: an actor
    // id is enough to investigate a failure, and PII belongs in the export
    // this file produces on purpose, not in a log line nobody asked for.
    console.error("[gdpr] currentStaffAdmin: failed to read the caller's profile", { error });
    return null;
  }
  if (!profile || profile.role !== "staff_admin") return null;
  return { id: profile.id };
}

/**
 * Erasure anonymises `customers` (see lib/gdpr.ts's anonymisedCustomer for
 * why) and deletes the customer's auth users outright -- there is no
 * five-year duty covering who could once sign in, only over what was
 * billed, so a tombstone buys nothing there that an outright delete
 * doesn't already give more simply. Deleting the auth user cascades to its
 * `profiles` row (`profiles.id references auth.users(id) on delete
 * cascade`, 0001_core.sql) without a separate statement.
 *
 * Every invoice row is left exactly as it was: no column on `invoices` is
 * touched, so `total_ore`/`subtotal_ore`/`vat_ore` and every other field
 * survive erasure unchanged, still attributed to this (now-anonymous)
 * customer id for as long as Danish bookkeeping law requires them kept.
 *
 * Runs on the service-role client throughout, not just for the two steps
 * that strictly require it (auth deletion, the audit_log insert) -- once
 * the staff_admin check above has already gated the whole action, doing
 * the `customers` update on the same client keeps this one function
 * auditable as a single unit rather than mixing which client does which
 * statement. The `guard_customer_status` trigger (0003_tenancy.sql)
 * explicitly exempts `service_role` from its "only staff may change
 * status" check, so this does not need is_staff() to be true under this
 * client the way a session-based write would.
 */
export async function eraseCustomer(id: string): Promise<{ error?: string }> {
  const actor = await currentStaffAdmin();
  if (!actor) return { error: "forbidden" };

  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("customers")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    console.error("[gdpr] eraseCustomer: failed to look up the customer", { customerId: id, error: lookupError });
    return { error: "erase" };
  }
  if (!existing) return { error: "not-found" };

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("customer_id", id);
  if (profilesError) {
    console.error("[gdpr] eraseCustomer: failed to read the customer's users", {
      customerId: id,
      error: profilesError,
    });
    return { error: "erase" };
  }

  for (const profile of profiles ?? []) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.id);
    if (deleteUserError) {
      console.error("[gdpr] eraseCustomer: failed to delete an auth user", {
        customerId: id,
        profileId: profile.id,
        error: deleteUserError,
      });
      return { error: "erase" };
    }
  }

  const tombstone = anonymisedCustomer(id);
  const { error: updateError } = await admin
    .from("customers")
    .update({ ...tombstone, status: "cancelled" })
    .eq("id", id);
  if (updateError) {
    console.error("[gdpr] eraseCustomer: failed to write the tombstone", { customerId: id, error: updateError });
    return { error: "erase" };
  }

  // `before` is deliberately omitted -- unlike log_plan_change's trigger,
  // which records a plan's full old row, the entire point of this write is
  // that the customer's real name and contact details must not survive
  // anywhere, including here. `after` is safe to store in full: it's
  // `tombstone`, which by construction carries nothing but this id.
  const { error: auditError } = await admin.from("audit_log").insert({
    actor_id: actor.id,
    action: "erase",
    entity: "customer",
    entity_id: id,
    after: tombstone,
  });
  if (auditError) {
    console.error("[gdpr] eraseCustomer: erased, but the audit_log entry failed to write", {
      customerId: id,
      error: auditError,
    });
    return { error: "audit" };
  }

  return {};
}
