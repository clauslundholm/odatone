import { test } from "node:test";
import assert from "node:assert/strict";

import { anonymisedCustomer } from "../lib/gdpr.ts";

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
