/* Pure parsing and validation for the customer editor, kept apart from
   actions.ts for the same reason app/admin/products/validate.ts is: that
   file imports "use server" and lib/supabase/server.ts, neither of which
   resolves under plain `node --test`, so none of this logic could be
   unit tested through it. */

/* Relative, with the extension, rather than the "@/lib/forms" alias every
   other file here uses: `node --test` strips types instead of bundling and
   resolves neither the alias nor an extensionless path, and this module
   exists to be unit tested. Same reason lib/tracks.ts names its catalogue
   import in full. */
import { EMAIL_RE, digits } from "../../../../lib/forms.ts";

/** `customer_status`, verbatim from 0001_core.sql. Postgres refuses
    anything else with `22P02 invalid input value for enum`, which reaches
    the operator as a generic save failure — so the value is checked here
    where the message can name the field. */
export const CUSTOMER_STATUSES = ["pending", "active", "suspended", "cancelled"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** What an edit writes. Nullable columns carry `null`, never `""` — a
    blank field means "not known", and an empty string would both defeat
    `address is null` and print a blank line into an invoice address. */
export type CustomerPatch = {
  name: string;
  cvr: string | null;
  billing_email: string;
  /** Free text on purpose. Signup collects it (0005_customer_phone.sql)
      and the page already showed it, but a business number can be
      "+45 70 60 50 40", "7060 5040" or a switchboard with an extension,
      and refusing any of those helps nobody. Only the length is capped. */
  phone: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country: string;
  status: CustomerStatus;
};

export type ParseResult =
  | { ok: true; value: CustomerPatch }
  | { ok: false; error: keyof CustomerPatch };

/** Generous, because these are company names and street addresses in a
    `text` column; the cap exists to stop a crafted POST writing a novel,
    not to police the operator. */
const MAX = 200;

const clean = (raw: string | undefined) => (raw ?? "").trim().slice(0, MAX);
const orNull = (value: string) => (value.length ? value : null);

export function parseCustomerForm(raw: Record<string, string | undefined>): ParseResult {
  const name = clean(raw.name);
  if (!name) return { ok: false, error: "name" };

  /* Lower-cased because the uniqueness constraint is
     `unique (lower(billing_email))`: stored with different casing, two
     rows look distinct to us and collide in Postgres. */
  const billing_email = clean(raw.billing_email).toLowerCase();
  if (!EMAIL_RE.test(billing_email)) return { ok: false, error: "billing_email" };

  const country = clean(raw.country).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, error: "country" };
  const danish = country === "DK";

  /* Eight digits is a DANISH rule, so it is only applied to Danish
     companies. A German customer's USt-IdNr. is not eight digits, and
     enforcing the Danish shape on it would leave the row uneditable —
     the operator could not even fix the name without first inventing a
     CVR. Punctuation is stripped on the way in because people type
     "12 34 56 78" off a letterhead. */
  const cvrRaw = clean(raw.cvr);
  let cvr: string | null = orNull(cvrRaw);
  if (cvr && danish) {
    const only = digits(cvr);
    if (only.length !== 8 || digits(cvr.replace(/[\s.]/g, "")) !== cvr.replace(/[\s.]/g, "")) {
      return { ok: false, error: "cvr" };
    }
    cvr = only;
  }

  const postcodeRaw = clean(raw.postcode);
  const postcode = orNull(postcodeRaw);
  if (postcode && danish && !/^\d{4}$/.test(postcode)) return { ok: false, error: "postcode" };

  const status = clean(raw.status);
  if (!(CUSTOMER_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "status" };
  }

  return {
    ok: true,
    value: {
      name,
      cvr,
      billing_email,
      phone: orNull(clean(raw.phone)),
      address: orNull(clean(raw.address)),
      postcode,
      city: orNull(clean(raw.city)),
      country,
      status: status as CustomerStatus,
    },
  };
}

export type DeleteVerdict =
  | { ok: true }
  | { ok: false; reason: "invoices"; invoices: number };

/**
 * Whether a customer may be removed outright rather than erased.
 *
 * Every foreign key into `customers` is `on delete cascade` — locations,
 * profiles, subscriptions, playlists, schedule_blocks AND invoices
 * (0002_commerce.sql:70). So the database will take the accounts with
 * the customer without a word of complaint, and Danish bookkeeping law
 * wants five years of them. This check is the only thing in the way.
 *
 * A customer with no invoices is a different animal: a signup that never
 * completed, a duplicate, a test row. Nothing is owed to anyone and
 * tidying it away is the honest outcome.
 *
 * When there ARE invoices the answer is not "no" but "erase instead" —
 * `eraseCustomer` (./gdpr-actions.ts) anonymises the person and keeps the
 * books, which is what the GDPR asks for anyway.
 */
export function canHardDelete({ invoices }: { invoices: number }): DeleteVerdict {
  if (invoices > 0) return { ok: false, reason: "invoices", invoices };
  return { ok: true };
}
