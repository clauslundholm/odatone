import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { parseAppSignup, APP_SIGNUP_FIELDS, MAX_BODY_CHARS } from "../lib/app-signup.ts";

const BODY = {
  name: "Jens Hansen",
  company: "Café Nord",
  email: "jens@nord.test",
  cvr: "12345678",
  phone: "+45 12 34 56 78",
  address: "Nørregade 1",
  postcode: "8000",
  city: "Aarhus",
  planId: "small",
  billing: "annual",
  locations: 3,
};

test("maps every field onto the names submitSignup reads", () => {
  const fd = parseAppSignup(JSON.stringify(BODY));
  assert.ok(fd);
  assert.equal(fd.get("name"), "Jens Hansen");
  assert.equal(fd.get("company"), "Café Nord");
  assert.equal(fd.get("email"), "jens@nord.test");
  assert.equal(fd.get("cvr"), "12345678");
  assert.equal(fd.get("phone"), "+45 12 34 56 78");
  assert.equal(fd.get("address"), "Nørregade 1");
  assert.equal(fd.get("postcode"), "8000");
  assert.equal(fd.get("city"), "Aarhus");
  assert.equal(fd.get("planId"), "small");
  assert.equal(fd.get("billing"), "annual");
});

test("sends a numeric location count as a digit string", () => {
  const fd = parseAppSignup(JSON.stringify(BODY));
  assert.equal(fd?.get("locations"), "3");
});

test("passes a fractional count through unrounded, for the server to reject", () => {
  const fd = parseAppSignup(JSON.stringify({ ...BODY, locations: 3.7 }));
  assert.equal(fd?.get("locations"), "3.7");
});

test("payment details a client sends never reach the FormData", () => {
  /* The app collects none, and the web form's own payment fields are gone
     from buildSignup, so nothing here may be forwarded on a client's say-so. */
  const fd = parseAppSignup(
    JSON.stringify({
      ...BODY,
      paymentMethod: "card",
      ean: "5790000000000",
      po: "PO-7",
      card: "4111111111111111",
      expiry: "12/30",
      cvc: "123",
    }),
  );
  assert.ok(fd);
  for (const key of ["paymentMethod", "ean", "po", "card", "expiry", "cvc"]) {
    assert.equal(fd.has(key), false, key);
  }
});

test("the allowlist is exactly the set of fields buildSignup reads", () => {
  /* Read as text on purpose: if the website starts requiring a new field,
     this fails here instead of the app getting a generic server error for
     a field it has no way to send. "plan" is buildSignup's alias for
     "planId", not a second field. */
  const source = readFileSync(new URL("../lib/signup.ts", import.meta.url), "utf8");
  const read = new Set(
    [...source.matchAll(/\bget\("([^"]+)"\)/g)].map((m) => m[1]).filter((key) => key !== "plan"),
  );
  assert.deepEqual([...APP_SIGNUP_FIELDS].sort(), [...read].sort());
});

test("drops keys it does not know, and keys that are not text or numbers", () => {
  const fd = parseAppSignup(
    JSON.stringify({ ...BODY, role: "staff_admin", card: "4111", name: { $ne: "" }, city: null }),
  );
  assert.ok(fd);
  assert.equal(fd.has("role"), false);
  assert.equal(fd.has("card"), false);
  assert.equal(fd.has("name"), false);
  assert.equal(fd.has("city"), false);
});

test("leaves a missing field missing, so the server reports it as required", () => {
  const { email: _email, ...rest } = BODY;
  const fd = parseAppSignup(JSON.stringify(rest));
  assert.equal(fd?.has("email"), false);
});

test("refuses anything that is not a JSON object", () => {
  assert.equal(parseAppSignup(""), null);
  assert.equal(parseAppSignup("not json"), null);
  assert.equal(parseAppSignup("null"), null);
  assert.equal(parseAppSignup("[1,2]"), null);
  assert.equal(parseAppSignup('"text"'), null);
  assert.equal(parseAppSignup("42"), null);
});

test("refuses an oversized body before parsing it", () => {
  const big = JSON.stringify({ ...BODY, name: "x".repeat(MAX_BODY_CHARS) });
  assert.equal(parseAppSignup(big), null);
});
