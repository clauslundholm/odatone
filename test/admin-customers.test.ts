import { test } from "node:test";
import assert from "node:assert/strict";

import { customerRows, latestSubscription, locationFit, type RawCustomer } from "../lib/admin/customers.ts";
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

// Regression guard for the fix-round Critical-adjacent finding: a live
// `active` subscription plus a newer `pending` upgrade (the ordinary shape
// of an upgrade awaiting activation) must resolve to the *earning* one, not
// merely the most recently created one — otherwise this page would show a
// paying customer's MRR as zero while the dashboard, which prices every
// subscription without this preference, still reports the real figure.
test("latestSubscription prefers an earning subscription over a newer non-earning one", () => {
  const active = { plan_id: "small", status: "active", created_at: "2026-01-01T00:00:00.000Z" };
  const pendingUpgrade = { plan_id: "main", status: "pending", created_at: "2026-06-01T00:00:00.000Z" };
  assert.equal(latestSubscription([active, pendingUpgrade]), active);
  assert.equal(latestSubscription([pendingUpgrade, active]), active);
});

test("latestSubscription falls back to most recently created when none are earning", () => {
  const older = { plan_id: "small", status: "cancelled", created_at: "2025-01-01T00:00:00.000Z" };
  const newer = { plan_id: "medium", status: "pending", created_at: "2026-01-01T00:00:00.000Z" };
  assert.equal(latestSubscription([older, newer]), newer);
});

test("latestSubscription picks the most recently created among several earning rows", () => {
  const earlierTrial = { plan_id: "small", status: "trialing", created_at: "2025-06-01T00:00:00.000Z" };
  const laterActive = { plan_id: "medium", status: "active", created_at: "2026-01-01T00:00:00.000Z" };
  assert.equal(latestSubscription([earlierTrial, laterActive]), laterActive);
});

test("latestSubscription returns null for no subscriptions", () => {
  assert.equal(latestSubscription([]), null);
});
