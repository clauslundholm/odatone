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

/* Fix round 6: this test used to assert only `listPerLocation`, which is a
   raw pass-through field (`listPerLocation: p.monthly` in quote()) — it
   would stay correct even if a regression re-resolved `p` from the
   compiled PLANS for every field the arithmetic actually depends on. A
   regression narrow enough to hit only `afterVolume`'s base (the value
   every other field in the Quote is computed from) would have passed this
   test green while still mispricing the live page — precisely the class
   of bug that has already shipped four times on this branch. `perLocation`
   and `yearlyExVat` are asserted here because they are the two fields nothing
   upstream of the arithmetic hands back verbatim: `perLocation` is the
   first value quote() actually computes from `p.monthly`, and `yearlyExVat`
   is derived from it through two more multiplications, so either one
   drifting from a stale compiled price cannot pass unnoticed the way
   listPerLocation's straight pass-through could. Three cases (monthly/1,
   annual/1, monthly/5) also exercise the annual discount and the volume
   discount against the edited price, not just the trivial 1-location,
   no-discount case the original test happened to use. */
test("quote(Plan, ...) prices from the object it is given, not a re-lookup (monthly, single location)", () => {
  const small = plan("small");
  const edited = { ...small, monthly: small.monthly + 50 };
  assert.notEqual(edited.monthly, small.monthly);

  const monthlyOne = quote(edited, "monthly", 1);
  assert.equal(monthlyOne.listPerLocation, edited.monthly);
  assert.equal(monthlyOne.perLocation, 199);
  assert.equal(monthlyOne.yearlyExVat, 2388);
  assert.notEqual(monthlyOne.perLocation, quote(small, "monthly", 1).perLocation);
});

// Fix round 6: an annual case, so the edited price is proven to flow through
// ANNUAL_DISCOUNT_PCT too, not only the no-discount monthly/1 case above.
test("quote(Plan, ...) prices from the object it is given, not a re-lookup (annual, single location)", () => {
  const small = plan("small");
  const edited = { ...small, monthly: small.monthly + 50 };

  const annualOne = quote(edited, "annual", 1);
  assert.equal(annualOne.perLocation, 109.45);
  assert.equal(annualOne.yearlyExVat, 1313.4);
  assert.notEqual(annualOne.perLocation, quote(small, "annual", 1).perLocation);
});

// Fix round 6: a multi-location case, so the edited price is proven to flow
// through the volume discount tier too, not only a single location.
test("quote(Plan, ...) prices from the object it is given, not a re-lookup (monthly, multiple locations)", () => {
  const small = plan("small");
  const edited = { ...small, monthly: small.monthly + 50 };

  const monthlyFive = quote(edited, "monthly", 5);
  assert.equal(monthlyFive.perLocation, 169.15);
  assert.equal(monthlyFive.yearlyExVat, 10149);
  assert.notEqual(monthlyFive.perLocation, quote(small, "monthly", 5).perLocation);
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
