import { EMAIL_RE, type FieldErrors } from "./forms.ts";
import { PLANS, type Billing, type PlanId } from "./pricing.ts";
import { VENUE_TYPES } from "./rates.ts";

/* Pure form-parsing/validation for the public signup flow, kept apart from
   app/actions.ts (which imports "use server" and, once it persists, the
   service-role client — neither resolves under plain `node --test`) so this
   logic can be unit tested directly. Same boundary lib/plans-row.ts already
   draws against lib/plans-server.ts, and app/admin/products/validate.ts
   draws against app/admin/products/actions.ts.

   Everything that needs a live database (the dedupe lookup, the writes, the
   invite) stays in app/actions.ts. What's here is deliberately the part that
   doesn't: the two functions at the bottom (decideSignupDedupe,
   inviteCreatedNewUser) are pure decision logic extracted from that async
   code specifically so Task 13's fix round's Critical — a duplicate signup
   deleting an existing owner's account — has unit test coverage a green
   suite can't pass without. */

/** One `locations` row's worth of data, keyed exactly as the table's
    columns are spelled so app/actions.ts can spread it straight into an
    insert without a second remapping step. */
export type SignupLocation = {
  name: string;
  venue_type: string;
  m2: number;
  hours_band: string;
};

export type SignupInput = {
  customer: {
    /** The business name — this is what lands in `customers.name`, the
        column the admin roster and every invoice is keyed by. */
    name: string;
    /** `customers.billing_email`, and where the invite is sent. Lower-cased
        (see buildSignup) so a later lookup by email — the dedupe check this
        fix round adds — can't miss a match over case alone. */
    email: string;
    /** The person signing up, not the business — carried separately so it
        can become `profiles.full_name` for the owner account without
        overwriting it with the company name. */
    contactName: string;
    /** Everything below is optional, billing/invoicing detail the form
        already collects (StepAccount) but the original cut of this task
        discarded on the way to `customers` — confirmed live: a real signup
        showed "CVR —" and "Address DK" in /admin. `null`, not `""`, for
        "not given" — these are nullable text columns
        (supabase/migrations/0001_core.sql). */
    cvr: string | null;
    address: string | null;
    postcode: string | null;
    city: string | null;
    phone: string | null;
  };
  /** Validated against the known plan ids only. This is deliberately not a
      price: nothing here is ever multiplied by money. What a plan costs is
      looked up server-side, at read time, from the `plans` table (see
      lib/plans-server.ts) — never from this form, and never stored on the
      subscription row itself (supabase/migrations/0002_commerce.sql's
      `subscriptions` table has no price column; it references `plan_id`
      and prices are joined in live, which is exactly what makes a later
      price edit apply to every subscription without a migration). */
  planId: PlanId;
  billing: Billing;
  locations: SignupLocation[];
};

export type BuildSignupResult =
  | { ok: true; value: SignupInput }
  | { ok: false; errors: FieldErrors };

const PLAN_IDS = new Set<string>(PLANS.map((p) => p.id));
const VENUE_TYPE_IDS = new Set<string>(VENUE_TYPES.map((v) => v.id));
const BILLING_TERMS = new Set<string>(["monthly", "annual"]);

/* `locations.m2` and the location count both land in Postgres `integer`
   columns (max 2,147,483,647). app/admin/products/validate.ts's fix round
   found the generic failure this produces when a huge number is coerced
   straight through: a confusing "Something went wrong" instead of a field
   error, for a mistake the server could have caught before ever reaching
   the database. Same reject-before-coerce shape is used here: validate the
   raw string first, only then turn it into a number. */
const DIGITS_RE = /^\d+$/;
const MAX_M2 = 2_147_483_647;
/** Not a database limit — the UI's own stepper stops at 99 (SignupFlow's
    `+`/`-` buttons). A raw POST could still claim more, so this is a sane
    ceiling on how many `locations` rows one signup may create in a single
    request, independent of whatever the client happened to render. */
const MAX_LOCATIONS = 500;

