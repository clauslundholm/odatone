import { test } from "node:test";
import assert from "node:assert/strict";

import { isStaffRole, isCustomerRole, landingFor } from "../lib/tenancy.ts";

test("staff roles are staff", () => {
  assert.equal(isStaffRole("staff_admin"), true);
  assert.equal(isStaffRole("staff_support"), true);
  assert.equal(isStaffRole("owner"), false);
});

test("customer roles are customers", () => {
  assert.equal(isCustomerRole("owner"), true);
  assert.equal(isCustomerRole("manager"), true);
  assert.equal(isCustomerRole("staff_admin"), false);
});

test("each role lands in its own portal", () => {
  assert.equal(landingFor("staff_admin"), "/admin");
  assert.equal(landingFor("owner"), "/my-odatone");
});
