import { test } from "node:test";
import assert from "node:assert/strict";

import { buildStaffInvite, STAFF_ROLES } from "../lib/staff-invite.ts";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = { email: "nynne@odatone.dk", fullName: "Nynne Dahl", role: "staff_admin" };

test("accepts a well-formed invite", () => {
  const result = buildStaffInvite(form(VALID));
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.value, {
    email: "nynne@odatone.dk",
    fullName: "Nynne Dahl",
    role: "staff_admin",
  });
});

test("accepts both staff roles and nothing else", () => {
  assert.deepEqual([...STAFF_ROLES], ["staff_admin", "staff_support"]);
  for (const role of STAFF_ROLES) {
    assert.equal(buildStaffInvite(form({ ...VALID, role })).ok, true, role);
  }
});

test("rejects the customer roles outright", () => {
  // profiles_tenancy_ck (0001_core.sql) requires a customer_id for these,
  // and this action never has one — minting either here would either fail
  // the constraint or, worse, create a tenant user with no tenant.
  for (const role of ["owner", "manager"]) {
    const result = buildStaffInvite(form({ ...VALID, role }));
    assert.equal(result.ok, false, role);
    assert.equal(!result.ok && result.errors.role, "required");
  }
});

test("rejects an unknown or missing role", () => {
  // Case matters: these are enum labels, not display text.
  for (const role of ["", "root", "staff_ADMIN", "staff-admin", "STAFF_ADMIN"]) {
    const result = buildStaffInvite(form({ ...VALID, role }));
    assert.equal(result.ok, false, JSON.stringify(role));
    assert.equal(!result.ok && result.errors.role, "required");
  }
});

test("surrounding whitespace on the role is tolerated, like every other field", () => {
  const result = buildStaffInvite(form({ ...VALID, role: "  staff_support  " }));
  assert.equal(result.ok && result.value.role, "staff_support");
});

test("lower-cases and trims the email", () => {
  // GoTrue normalises addresses this way internally, and the profile row
  // is looked up by the id it returns — but the dedupe read and any later
  // comparison are plain Postgres text equality, which is case-sensitive.
  const result = buildStaffInvite(form({ ...VALID, email: "  Nynne@Odatone.DK  " }));
  assert.equal(result.ok && result.value.email, "nynne@odatone.dk");
});

test("trims the full name", () => {
  const result = buildStaffInvite(form({ ...VALID, fullName: "  Nynne Dahl  " }));
  assert.equal(result.ok && result.value.fullName, "Nynne Dahl");
});

test("requires a full name", () => {
  const result = buildStaffInvite(form({ ...VALID, fullName: "   " }));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.errors.fullName, "required");
});

test("rejects a malformed or missing email", () => {
  for (const email of ["", "   ", "nynne", "nynne@", "@odatone.dk", "a b@odatone.dk"]) {
    const result = buildStaffInvite(form({ ...VALID, email }));
    assert.equal(result.ok, false, JSON.stringify(email));
    assert.equal(!result.ok && result.errors.email, "email");
  }
});

test("rejects over-long input rather than truncating it", () => {
  const longEmail = "n".repeat(250) + "@odatone.dk"; // 261 > 254
  assert.equal(
    (() => {
      const r = buildStaffInvite(form({ ...VALID, email: longEmail }));
      return !r.ok && r.errors.email;
    })(),
    "long",
  );

  const r = buildStaffInvite(form({ ...VALID, fullName: "N".repeat(201) }));
  assert.equal(!r.ok && r.errors.fullName, "long");
});

test("reports every bad field at once, not just the first", () => {
  const result = buildStaffInvite(form({ email: "nope", fullName: "", role: "root" }));
  assert.equal(result.ok, false);
  assert.deepEqual(!result.ok && result.errors, {
    email: "email",
    fullName: "required",
    role: "required",
  });
});
