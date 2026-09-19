/* Erasure anonymises rather than deletes. Danish bookkeeping law requires
   accounting records be kept five years, and an invoice with no customer is
   not a record of anything. The tombstone keeps the invoice attributable to a
   case without naming a person. Confirm with whoever owns compliance before
   launch — this is the reading the spec adopts, not settled advice. */

/**
 * The columns on `customers` that hold personal data about the business or
 * the person behind it, gathered against the migration that added each one:
 *   0001_core.sql          -- name, cvr, billing_email, address, postcode, city
 *   0005_customer_phone.sql -- phone
 *
 * Deliberately excludes `id` (needed to keep an erased row traceable to
 * itself), `country` (every row today is 'DK', and even a real value only
 * ever names a jurisdiction, never a person), `status`/`created_at`/
 * `updated_at` (operational, not personal), and the generated
 * `billing_email_lower` (0008_customer_email_lower_column.sql — derived
 * automatically from `billing_email` and never itself written, so
 * tombstoning `billing_email` already tombstones it).
 *
 * Kept as an independent, hand-maintained list rather than only implied by
 * `anonymisedCustomer`'s own keys below, so `test/gdpr.test.ts` can hold
 * the two accountable to each other: this is exactly the gap that let
 * `phone` (0005_customer_phone.sql, added after this file's field list
 * was first written) leave a working direct-contact number behind on
 * every erased customer until this list — and the test comparing it
 * against `anonymisedCustomer`'s actual keys — existed. The next migration
 * that adds a personal-data column to `customers` must update both this
 * list and the tombstone below, or the test fails instead of a real
 * customer's data quietly surviving its own erasure.
 */
export const CUSTOMER_PII_COLUMNS = [
  "name",
  "billing_email",
  "cvr",
  "address",
  "postcode",
  "city",
  "phone",
] as const;

export function anonymisedCustomer(id: string): Record<string, string> {
  return {
    name: `Slettet kunde ${id}`,
    billing_email: `erased+${id}@odatone.invalid`,
    cvr: "",
    address: "",
    postcode: "",
    city: "",
    phone: "",
  };
}
