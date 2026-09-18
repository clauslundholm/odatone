import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSignup } from "../lib/signup.ts";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const VALID = {
  name: "Jens Hansen", company: "Café Nord", email: "jens@nord.test",
  plan: "small", billing: "monthly", locations: "1", m2: "80", venueType: "cafe",
};

test("accepts a complete signup", () => {
  const r = buildSignup(form(VALID));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.customer.name, "Café Nord");
    assert.equal(r.value.locations.length, 1);
    assert.equal(r.value.locations[0].m2, 80);
  }
});

test("rejects a bad email", () => {
  const r = buildSignup(form({ ...VALID, email: "not-an-email" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.email, "email");
});

test("rejects an unknown plan rather than trusting the form", () => {
  const r = buildSignup(form({ ...VALID, plan: "enterprise" }));
  assert.equal(r.ok, false);
});

test("creates one location per location claimed", () => {
  const r = buildSignup(form({ ...VALID, locations: "3" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.locations.length, 3);
});

test("never trusts a price from the form", () => {
  const r = buildSignup(form({ ...VALID, monthly: "1" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal("monthly" in r.value.customer, false);
});
