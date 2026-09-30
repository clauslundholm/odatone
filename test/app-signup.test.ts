import { test } from "node:test";
import assert from "node:assert/strict";

import { parseAppSignup, MAX_BODY_CHARS } from "../lib/app-signup.ts";

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
  ean: "5790000000000",
  po: "PO-7",
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
  assert.equal(fd.get("ean"), "5790000000000");
  assert.equal(fd.get("po"), "PO-7");
});

test("sends a numeric location count as a digit string", () => {
  const fd = parseAppSignup(JSON.stringify(BODY));
  assert.equal(fd?.get("locations"), "3");
});

test("passes a fractional count through unrounded, for the server to reject", () => {
  const fd = parseAppSignup(JSON.stringify({ ...BODY, locations: 3.7 }));
  assert.equal(fd?.get("locations"), "3.7");
});

test("always pays by invoice, whatever the client claims", () => {
  const fd = parseAppSignup(JSON.stringify({ ...BODY, paymentMethod: "card" }));
  assert.equal(fd?.get("paymentMethod"), "invoice");
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
