import { test } from "node:test";
import assert from "node:assert/strict";

import { PLANS, plan, planForM2, quote, recommendPlan, type Billing } from "../lib/pricing.ts";
import { compiled } from "./helpers.ts";

/* quote() used to take a bare PlanId as well as a Plan, and the test that
   stood here pinned the two call shapes as interchangeable. The overload is
   gone (see quote()'s own comment), so the property it asserted no longer
   exists to assert. What replaces it is the reason the overload went: with
   plan ids coming from the `plans` table, an id the compiled array has never
   heard of is ordinary, and `plan()` must say so rather than answer with the
   cheapest plan it happens to hold. */
test("plan() returns the compiled plan for a known id", () => {
  const small = compiled("small");
  assert.equal(small.id, "small");
  assert.equal(small.monthly, 149);
});

test("plan() returns undefined for an id it does not have, not the first plan", () => {
  /* The exact failure this guards: "arena" is a plan created in
     /admin/products. Returning PLANS[0] here priced it at Small Venue's
     149 kr. everywhere a compiled fallback was reached. */
  assert.equal(plan("arena"), undefined);
  assert.equal(plan(""), undefined);
  assert.notEqual(plan("arena"), PLANS[0]);
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
  const small = compiled("small");
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
  const small = compiled("small");
  const edited = { ...small, monthly: small.monthly + 50 };

  const annualOne = quote(edited, "annual", 1);
  assert.equal(annualOne.perLocation, 109.45);
  assert.equal(annualOne.yearlyExVat, 1313.4);
  assert.notEqual(annualOne.perLocation, quote(small, "annual", 1).perLocation);
});

// Fix round 6: a multi-location case, so the edited price is proven to flow
// through the volume discount tier too, not only a single location.
test("quote(Plan, ...) prices from the object it is given, not a re-lookup (monthly, multiple locations)", () => {
  const small = compiled("small");
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
  const widenedSmall = { ...compiled("small"), maxM2: 500 };
  const custom = [widenedSmall, compiled("medium"), compiled("main")];

  // 200 m² exceeds the compiled small plan's 100 m² bound, so against the
  // real PLANS this would resolve to "medium" - proving the widened bound
  // from `custom`, not PLANS, is what's actually consulted.
  assert.equal(planForM2(200, PLANS).id, "medium");
  assert.equal(planForM2(200, custom).id, "small");
});

test("recommendPlan reads the plans array it is given, not the compiled PLANS", () => {
  const widenedSmall = { ...compiled("small"), maxM2: 500 };
  const custom = [widenedSmall, compiled("medium"), compiled("main")];

  // "bar" is a LOUD venue type, so recommendPlan bumps one step past
  // planForM2's own answer - within `custom`, planForM2(200) is "small",
  // so the loud bump should land on "medium" (custom[1]), not on
  // whatever the compiled PLANS' index arithmetic would have produced.
  assert.equal(recommendPlan(200, "bar", custom).id, "medium");
});
