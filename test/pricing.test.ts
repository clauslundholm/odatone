import { test } from "node:test";
import assert from "node:assert/strict";

import { PLANS, plan, planForM2, quote, recommendPlan, type Billing } from "../lib/pricing.ts";

/* quote() gained an additive overload so a caller already holding a resolved
   Plan (e.g. a database-backed one from lib/plans-server.ts) doesn't have to
   round-trip through a PlanId lookup against the compiled PLANS. This pins
   that the two call shapes are exactly interchangeable for every plan and
   billing term - the whole point of the overload was to change nothing about
   the arithmetic. */
test("quote(Plan, ...) and quote(PlanId, ...) agree for every plan and billing term", () => {
  const billings: Billing[] = ["monthly", "annual"];
  for (const p of PLANS) {
    for (const billing of billings) {
      for (const locations of [1, 3, 7, 12]) {
        assert.deepEqual(
          quote(p, billing, locations),
          quote(p.id, billing, locations),
          `${p.id}/${billing}/${locations}`,
        );
      }
    }
  }
});

test("quote(Plan, ...) prices from the object it is given, not a re-lookup", () => {
  const small = plan("small");
  const edited = { ...small, monthly: small.monthly + 50 };
  const q = quote(edited, "monthly", 1);
  assert.equal(q.listPerLocation, edited.monthly);
  assert.notEqual(q.listPerLocation, small.monthly);
});

/* Task 12's fix round made `plans` a required parameter specifically
   because a default that silently falls back to the compiled PLANS is
   indistinguishable at the call site from the correct, explicit call —
   the exact shape of bug that had already shipped three times as
   quote()'s bare-PlanId branch. These pin that planForM2/recommendPlan
   genuinely read the array they're handed, not the compiled PLANS, so a
   database-edited max_m2 (or a test double standing in for one) actually
   moves the answer. */
test("planForM2 reads the plans array it is given, not the compiled PLANS", () => {
  const widenedSmall = { ...plan("small"), maxM2: 500 };
  const custom = [widenedSmall, plan("medium"), plan("main")];

  // 200 m² exceeds the compiled small plan's 100 m² bound, so against the
  // real PLANS this would resolve to "medium" - proving the widened bound
  // from `custom`, not PLANS, is what's actually consulted.
  assert.equal(planForM2(200, PLANS).id, "medium");
  assert.equal(planForM2(200, custom).id, "small");
});

test("recommendPlan reads the plans array it is given, not the compiled PLANS", () => {
  const widenedSmall = { ...plan("small"), maxM2: 500 };
  const custom = [widenedSmall, plan("medium"), plan("main")];

  // "bar" is a LOUD venue type, so recommendPlan bumps one step past
  // planForM2's own answer - within `custom`, planForM2(200) is "small",
  // so the loud bump should land on "medium" (custom[1]), not on
  // whatever the compiled PLANS' index arithmetic would have produced.
  assert.equal(recommendPlan(200, "bar", custom).id, "medium");
});
