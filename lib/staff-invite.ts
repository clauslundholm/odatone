import { EMAIL_RE, type FieldErrors } from "./forms.ts";

/* Mirrors the staff half of the `user_role` enum (0001_core.sql). The
   customer half ('owner', 'manager') is deliberately absent: profiles_tenancy_ck
   requires those to carry a customer_id, and a staff invite has none. A
   role that reached the insert anyway would either trip the constraint or,
   if the constraint ever loosened, create a tenant user belonging to no
   tenant — so it is refused at the form boundary instead. */
export const STAFF_ROLES = ["staff_admin", "staff_support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const STAFF_ROLE_SET: ReadonlySet<string> = new Set(STAFF_ROLES);

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLE_SET.has(value);
}

/** How each staff role is written in /admin. English only, like the rest
    of the staff console. */
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  staff_admin: "Admin",
  staff_support: "Support",
};

/** What each role actually gets, shown beside the choice on the invite
    form — a role picker whose options are two opaque nouns invites the
    wrong pick. Both see the whole console; they differ in whether they can
    grant access to anyone else (profiles_staff_write, 0003_tenancy.sql). */
export const STAFF_ROLE_HINT: Record<StaffRole, string> = {
  staff_admin: "Full access, and can invite other staff.",
  staff_support: "Full access, but cannot invite or change staff.",
};

export type StaffInvite = {
  /** Lower-cased and trimmed — see the comment at the assignment below. */
  email: string;
  fullName: string;
  role: StaffRole;
};

export type BuildStaffInviteResult =
  | { ok: true; value: StaffInvite }
  | { ok: false; errors: FieldErrors };

const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 254; // RFC 5321 §4.5.3.1.3

/**
 * Builds a validated staff invite from raw form input. Pure and
 * synchronous, and the same shape as `buildSignup` (lib/signup.ts) so the
 * two read alike — every bad field is reported, not just the first, so the
 * form can mark all of them in one round trip.
 *
 * This decides only that the *input* is well-formed. Whether the caller is
 * allowed to invite at all is a separate question, settled against the
 * caller's own session in app/admin/users/actions.ts — never here, and
 * never from anything the form said.
 */
export function buildStaffInvite(formData: FormData): BuildStaffInviteResult {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: FieldErrors = {};

  /* Lower-cased because GoTrue normalises addresses this way internally,
     while the profile lookups around the invite are plain Postgres text
     equality — which is not case-insensitive. Storing what the typist
     capitalised would make "Nynne@Odatone.dk" and "nynne@odatone.dk" two
     different people to every later comparison. */
  const email = get("email").toLowerCase();
  const fullName = get("fullName");
  const role = get("role");

  if (!email) errors.email = "email";
  else if (email.length > MAX_EMAIL_LEN) errors.email = "long";
  else if (!EMAIL_RE.test(email)) errors.email = "email";

  if (!fullName) errors.fullName = "required";
  else if (fullName.length > MAX_NAME_LEN) errors.fullName = "long";

  if (!isStaffRole(role)) errors.role = "required";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, fullName, role: role as StaffRole } };
}
