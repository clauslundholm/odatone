import { test } from "node:test";
import assert from "node:assert/strict";

import { customerRows, locationFit, type RawCustomer } from "../lib/admin/customers.ts";
import { plan, quote } from "../lib/pricing.ts";
import { toOre } from "../lib/money.ts";

test("a location inside the plan's bound fits", () => {
  assert.equal(locationFit(80, 100), "within");
  assert.equal(locationFit(100, 100), "within");
});

test("a location past the bound is over", () => {
  assert.equal(locationFit(101, 100), "over");
});

test("an unbounded plan always fits", () => {
  assert.equal(locationFit(9000, null), "within");
});

const BASE: RawCustomer = {
  id: "c1",
  name: "Café Nordlys",
  cvr: "12345678",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  locationCount: 1,
  subscription: null,
};

test("a customer with an active subscription prices from the resolved plan, not a re-lookup by id", () => {
  const small = plan("small");
  const edited = { ...small, monthly: small.monthly * 10 };
  const rows = customerRows([
    { ...BASE, subscription: { plan: edited, billing: "monthly", status: "active" } },
  ]);
  assert.equal(rows[0].planName, edited.name);
  assert.equal(rows[0].mrrOre, toOre(quote(edited, "monthly", 1).monthlyExVat));
});

test("a customer with no subscription contributes no MRR and no plan name", () => {
  const rows = customerRows([{ ...BASE, subscription: null }]);
  assert.equal(rows[0].mrrOre, 0);
  assert.equal(rows[0].planName, null);
});

test("a cancelled subscription contributes nothing, matching mrrOre's EARNING rule", () => {
  const rows = customerRows([
    { ...BASE, subscription: { plan: plan("small"), billing: "monthly", status: "cancelled" } },
  ]);
  assert.equal(rows[0].mrrOre, 0);
});
