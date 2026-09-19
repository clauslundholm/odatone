import { test } from "node:test";
import assert from "node:assert/strict";

import { anonymisedCustomer, CUSTOMER_PII_COLUMNS } from "../lib/gdpr.ts";

test("every identifying field is replaced", () => {
  const t = anonymisedCustomer("abc123");
  for (const field of ["name", "billing_email", "address", "postcode", "city", "cvr"]) {
    assert.ok(field in t, `${field} must be overwritten`);
    assert.ok(!String(t[field]).includes("@example"), "no original value survives");
  }
});

test("the tombstone is stable and traceable to the record", () => {
  assert.deepEqual(anonymisedCustomer("abc123"), anonymisedCustomer("abc123"));
  assert.ok(anonymisedCustomer("abc123").name.includes("abc123"));
});

test("the email stays syntactically valid so constraints still hold", () => {
  assert.match(anonymisedCustomer("abc123").billing_email, /^[^@]+@[^@]+\.[a-z]+$/);
});

test("two erased customers do not collide on the unique lower(billing_email) index", () => {
  // 0008_customer_email_lower_column.sql adds a unique index on
  // billing_email_lower (generated from lower(billing_email)). Each
  // tombstone's email embeds the id it was made for, so two different
  // customers can never land on the same erased address.
  const a = anonymisedCustomer("customer-one");
  const b = anonymisedCustomer("customer-two");
  assert.notEqual(a.billing_email.toLowerCase(), b.billing_email.toLowerCase());
});

test("the tombstone covers every PII-bearing column on customers, no more and no fewer", () => {
  // Fix round 1's Critical: `phone` (0005_customer_phone.sql) was added to
  // `customers` after this file's field list was first written, and
  // anonymisedCustomer never learned about it -- an erased customer kept a
  // working direct-contact number. `field in t` checks alone don't catch a
  // column missing from the tombstone entirely (there is nothing to
  // iterate that isn't already there), so this compares the tombstone's
  // actual keys against CUSTOMER_PII_COLUMNS (lib/gdpr.ts) -- a list
  // deliberately maintained independently of anonymisedCustomer's own
  // implementation. The next migration that adds a personal-data column to
  // `customers` must update both, or this fails instead of shipping the
  // same gap again.
  const keys = Object.keys(anonymisedCustomer("abc123")).sort();
  assert.deepEqual(keys, [...CUSTOMER_PII_COLUMNS].sort());
});

test("every PII-bearing field is actually blanked, not merely present", () => {
  // Fix round 1's reviewer mutation-tested the original four tests and
  // found a tombstone that returned the customer's real cvr/address/
  // postcode/city verbatim still passed all of them -- "no original value
  // survives" was only ever checked against the literal substring
  // "@example", which nothing but a stray test fixture's email would ever
  // contain. This asserts the actual value each blanked field must have,
  // rather than a substring that happens not to appear in a leak.
  const t = anonymisedCustomer("abc123");
  for (const field of ["cvr", "address", "postcode", "city", "phone"]) {
    assert.equal(t[field], "", `${field} must be blanked, not carried over`);
  }
});
