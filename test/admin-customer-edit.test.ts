import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CUSTOMER_STATUSES,
  canHardDelete,
  parseCustomerForm,
} from "../app/admin/customers/[id]/validate.ts";

const GOOD = {
  name: "Café Nordlys ApS",
  cvr: "12345678",
  billing_email: "faktura@nordlys.dk",
  phone: "+45 70 60 50 40",
  address: "Havnegade 12",
  postcode: "1058",
  city: "København K",
  country: "DK",
  status: "active",
};

/* -------------------------------------------------------------------- *
 *  The happy path
 * -------------------------------------------------------------------- */

test("a complete Danish customer parses", () => {
  const r = parseCustomerForm(GOOD);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value, { ...GOOD });
});

test("whitespace is trimmed off every field", () => {
  const r = parseCustomerForm({ ...GOOD, name: "  Café Nordlys ApS  ", city: " København K " });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.name, "Café Nordlys ApS");
  assert.equal(r.value.city, "København K");
});

test("the optional fields come back null when blank, not as empty strings", () => {
  /* The columns are nullable and a blank form field means "not known".
     Writing "" instead would make `address is null` stop finding them
     and put an empty line in an invoice address block. */
  const r = parseCustomerForm({ ...GOOD, cvr: "", phone: "", address: "", postcode: "", city: "" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.cvr, null);
  assert.equal(r.value.phone, null);
  assert.equal(r.value.address, null);
  assert.equal(r.value.postcode, null);
  assert.equal(r.value.city, null);
});

/* -------------------------------------------------------------------- *
 *  Name and email
 * -------------------------------------------------------------------- */

test("a name is required", () => {
  for (const name of ["", "   "]) {
    const r = parseCustomerForm({ ...GOOD, name });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "name");
  }
});

test("a billing email is required and must look like one", () => {
  for (const billing_email of ["", "   ", "nope", "a@b", "two@@at.dk", "spaces @nordlys.dk"]) {
    const r = parseCustomerForm({ ...GOOD, billing_email });
    assert.equal(r.ok, false, `expected ${JSON.stringify(billing_email)} to be refused`);
    if (!r.ok) assert.equal(r.error, "billing_email");
  }
});

test("the billing email is lowercased, because the unique index is", () => {
  /* `unique (lower(billing_email))` — storing Faktura@… and faktura@…
     as different strings would let two rows look distinct here and
     collide in Postgres. */
  const r = parseCustomerForm({ ...GOOD, billing_email: "Faktura@Nordlys.DK" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.billing_email, "faktura@nordlys.dk");
});

/* -------------------------------------------------------------------- *
 *  CVR and postcode — Danish rules, applied only to Danish customers
 * -------------------------------------------------------------------- */

test("a Danish CVR is eight digits, however it was typed", () => {
  for (const cvr of ["12345678", "12 34 56 78", "12.34.56.78"]) {
    const r = parseCustomerForm({ ...GOOD, cvr });
    assert.equal(r.ok, true, `expected ${cvr} to be accepted`);
    if (r.ok) assert.equal(r.value.cvr, "12345678");
  }
});

test("a Danish CVR that is not eight digits is refused", () => {
  for (const cvr of ["1234567", "123456789", "DK12345678", "abcdefgh"]) {
    const r = parseCustomerForm({ ...GOOD, cvr });
    assert.equal(r.ok, false, `expected ${cvr} to be refused`);
    if (!r.ok) assert.equal(r.error, "cvr");
  }
});

test("a foreign company keeps its own VAT format", () => {
  /* Eight digits is a Danish rule. A German customer's USt-IdNr. is not
     eight digits and refusing it would make the row uneditable. */
  const r = parseCustomerForm({ ...GOOD, country: "DE", cvr: "DE123456789", postcode: "10115" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.cvr, "DE123456789");
});

test("a Danish postcode is four digits", () => {
  assert.equal(parseCustomerForm({ ...GOOD, postcode: "1058" }).ok, true);
  for (const postcode of ["105", "10588", "DK-1058"]) {
    const r = parseCustomerForm({ ...GOOD, postcode });
    assert.equal(r.ok, false, `expected ${postcode} to be refused`);
    if (!r.ok) assert.equal(r.error, "postcode");
  }
});

/* -------------------------------------------------------------------- *
 *  Country and status
 * -------------------------------------------------------------------- */

test("country is two letters, upper-cased", () => {
  const r = parseCustomerForm({ ...GOOD, country: "de" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.country, "DE");
  for (const country of ["", "D", "DEU", "12"]) {
    assert.equal(parseCustomerForm({ ...GOOD, country }).ok, false);
  }
});

test("status must be one the enum actually has", () => {
  for (const status of CUSTOMER_STATUSES) {
    assert.equal(parseCustomerForm({ ...GOOD, status }).ok, true, status);
  }
  for (const status of ["", "deleted", "ACTIVE", "'; drop table customers; --"]) {
    const r = parseCustomerForm({ ...GOOD, status });
    assert.equal(r.ok, false, `expected ${status} to be refused`);
    if (!r.ok) assert.equal(r.error, "status");
  }
});

test("the statuses match the customer_status enum in 0001_core.sql", () => {
  assert.deepEqual([...CUSTOMER_STATUSES], ["pending", "active", "suspended", "cancelled"]);
});

/* -------------------------------------------------------------------- *
 *  Deleting
 * -------------------------------------------------------------------- */

test("a customer with no invoices can be deleted outright", () => {
  assert.deepEqual(canHardDelete({ invoices: 0 }), { ok: true });
});

test("a customer with invoices cannot — the books have to survive", () => {
  /* Every foreign key into customers is `on delete cascade`, invoices
     included, so Postgres will happily take the accounts with it. Danish
     bookkeeping law wants five years of them. This is the only thing
     standing in the way. */
  assert.deepEqual(canHardDelete({ invoices: 1 }), { ok: false, reason: "invoices", invoices: 1 });
  assert.deepEqual(canHardDelete({ invoices: 42 }), { ok: false, reason: "invoices", invoices: 42 });
});

test("a phone number keeps whatever shape it was given", () => {
  /* A switchboard, an extension, a mobile, a foreign number: refusing
     any of these costs the operator an edit and buys nothing. */
  for (const phone of ["+45 70 60 50 40", "7060 5040", "+44 20 7946 0000 ext 12"]) {
    const r = parseCustomerForm({ ...GOOD, phone });
    assert.equal(r.ok, true, phone);
    if (r.ok) assert.equal(r.value.phone, phone);
  }
});
