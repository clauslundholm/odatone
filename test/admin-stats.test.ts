import { test } from "node:test";
import assert from "node:assert/strict";

import { mrrOre } from "../lib/admin/stats.ts";
import { quote } from "../lib/pricing.ts";
import { toOre } from "../lib/money.ts";

test("monthly recurring revenue uses the shared quote maths", () => {
  const subs = [{ planId: "small" as const, billing: "monthly" as const, locations: 1, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote("small", "monthly", 1).monthlyExVat));
});

test("an annual subscription contributes its monthly equivalent", () => {
  const subs = [{ planId: "main" as const, billing: "annual" as const, locations: 3, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote("main", "annual", 3).monthlyExVat));
});

test("only active and trialing subscriptions count", () => {
  const base = { planId: "small" as const, billing: "monthly" as const, locations: 1 };
  assert.equal(mrrOre([{ ...base, status: "cancelled" as const }]), 0);
  assert.equal(mrrOre([{ ...base, status: "pending" as const }]), 0);
  assert.ok(mrrOre([{ ...base, status: "trialing" as const }]) > 0);
});

test("no subscriptions is zero, not NaN", () => {
  assert.equal(mrrOre([]), 0);
});
