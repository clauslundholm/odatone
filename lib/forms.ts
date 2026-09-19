/** Shared form shapes. Kept out of app/actions.ts, where "use server"
 *  only permits async function exports. */

export type FieldErrors = Record<string, string>;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; errors: FieldErrors };

export type SalesLead = {
  name: string;
  company: string;
  email: string;
  phone: string;
  locations: string;
  message: string;
};

export type SignupSubmission = {
  name: string;
  company: string;
  cvr: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  planId: string;
  billing: string;
  locations: number;
  venueType: string;
  m2: number;
  paymentMethod: "card" | "invoice";
};

/* Excludes `*` as well as whitespace and `@`, on top of the already-narrow
   shape. Defence in depth, not the primary fix: fix round 4 found that
   PostgREST rewrites a literal `*` in a `like`/`ilike` filter's pattern to
   `%` before Postgres ever sees it — a rewrite no amount of escaping on
   this app's side can reach — so a signup for "*@*.test" turned
   app/actions.ts's case-insensitive customer lookup into a query matching
   every row in the table. The real fix (lib/signup.ts, app/actions.ts,
   0008_customer_email_lower_column.sql) is to never go through `like`/
   `ilike` for that lookup at all; this regex closing the same door here
   too means a `*` never reaches that code path in the first place, even if
   some future caller reintroduced a wildcard-based lookup by accident. */
export const EMAIL_RE = /^[^\s@*]+@[^\s@*]+\.[^\s@*]{2,}$/;

export function digits(value: string): string {
  return value.replace(/\D/g, "");
}
