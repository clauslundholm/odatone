/* The signup form's rules, pure so they run under `node --test`. The
   server (lib/signup.ts's buildSignup) is the judge that counts; these
   are the same rules applied early, so a customer hears about a missing
   field on the step that has it rather than after pressing the last
   button. Keep the limits in step with buildSignup. */

import { isEmail, normalizeEmail } from "./errors.ts";

export type SignupDraft = {
  planId: string;
  billing: "monthly" | "annual";
  locations: number;
  name: string;
  company: string;
  cvr: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  city: string;
  terms: boolean;
};

export const EMPTY_DRAFT: SignupDraft = {
  planId: "small",
  billing: "monthly",
  locations: 1,
  name: "",
  company: "",
  cvr: "",
  email: "",
  phone: "",
  address: "",
  postcode: "",
  city: "",
  terms: false,
};

export type FieldErrors = Record<string, string>;

/** The stepper's own range, the same as the website's. */
export const MIN_LOCATIONS = 1;
export const MAX_LOCATIONS = 99;

/* buildSignup's caps (lib/signup.ts). */
const MAX_TEXT = 200;
const MAX_EMAIL = 254;
const MAX_OPTIONAL = 300;

/* lib/signup.ts's parseCvr, copied: the app cannot import that file's
   module graph under `node --test`, and the rule is small. A Danish CVR is
   eight digits, written with a "DK" prefix, spaces, dots or dashes by
   different people; what is sent is always the bare eight. Null for blank
   too — the caller tells "required" from "cvr" by whether anything was
   typed. Keep in step with parseCvr. */
export function parseCvr(raw: string): string | null {
  const cleaned = raw.trim().replace(/^DK/i, "").replace(/[\s.\-]/g, "");
  return /^\d{8}$/.test(cleaned) ? cleaned : null;
}

function required(value: string, max: number): string | null {
  const v = value.trim();
  if (!v) return "required";
  return v.length > max ? "long" : null;
}

export function validatePlan(d: SignupDraft): FieldErrors {
  const e: FieldErrors = {};
  if (!d.planId) e.plan = "required";
  if (!Number.isInteger(d.locations) || d.locations < MIN_LOCATIONS || d.locations > MAX_LOCATIONS) {
    e.locations = "required";
  }
  return e;
}

/** The account step: who is signing up, where invoices go, and the terms
    acceptance that sits under the submit button. */
export function validateAccount(d: SignupDraft): FieldErrors {
  const e: FieldErrors = {};
  const put = (field: string, code: string | null) => {
    if (code) e[field] = code;
  };

  put("name", required(d.name, MAX_TEXT));
  put("company", required(d.company, MAX_TEXT));
  /* Required by the server since the website's signup was rebuilt: an
     invoice names the customer's company registration. */
  if (!d.cvr.trim()) e.cvr = "required";
  else if (parseCvr(d.cvr) === null) e.cvr = "cvr";

  const email = normalizeEmail(d.email);
  if (email.length > MAX_EMAIL) e.email = "long";
  else if (!isEmail(email)) e.email = "email";

  if (d.phone.trim().length > MAX_OPTIONAL) e.phone = "long";
  /* Optional on the server, required by the website's own form — an
     invoice needs somewhere to be addressed to. */
  put("address", required(d.address, MAX_OPTIONAL));
  put("postcode", required(d.postcode, MAX_OPTIONAL));
  put("city", required(d.city, MAX_OPTIONAL));
  /* The last thing the customer does before pressing the button, and the
     app collects no payment details, so there is no step of its own for it. */
  if (!d.terms) e.terms = "terms";
  return e;
}

/** The body of POST /api/app/signup. `terms` is not sent: it is a
    promise the customer makes on this screen, not a field the server
    stores. */
export function toPayload(d: SignupDraft): Record<string, string | number> {
  return {
    name: d.name.trim(),
    company: d.company.trim(),
    email: normalizeEmail(d.email),
    cvr: parseCvr(d.cvr) ?? "",
    phone: d.phone.trim(),
    address: d.address.trim(),
    postcode: d.postcode.trim(),
    city: d.city.trim(),
    planId: d.planId,
    billing: d.billing,
    locations: d.locations,
  };
}

/** Which step shows which field's error. `plan` is the key buildSignup
    uses for the plan; `form` is a message about the whole order. */
const STEP_FIELDS: readonly (readonly string[])[] = [
  ["plan", "billing", "locations"],
  ["name", "company", "cvr", "email", "phone", "address", "postcode", "city", "terms", "form"],
];
const KNOWN_FIELDS = new Set(STEP_FIELDS.flat());

/** The server can name a field this screen does not have — `venueType`
    and `m2` from a website that has not yet deployed its simpler signup,
    `ean` or `po` from one older still, or whatever a later version
    adds. An error nobody can see is a form that silently does nothing,
    so those collapse into one generic message. */
export function visibleErrors(errors: FieldErrors): FieldErrors {
  const shown: FieldErrors = {};
  let unknown = false;
  for (const [field, code] of Object.entries(errors)) {
    if (KNOWN_FIELDS.has(field)) shown[field] = code;
    else unknown = true;
  }
  if (unknown && !shown.form) shown.form = "server";
  return shown;
}

/** The earliest step with something to fix; the last step if the only
    news is about the order as a whole. */
export function stepForErrors(errors: FieldErrors): number {
  const at = STEP_FIELDS.findIndex((fields) => fields.some((f) => f in errors));
  return at === -1 ? STEP_FIELDS.length - 1 : at;
}

export type ErrorKey =
  | "required"
  | "long"
  | "email"
  | "cvr"
  | "terms"
  | "exists"
  | "server"
  | "plan"
  | "locations";

const CODES: readonly string[] = ["required", "long", "email", "cvr", "terms", "exists", "server"];

/** Which sentence to show. The plan and the location count have no text
    field, so "Required" under them would make no sense — they get their
    own wording. A code this build has never heard of gets the generic
    one, never the raw word. */
export function errorKey(field: string, code: string): ErrorKey {
  if (field === "plan") return "plan";
  if (field === "locations") return "locations";
  return CODES.includes(code) ? (code as ErrorKey) : "server";
}
