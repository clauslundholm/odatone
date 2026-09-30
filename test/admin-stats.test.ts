import { test } from "node:test";
import assert from "node:assert/strict";

import { mrrOre } from "../lib/admin/stats.ts";
import { quote } from "../lib/pricing.ts";
import { compiled } from "./helpers.ts";
import { toOre } from "../lib/money.ts";

test("monthly recurring revenue uses the shared quote maths", () => {
  const small = compiled("small");
  const subs = [{ plan: small, billing: "monthly" as const, locations: 1, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote(small, "monthly", 1).monthlyExVat));
});

test("an annual subscription contributes its monthly equivalent", () => {
  const main = compiled("main");
  const subs = [{ plan: main, billing: "annual" as const, locations: 3, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote(main, "annual", 3).monthlyExVat));
});

test("only active and trialing subscriptions count", () => {
  const base = { plan: compiled("small"), billing: "monthly" as const, locations: 1 };
  assert.equal(mrrOre([{ ...base, status: "cancelled" as const }]), 0);
  assert.equal(mrrOre([{ ...base, status: "pending" as const }]), 0);
  assert.ok(mrrOre([{ ...base, status: "trialing" as const }]) > 0);
});

test("no subscriptions is zero, not NaN", () => {
  assert.equal(mrrOre([]), 0);
});

/* Regression guard for the fix-round Critical: mrrOre must price from the
   Plan object it is handed, never re-resolve by id against the compiled
   PLANS. A plan with the same id as a compiled one, but a different
   monthly price (as if the database had been edited), must change mrrOre's
   answer — proving the id alone is never consulted. */
test("prices from the plan object it is given, not a re-lookup by id", () => {
  const compiledSmall = compiled("small");
  const editedSmall = { ...compiledSmall, monthly: compiledSmall.monthly * 10 };
  assert.notEqual(editedSmall.monthly, compiledSmall.monthly);

  const subs = [{ plan: editedSmall, billing: "monthly" as const, locations: 1, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote(editedSmall, "monthly", 1).monthlyExVat));
  assert.notEqual(mrrOre(subs), toOre(quote(compiledSmall, "monthly", 1).monthlyExVat));
});
