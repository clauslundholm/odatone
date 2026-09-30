import { EMAIL_RE, type FieldErrors } from "./forms.ts";
import type { Billing, PlanId } from "./pricing.ts";

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
    insert without a second remapping step.

    Only a name. The signup flow used to ask every visitor for a venue
    type, a floor area and an opening-hours band; it no longer does, and
    inventing plausible values for columns nobody filled in would be worse
    than leaving them empty — a made-up 150 m² goes on to drive the "Fit"
    meter in /admin as though someone had said it. `venue_type` and `m2`
    are nullable as of 0014, and `hours_band` keeps its own default. */
export type SignupLocation = {
  name: string;
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
    /** Eight digits, normalised by parseCvr. Never null for a signup built
        here — the field is required — but the type keeps null because
        `customers.cvr` is a nullable column holding rows created before it
        was, and lib/gdpr.ts nulls it when anonymising. */
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

const BILLING_TERMS = new Set<string>(["monthly", "annual"]);

/* `locations.m2` and the location count both land in Postgres `integer`
   columns (max 2,147,483,647). app/admin/products/validate.ts's fix round
   found the generic failure this produces when a huge number is coerced
   straight through: a confusing "Something went wrong" instead of a field
   error, for a mistake the server could have caught before ever reaching
   the database. Same reject-before-coerce shape is used here: validate the
   raw string first, only then turn it into a number. */
const DIGITS_RE = /^\d+$/;
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
   would create a wrong record, not a safe one).

   Fix round 2 corrected the optional business fields (address/postcode/
   city/phone — cvr was one of them until it became required; see parseCvr)
   to match: they used to be silently truncated at this same
   bound rather than rejected, which is the identical "wrong record, not a
   safe one" mistake — a CVR number or an invoicing address cut off mid-way
   is not a safe fallback for a real one, it's a corrupted one nobody would
   notice until an invoice bounced. All eight fields now share one rule:
   reject outright past the bound, never truncate. */
const MAX_TEXT_LEN = 200;
const MAX_EMAIL_LEN = 254; // RFC 5321 §4.5.3.1.3
const MAX_OPTIONAL_LEN = 300;

/** "clamps locations to at least 1" per the brief: blank is the calculator's
    own default, and 0 clamps up rather than erroring — but this fix round
    found the previous version reaching that leniency through a bare
    `Number(raw)`, which parses `"0x1F4"` as 500 and `"3.7"` as 4 (rounded).
    A digit string is now required before any numeric coercion at all, the
    the same doctrine the old `m2` parser applied — genuinely
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

/** A Danish CVR number is exactly eight digits. People write it with spaces
    ("12 34 56 78"), with a "DK" prefix off a letterhead, or with dots, so
    those are stripped before counting rather than rejected — but what gets
    stored is always the bare eight digits, so two customers who typed the
    same number the same way are the same string in the database.
 *
 *  Returns null for anything that isn't eight digits, INCLUDING blank. CVR
 *  used to be optional here (a `boundedOptional` alongside address and
 *  phone, stored as null when absent), which left /admin showing "CVR —" on
 *  real customers and, more seriously, left invoices without the one field
 *  that identifies a Danish business on them — lib/invoice-issuer.ts prints
 *  the customer's CVR, and a null there is a document that names no company
 *  registration at all. The signup form now requires it, and this is what
 *  makes that a rule rather than a decoration: a raw POST bypassing the form
 *  is refused here too. */
export function parseCvr(raw: string): string | null {
  const cleaned = raw.trim().replace(/^DK/i, "").replace(/[\s.\-]/g, "");
  return /^\d{8}$/.test(cleaned) ? cleaned : null;
}

/** Blank is a legitimate "not given" (`null`); anything else past `max` is
    rejected outright rather than truncated — see the write-amplification
    comment above `MAX_TEXT_LEN` for why silently cutting these off is the
    wrong fix. */
function boundedOptional(raw: string, max: number): { value: string | null } | { error: true } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  return trimmed.length > max ? { error: true } : { value: trimmed };
}

