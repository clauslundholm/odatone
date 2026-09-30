import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_DRAFT,
  errorKey,
  stepForErrors,
  toPayload,
  validateAccount,
  validatePayment,
  validatePlan,
  visibleErrors,
  type SignupDraft,
} from "../src/auth/signup-form.ts";

const VALID: SignupDraft = {
  ...EMPTY_DRAFT,
  name: "Jens Hansen",
  company: "Café Nord",
  email: "jens@nord.test",
  address: "Nørregade 1",
  postcode: "8000",
  city: "Aarhus",
  terms: true,
};

test("an empty account step names every required field", () => {
  assert.deepEqual(validateAccount(EMPTY_DRAFT), {
    name: "required",
    company: "required",
    email: "email",
    address: "required",
    postcode: "required",
    city: "required",
  });
});

test("a complete account step has no errors, with the optional fields blank", () => {
  assert.deepEqual(validateAccount(VALID), {});
});

test("a CVR is optional, but if given it is 8 digits however it is typed", () => {
  assert.deepEqual(validateAccount({ ...VALID, cvr: "12 34 56 78" }), {});
  assert.deepEqual(validateAccount({ ...VALID, cvr: "DK12345678" }), {});
  assert.deepEqual(validateAccount({ ...VALID, cvr: "1234567" }), { cvr: "cvr" });
});

test("an email is judged after trimming and lower-casing", () => {
  assert.deepEqual(validateAccount({ ...VALID, email: "  Jens@Nord.Test " }), {});
  assert.deepEqual(validateAccount({ ...VALID, email: "jens@nord" }), { email: "email" });
  assert.deepEqual(validateAccount({ ...VALID, email: "jens nord@x.test" }), { email: "email" });
  assert.deepEqual(validateAccount({ ...VALID, email: "*@*.test" }), { email: "email" });
});

test("the server's length caps are applied before sending", () => {
  assert.deepEqual(validateAccount({ ...VALID, name: "x".repeat(201) }), { name: "long" });
  assert.deepEqual(validateAccount({ ...VALID, company: "x".repeat(201) }), { company: "long" });
  assert.deepEqual(validateAccount({ ...VALID, email: `${"x".repeat(250)}@a.dk` }), { email: "long" });
  assert.deepEqual(validateAccount({ ...VALID, phone: "1".repeat(301) }), { phone: "long" });
  assert.deepEqual(validateAccount({ ...VALID, address: "x".repeat(301) }), { address: "long" });
});

test("the plan step wants a plan and a whole number of locations from 1 to 99", () => {
  assert.deepEqual(validatePlan(VALID), {});
  assert.deepEqual(validatePlan({ ...VALID, planId: "" }), { plan: "required" });
  for (const locations of [0, 100, 2.5, Number.NaN]) {
    assert.deepEqual(validatePlan({ ...VALID, locations }), { locations: "required" }, String(locations));
  }
  assert.deepEqual(validatePlan({ ...VALID, locations: 99 }), {});
});

test("the payment step wants the terms accepted and, if given, a 13-digit EAN", () => {
  assert.deepEqual(validatePayment(VALID), {});
  assert.deepEqual(validatePayment({ ...VALID, terms: false }), { terms: "terms" });
  assert.deepEqual(validatePayment({ ...VALID, ean: "5790 0000 0000 0" }), {});
  assert.deepEqual(validatePayment({ ...VALID, ean: "12345" }), { ean: "ean" });
});

test("the payload is trimmed, the email normalised, and the numbers reduced to digits", () => {
  const payload = toPayload({
    ...VALID,
    name: "  Jens Hansen ",
    email: " Jens@Nord.Test ",
    cvr: "DK 12 34 56 78",
    ean: "5790 0000 0000 0",
    billing: "annual",
    locations: 3,
    planId: "medium",
  });
  assert.deepEqual(payload, {
    name: "Jens Hansen",
    company: "Café Nord",
    email: "jens@nord.test",
    cvr: "12345678",
    phone: "",
    address: "Nørregade 1",
    postcode: "8000",
    city: "Aarhus",
    planId: "medium",
    billing: "annual",
    locations: 3,
    ean: "5790000000000",
    po: "",
  });
  assert.equal("terms" in payload, false);
});

test("a server error sends the customer to the earliest step that owns a field in it", () => {
  assert.equal(stepForErrors({ plan: "required" }), 0);
  assert.equal(stepForErrors({ locations: "required", email: "exists" }), 0);
  assert.equal(stepForErrors({ email: "exists" }), 1);
  assert.equal(stepForErrors({ postcode: "long", form: "server" }), 1);
  assert.equal(stepForErrors({ form: "server" }), 2);
});

test("error keys the app has no field for become the generic server message on the last step", () => {
  const shown = visibleErrors({ venueType: "required", m2: "required" });
  assert.deepEqual(shown, { form: "server" });
  assert.equal(stepForErrors(shown), 2);
});

test("a known field error survives next to an unknown one, and an existing form error is kept", () => {
  assert.deepEqual(visibleErrors({ email: "exists", venueType: "required" }), { email: "exists", form: "server" });
  assert.deepEqual(visibleErrors({ form: "invalid", mystery: "x" }), { form: "invalid" });
  assert.deepEqual(visibleErrors({ name: "required" }), { name: "required" });
});

test("every error resolves to a message the app has, never a raw code", () => {
  assert.equal(errorKey("name", "required"), "required");
  assert.equal(errorKey("email", "exists"), "exists");
  assert.equal(errorKey("plan", "required"), "plan");
  assert.equal(errorKey("locations", "required"), "locations");
  assert.equal(errorKey("form", "server"), "server");
  assert.equal(errorKey("form", "invalid"), "server");
  assert.equal(errorKey("name", "something-new"), "server");
});
