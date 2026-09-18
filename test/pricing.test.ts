import { test } from "node:test";
import assert from "node:assert/strict";

import { PLANS, plan, quote, type Billing } from "../lib/pricing.ts";

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