/* Fix round 1's "write-amplification" finding: an anonymous POST with a
   50,000-character company name and 500 locations created 25MB of rows and
   still showed the success screen — there is no rate limiting anywhere in
   this repo, so unbounded text is the only thing standing between a single
   request and an arbitrarily large write. `name`/`company`/`email` are
   required and appear in every location row this signup creates, so they're
   rejected outright when too long (silently truncating a legal company name
   would create a wrong record, not a safe one). The optional business
   fields below are truncated instead — they're free text nobody downstream
   parses structurally, so a bound with no error is enough. */
const MAX_TEXT_LEN = 200;
const MAX_EMAIL_LEN = 254; // RFC 5321 §4.5.3.1.3
const MAX_OPTIONAL_LEN = 300;

function parsePositiveInt(raw: string, max: number): number | null {
  const trimmed = raw.trim();
  if (!DIGITS_RE.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 && n <= max ? n : null;
}

/** "clamps locations to at least 1" per the brief: blank is the calculator's
    own default, and 0 clamps up rather than erroring — but this fix round
    found the previous version reaching that leniency through a bare
    `Number(raw)`, which parses `"0x1F4"` as 500 and `"3.7"` as 4 (rounded).
    A digit string is now required before any numeric coercion at all, the
    same doctrine `parsePositiveInt` already applies to `m2` — genuinely
    malformed input (hex, decimals, negatives, letters) is rejected outright
    rather than silently reinterpreted as some other, arbitrary count. */
function parseLocationCount(raw: string): { count: number } | { error: true } {
  const trimmed = raw.trim();
  if (trimmed === "") return { count: 1 };
  if (!DIGITS_RE.test(trimmed)) return { error: true };
  const n = Number(trimmed);
  if (n > MAX_LOCATIONS) return { error: true };
  return { count: Math.max(1, n) };
}

const optional = (raw: string, max: number): string | null => {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
};

/** Builds a validated signup from raw form input. Pure and synchronous —
    no plan price is ever read here, because none is ever trusted from the
    form in the first place: only a `PlanId` is validated, never a monthly
    figure. */
export function buildSignup(formData: FormData): BuildSignupResult {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: FieldErrors = {};

  const name = get("name");
  const company = get("company");
  /* Lower-cased so a later lookup-by-email (the dedupe check app/actions.ts
     runs before ever inviting anyone) can't miss "Jens@Nord.test" against
     "jens@nord.test" — Postgres text equality is case-sensitive and GoTrue
     itself normalises addresses this way internally. */
  const email = get("email").toLowerCase();
  /* SignupFlow.tsx submits the field as "planId"; this module's own test
     fixture (and, in principle, any other caller) spells it "plan". Both
     are accepted rather than betting the whole form on one caller's naming
     and quietly failing the other's. */
  const planRaw = get("planId") || get("plan");
  const billingRaw = get("billing");
  const venueTypeRaw = get("venueType");

  if (!name) errors.name = "required";
  else if (name.length > MAX_TEXT_LEN) errors.name = "long";

  if (!company) errors.company = "required";
  else if (company.length > MAX_TEXT_LEN) errors.company = "long";

  if (!email) errors.email = "email";
  else if (email.length > MAX_EMAIL_LEN) errors.email = "long";
  else if (!EMAIL_RE.test(email)) errors.email = "email";

  if (!PLAN_IDS.has(planRaw)) errors.plan = "required";
  if (!VENUE_TYPE_IDS.has(venueTypeRaw)) errors.venueType = "required";
  if (billingRaw && !BILLING_TERMS.has(billingRaw)) errors.billing = "required";

  const m2 = parsePositiveInt(get("m2"), MAX_M2);
  if (m2 === null) errors.m2 = "required";

  const parsedLocations = parseLocationCount(get("locations"));
  if ("error" in parsedLocations) errors.locations = "required";
  const locationCount = "count" in parsedLocations ? parsedLocations.count : 1;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const billing: Billing = billingRaw === "annual" ? "annual" : "monthly";
  const locations: SignupLocation[] = Array.from({ length: locationCount }, (_, i) => ({
    name: locationCount > 1 ? `${company} #${i + 1}` : company,
    venue_type: venueTypeRaw,
    m2: m2 as number,
    hours_band: "normal",
  }));

  return {
    ok: true,
    value: {
      customer: {
        name: company,
        email,
        contactName: name,
        cvr: optional(get("cvr"), MAX_OPTIONAL_LEN),
        address: optional(get("address"), MAX_OPTIONAL_LEN),
        postcode: optional(get("postcode"), MAX_OPTIONAL_LEN),
        city: optional(get("city"), MAX_OPTIONAL_LEN),
        phone: optional(get("phone"), MAX_OPTIONAL_LEN),
      },
      planId: planRaw as PlanId,
      billing,
      locations,
    },
  };
}

/* ---------------------------------------------------------------------- *
 *  Duplicate-signup safety
 *
 *  The fix round's Critical: GoTrue's inviteUserByEmail does not fail for an
 *  existing *unconfirmed* user — it silently re-invites and returns that
 *  same user (confirmed against the local stack: `created_at` is identical
 *  across two invite calls for the same address, only `invited_at` /
 *  `confirmation_sent_at` change). The original code treated the returned
 *  user as "the one this request just created", so a second signup with the
 *  same email — say, because the first invite email never arrived — hit a
 *  `profiles` primary-key conflict (the first attempt's profile already
 *  used that id) and then "rolled back" by deleting that auth user, which
 *  cascaded away the FIRST customer's real, working profile. Reproduced
 *  live twice by the coordinator; anyone who knows a customer's billing
 *  email could destroy their unaccepted invite this way from the public
 *  form, unauthenticated.
 *
 *  Two independent guards close this, both pure and both tested below:
 *  decideSignupDedupe (checked BEFORE ever creating a customer or calling
 *  invite) and inviteCreatedNewUser (checked immediately before the one
 *  place that's still allowed to call deleteUser). Either alone would have
 *  prevented the reproduced bug; both together also cover the race a
 *  pre-check alone can't (two signups for the same brand-new email landing
 *  concurrently).
 * ---------------------------------------------------------------------- */

export type ExistingCustomer = { id: string; created_at: string };
export type ExistingProfile = { customer_id: string | null };

export type SignupDedupeDecision =
  /** An owner (or manager) profile already exists for one of the customers
      billing to this email — a completed account. Never invite, never
      create a new customer for it: tell the visitor to check their inbox or
      log in instead. */
  | { action: "already-registered" }
  /** A customer with this billing email exists but nobody has ever
      completed the invite for it (no profile row on any of them yet).
      Reuse the oldest one — "re-send the invite, don't create a second
      customer" — rather than minting another `customers` row for the same
      business every time someone resubmits the form. */
  | { action: "reuse"; customerId: string }
  /** No existing customer at all: a genuinely new signup. */
  | { action: "create" };

export function decideSignupDedupe(
  existingCustomers: ExistingCustomer[],
  existingProfiles: ExistingProfile[],
): SignupDedupeDecision {
  if (existingCustomers.length === 0) return { action: "create" };

  const ownedCustomerIds = new Set(
    existingProfiles.map((p) => p.customer_id).filter((id): id is string => id !== null),
  );
  const alreadyOwned = existingCustomers.some((c) => ownedCustomerIds.has(c.id));
  if (alreadyOwned) return { action: "already-registered" };

  const oldest = [...existingCustomers].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  return { action: "reuse", customerId: oldest.id };
}

/** Whether the auth user `inviteUserByEmail` returned was actually created
    by *this* call, or already existed before it. `createdAt` never changes
    across repeated invites to the same unconfirmed address (verified live
    against the local GoTrue instance — only `invited_at`/
    `confirmation_sent_at`/`updated_at` change on a resend), so comparing it
    against a timestamp captured immediately before the invite call is a
    deterministic fact about this specific request, not a guess — the only
    signal this module trusts before app/actions.ts is allowed to delete an
    auth user. `slackMs` absorbs clock skew between this process and the
    Auth server; it does not need to be generous, since a truly pre-existing
    user's `created_at` is normally seconds-to-years older, never a hair
    younger. */
export function inviteCreatedNewUser(
  createdAt: string,
  requestStartedAtMs: number,
  slackMs = 5000,
): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return created >= requestStartedAtMs - slackMs;
}
