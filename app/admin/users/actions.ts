"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/forms";
import { buildStaffInvite } from "@/lib/staff-invite";
import { inviteCreatedNewUser, isAlreadyRegisteredError } from "@/lib/signup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Invites a new member of Odatone staff.
 *
 * The ordering here is the whole security argument, so it is worth stating
 * plainly. Creating an auth user needs GoTrue's admin API, which needs the
 * service-role key, and that key bypasses row-level security entirely.
 * Every RLS policy protecting `profiles` — including the one that stops a
 * `staff_support` member from minting a `staff_admin` — is inert for the
 * rest of this function. So authorisation is decided FIRST, against the
 * caller's own session, using the ordinary RLS-bound client, and the
 * service-role client is not even constructed until that has passed.
 *
 * Only `staff_admin` may invite. That mirrors `profiles_staff_write`
 * (0003_tenancy.sql), which lets a staff_admin write any profile but
 * restricts everyone else to the customer roles — this function is the
 * same rule, restated where RLS cannot reach.
 */
export async function inviteStaff(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const callerId = claimsData?.claims?.sub;
  if (typeof callerId !== "string") return { ok: false, errors: { form: "forbidden" } };

  /* Read through the session client, not the service-role one: this row is
     the caller's own, and reading it under RLS means a forged or stale
     session cannot produce a role. */
  const { data: caller, error: callerError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (callerError) {
    console.error("[odatone] staff invite: failed to read the caller's profile", callerError);
    return { ok: false, errors: { form: "service" } };
  }
  if (caller?.role !== "staff_admin") {
    /* Not a leak: proxy.ts has already established that this session is
       staff, so the only people who can reach this branch are colleagues
       without the privilege, not strangers probing for one. */
    console.warn("[odatone] staff invite: refused — caller is not a staff_admin", {
      caller: callerId,
      role: caller?.role ?? null,
    });
    return { ok: false, errors: { form: "forbidden" } };
  }

  const built = buildStaffInvite(formData);
  if (!built.ok) return { ok: false, errors: built.errors };

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    /* Same degradation as the public signup: a relative redirect still
       resolves against whatever host serves the mail client's request, so
       this warns rather than failing the invite outright. */
    console.warn(
      "[odatone] staff invite: NEXT_PUBLIC_SITE_URL is not set — the invite email's link will be a relative path, not an absolute URL",
    );
  }

  const admin = createAdminClient();
  const inviteStartedAt = Date.now();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    built.value.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/login` },
  );

  if (inviteError || !invited?.user) {
    if (isAlreadyRegisteredError(inviteError)) return { ok: false, errors: { email: "exists" } };
    console.error("[odatone] staff invite: invite failed", {
      email: built.value.email,
      error: inviteError,
    });
    return { ok: false, errors: { form: "service" } };
  }

  /* An address that already has a profile belongs to someone — a customer
     user, or a colleague already invited. Overwriting it would silently
     re-home a customer's owner into staff, or re-role a colleague. The
     insert below would fail on the primary key anyway; checking first
     means the failure is diagnosed rather than mistaken for a service
     fault. */
  const { data: existingProfile, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", invited.user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("[odatone] staff invite: failed to check for an existing profile", lookupError);
    return { ok: false, errors: { form: "service" } };
  }
  if (existingProfile) return { ok: false, errors: { email: "exists" } };

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    customer_id: null,
    role: built.value.role,
    full_name: built.value.fullName,
  });

  if (profileError) {
    /* The dangerous state: an auth user who can complete the invite and
       authenticate, but with no `profiles` row — proxy.ts 404s that session
       out of both portals with no explanation on screen. Rolling the auth
       user back is only safe when THIS request created it;
       inviteCreatedNewUser settles that from `created_at`, never by
       assuming the return value of inviteUserByEmail means "new". A
       pre-existing user is never deleted, whatever the insert failed on. */
    console.error("[odatone] staff invite: profile insert failed after invite", {
      user: invited.user.id,
      error: profileError,
    });
    if (inviteCreatedNewUser(invited.user.created_at, inviteStartedAt)) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(invited.user.id);
      if (cleanupError) {
        console.error("[odatone] staff invite: failed to roll back the orphaned invite", {
          user: invited.user.id,
          error: cleanupError,
        });
      }
    }
    return { ok: false, errors: { form: "service" } };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
