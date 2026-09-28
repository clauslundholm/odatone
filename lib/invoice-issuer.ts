/**
 * Odatone's own legal details, as they must appear on a Danish invoice.
 *
 * THESE ARE PLACEHOLDERS. A generated invoice is NOT a legally valid Danish
 * invoice until every value below is replaced with Odatone's real
 * registration. A Danish invoice must carry the seller's name, address, CVR
 * number and payment details; an invoice missing them is not deductible for
 * the customer, which is the first thing their bookkeeper will notice.
 *
 * Deliberately a module rather than environment variables: these change
 * roughly never, they are not secret, and having them in git means a change
 * is reviewable and dated.
 */
export const ISSUER = Object.freeze({
  legalName: "PLACEHOLDER — Odatone ApS",
  cvr: "PLACEHOLDER — 00000000",
  address: "PLACEHOLDER — Gadenavn 1",
  postcode: "PLACEHOLDER — 0000",
  city: "PLACEHOLDER — By",
  country: "Danmark",
  email: "PLACEHOLDER — faktura@odatone.dk",
  bankName: "PLACEHOLDER — Bank",
  bankReg: "PLACEHOLDER — 0000",
  bankAccount: "PLACEHOLDER — 0000000000",
  iban: "PLACEHOLDER — DK0000000000000000",
  swift: "PLACEHOLDER — XXXXDKKK",
  /** Days from issue to due, used as the default in the issue dialog. */
  paymentTermsDays: 14,
});

/** True when the placeholders are still in place. The admin issue dialog
    warns on this rather than silently producing an unusable document. */
export const ISSUER_IS_PLACEHOLDER = Object.values(ISSUER).some(
  (v) => typeof v === "string" && v.startsWith("PLACEHOLDER"),
);
