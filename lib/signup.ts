import { EMAIL_RE, type FieldErrors } from "./forms.ts";
import { PLANS, type Billing, type PlanId } from "./pricing.ts";
import { VENUE_TYPES } from "./rates.ts";

/* Pure form-parsing/validation for the public signup flow, kept apart from
   app/actions.ts (which imports "use server" and, once it persists, the
   service-role client — neither resolves under plain `node --test`) so this
   logic can be unit tested directly. Same boundary lib/plans-row.ts already
   draws against lib/plans-server.ts, and app/admin/products/validate.ts
   draws against app/admin/products/actions.ts. */

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
    /** `customers.billing_email`, and where the invite is sent. */
    email: string;
    /** The person signing up, not the business — carried separately so it
        can become `profiles.full_name` for the owner account without
        overwriting it with the company name. */
    contactName: string;
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

/* `locations.m2` and a hypothetical location count both land in Postgres
   `integer` columns (max 2,147,483,647). app/admin/products/validate.ts's
   fix round found the generic failure this produces when a huge number is
   coerced straight through: a confusing "Something went wrong" instead of
   a field error, for a mistake the server could have caught before ever
   reaching the database. Same reject-before-coerce shape is used here:
   validate the raw string first, only then turn it into a number. */
const DIGITS_RE = /^\d+$/;
const MAX_M2 = 2_147_483_647;
/** Not a database limit — the UI's own stepper stops at 99 (SignupFlow's
    `+`/`-` buttons). A raw POST could still claim more, so this is a sane
    ceiling on how many `locations` rows one signup may create in a single
    request, independent of whatever the client happened to render. */
const MAX_LOCATIONS = 500;

function parsePositiveInt(raw: string, max: number): number | null {
  const trimmed = raw.trim();
  if (!DIGITS_RE.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 && n <= max ? n : null;
}

/** Builds a validated signup from raw form input. Pure and synchronous —
    no plan price is ever read here, because none is ever trusted from the
    form in the first place: only a `PlanId` is validated, never a monthly
    figure. */
export function buildSignup(formData: FormData): BuildSignupResult {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: FieldErrors = {};

  const name = get("name");
  const company = get("company");
  const email = get("email");
  /* SignupFlow.tsx submits the field as "planId"; this module's own test
     fixture (and, in principle, any other caller) spells it "plan". Both
     are accepted rather than betting the whole form on one caller's naming
     and quietly failing the other's. */
  const planRaw = get("planId") || get("plan");
  const billingRaw = get("billing");
  const venueTypeRaw = get("venueType");

  if (!name) errors.name = "required";
  if (!company) errors.company = "required";
  if (!EMAIL_RE.test(email)) errors.email = "email";
  if (!PLAN_IDS.has(planRaw)) errors.plan = "required";
  if (!VENUE_TYPE_IDS.has(venueTypeRaw)) errors.venueType = "required";
  if (billingRaw && !BILLING_TERMS.has(billingRaw)) errors.billing = "required";

  const m2 = parsePositiveInt(get("m2"), MAX_M2);
  if (m2 === null) errors.m2 = "required";

  /* "clamps locations to at least 1" per the brief: a blank, zero or
     unparsable value is not an error on this field, it is simply one
     location — the calculator's own default. Only a value that parses but
     is absurdly large is rejected outright (see MAX_LOCATIONS above). */
  const locationsField = get("locations");
  const parsedLocations = locationsField ? Number(locationsField) : 1;
  if (Number.isFinite(parsedLocations) && parsedLocations > MAX_LOCATIONS) {
    errors.locations = "required";
  }
  const locationCount = Math.max(
    1,
    Math.min(MAX_LOCATIONS, Math.round(Number.isFinite(parsedLocations) ? parsedLocations : 1)),
  );

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
      customer: { name: company, email, contactName: name },
      planId: planRaw as PlanId,
      billing,
      locations,
    },
  };
}
