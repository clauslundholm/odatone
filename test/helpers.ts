/* Not a test file — a helper shared by the suites that price against a
   compiled plan.

   `plan()` (lib/pricing.ts) returns `Plan | undefined` now that plan ids are
   database rows rather than a closed union, and every one of those suites
   wants "Small Venue, exactly as shipped" as a fixture. Writing `plan("small")!`
   in each of them would silence the very case the change exists to surface;
   this throws instead, so a fixture that stops existing fails the test that
   depends on it by name rather than somewhere further down as a TypeError. */
import { plan, type Plan, type PlanId } from "../lib/pricing.ts";

export function compiled(id: PlanId): Plan {
  const p = plan(id);
  if (!p) throw new Error(`test fixture: no compiled plan with id "${id}"`);
  return p;
}