/** Builds a validated signup from raw form input. Pure and synchronous —
    no plan price is ever read here, because none is ever trusted from the
    form in the first place: only a `PlanId` is validated, never a monthly
    figure.
 *
 *  `validPlanIds` is the set the chosen plan must belong to, and it is a
 *  parameter rather than a constant because the answer now lives in the
 *  database. This used to check the compiled `PLANS` array, which meant a
 *  plan created in /admin/products was offered to the visitor by the very
 *  same page that would then reject their choice as `plan: "required"` — a
 *  form error with no field to point at and nothing the visitor could do
 *  about it. The caller passes what it actually rendered the plan cards
 *  from (lib/plans-server.ts's `activePlans()`, whose own compiled fallback
 *  keeps signup working when the database is unreachable), so the set that
 *  was offered and the set that is accepted cannot drift apart. Passing it
 *  in also keeps this function pure and unit-testable, which a read inside
 *  it would not. */
export function buildSignup(formData: FormData, validPlanIds: ReadonlySet<string>): BuildSignupResult {
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

  if (!name) errors.name = "required";
  else if (name.length > MAX_TEXT_LEN) errors.name = "long";

  if (!company) errors.company = "required";
  else if (company.length > MAX_TEXT_LEN) errors.company = "long";

  if (!email) errors.email = "email";
  else if (email.length > MAX_EMAIL_LEN) errors.email = "long";
  else if (!EMAIL_RE.test(email)) errors.email = "email";

  /* Two codes, not one: a blank field and a mistyped one are different
     mistakes, and "8 cifre" is a strange thing to say about a field nobody
     has touched yet. */
  const cvrRaw = get("cvr");
  const cvr = parseCvr(cvrRaw);
  if (!cvrRaw) errors.cvr = "required";
  else if (cvr === null) errors.cvr = "cvr";

  if (!validPlanIds.has(planRaw)) errors.plan = "required";
  if (billingRaw && !BILLING_TERMS.has(billingRaw)) errors.billing = "required";

  const parsedLocations = parseLocationCount(get("locations"));
  if ("error" in parsedLocations) errors.locations = "required";
  const locationCount = "count" in parsedLocations ? parsedLocations.count : 1;

  const addressField = boundedOptional(get("address"), MAX_OPTIONAL_LEN);
  const postcodeField = boundedOptional(get("postcode"), MAX_OPTIONAL_LEN);
  const cityField = boundedOptional(get("city"), MAX_OPTIONAL_LEN);
  const phoneField = boundedOptional(get("phone"), MAX_OPTIONAL_LEN);
  if ("error" in addressField) errors.address = "long";
  if ("error" in postcodeField) errors.postcode = "long";
  if ("error" in cityField) errors.city = "long";
  if ("error" in phoneField) errors.phone = "long";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const billing: Billing = billingRaw === "annual" ? "annual" : "monthly";
  const locations: SignupLocation[] = Array.from({ length: locationCount }, (_, i) => ({
    name: locationCount > 1 ? `${company} #${i + 1}` : company,
  }));

  return {
    ok: true,
    value: {
      customer: {
        name: company,
        email,
        contactName: name,
        cvr,
        address: "value" in addressField ? addressField.value : null,
        postcode: "value" in postcodeField ? postcodeField.value : null,
        city: "value" in cityField ? cityField.value : null,
        phone: "value" in phoneField ? phoneField.value : null,
      },
      planId: planRaw,
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

export type ExistingCustomer = { id: string; created_at: string; status: string };
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

/** Fix round 3: a customer is only safe to hand a stranger's new order to
    (`applyOrderToCustomer`/`apply_signup_order` in app/actions.ts, which
    rewrites the customer's own contact fields, replaces every `locations`
    row and replaces the `subscriptions` row) when nothing real has
    happened to it yet. Reproduced live: without this, a repeat visitor —
    or anyone who merely learned a real customer's billing email — could
    replace an *active* customer's name/CVR/phone/address, delete a live
    subscription (its `started_at` included) and recreate it as `pending`
    on a plan of their choosing, while its existing invoices silently stayed
    attached to the now-differently-named business. `status` moves away
    from `pending` only through staff action or a real payment provider
    activating a subscription (0003_tenancy.sql's `guard_customer_status`
    trigger), and an invoice only exists once billing has actually
    started — either one means a real relationship already exists, and
    `reuse` must not touch it. */
function isReuseEligible(customer: ExistingCustomer, customerIdsWithInvoices: ReadonlySet<string>): boolean {
  return customer.status === "pending" && !customerIdsWithInvoices.has(customer.id);
}

export function decideSignupDedupe(
  existingCustomers: ExistingCustomer[],
  existingProfiles: ExistingProfile[],
  customerIdsWithInvoices: ReadonlySet<string> = new Set(),
): SignupDedupeDecision {
  if (existingCustomers.length === 0) return { action: "create" };

  const ownedCustomerIds = new Set(
    existingProfiles.map((p) => p.customer_id).filter((id): id is string => id !== null),
  );
  const alreadyOwned = existingCustomers.some((c) => ownedCustomerIds.has(c.id));
  if (alreadyOwned) return { action: "already-registered" };

  const reuseEligible = existingCustomers.filter((c) => isReuseEligible(c, customerIdsWithInvoices));
  if (reuseEligible.length === 0) {
    /* A customer exists for this email, nobody owns it, but it also isn't
       safe to silently take over (not pending, or already invoiced) — a
       state an ordinary signup should never produce on its own. Refused
       with the same outcome as an owned account: there is a real customer
       here already, and it needs a human, not an automatic decision. */
    return { action: "already-registered" };
  }

  const oldest = [...reuseEligible].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  return { action: "reuse", customerId: oldest.id };
}

/* Fix round 4 removed escapeLikePattern, which used to live here.
   Escaping `%`/`_`/`\` made `.ilike()` safe against Postgres's own
   wildcard semantics, but PostgREST rewrites a literal `*` in a
   `like`/`ilike` filter's pattern to `%` BEFORE Postgres ever sees it —
   entirely outside Postgres, so no amount of escaping on this side could
   ever reach it. `EMAIL_RE` (lib/forms.ts) permitted `*`, and the result
   was exploitable end to end: a signup for "*@*.test" reached the
   database as the pattern "%@%.test", matching every `customers` row.
   `lookupSignup` (app/actions.ts) now compares `billing_email_lower`, a
   generated column (0008_customer_email_lower_column.sql), with a plain
   `.eq()` — no `like`/`ilike` operator, no wildcard semantics from either
   PostgREST or Postgres, nothing left for this function to protect
   against. */

/** Whether the auth user `inviteUserByEmail` returned was actually created
    by *this* call, or already existed before it. `createdAt` never changes
    across repeated invites to the same unconfirmed address (verified live
    against the local GoTrue instance — only `invited_at`/
    `confirmation_sent_at`/`updated_at` change on a resend), so comparing it
    against a timestamp captured immediately before the invite call is a
    deterministic fact about this specific request, not a guess — the only
    signal this module trusts before app/actions.ts is allowed to delete an
    auth user.

    Fix round 2: this used to subtract a 5-second "clock skew" allowance
    from `requestStartedAtMs` before comparing, which was the *dangerous*
    direction — measured live, a user created 4999ms *before* this request
    started was classified as "this request created it" and became
    eligible for `deleteUser`. That is exactly the failure mode this
    function exists to prevent; it was only unreachable because GoTrue's
    unique-email constraint happened to intercept the concurrent case
    first, not because this check made it safe. The comparison is now
    strict: `created_at` must be at or after the instant this request
    started invite-ing, full stop. Clock skew that actually needs
    tolerating — the Auth server's clock running slightly *ahead* of this
    process's — needs no allowance at all: it only ever pushes `created_at`
    *later* than `requestStartedAtMs`, which `>=` already accepts. */
export function inviteCreatedNewUser(createdAt: string, requestStartedAtMs: number): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return created >= requestStartedAtMs;
}

/** Whether an invite failed because the address already has a fully
    registered auth user. GoTrue reports this as `email_exists`; older
    versions only as HTTP 422, so both are accepted. Shared by the public
    signup (app/actions.ts) and the staff invite (app/admin/users/actions.ts)
    — two copies of this predicate would drift the next time GoTrue changes
    how it spells the error. */
export function isAlreadyRegisteredError(error: unknown): boolean {
  const e = error as { code?: string; status?: number } | null | undefined;
  return e?.code === "email_exists" || e?.status === 422;
}
