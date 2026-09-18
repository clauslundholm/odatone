import { plan as compiledPlanById, type Plan, type PlanId } from "../pricing.ts";
import { rowToPlan, type PlanRow } from "../plans-row.ts";

/**
 * Shared by every admin screen that prices a subscription: the dashboard's
 * MRR (Task 10) and the customers list/detail pages (Task 11). Extracted
 * here, rather than left as a local function in app/admin/page.tsx, once a
 * second caller needed the exact same logic — see the doc comment on
 * `resolvePlan` for why this exists at all.
 */

/** Builds a `PlanId -> Plan` lookup from every row of `plans` (active or
    not — see the callers' own doc comments for why an inactive plan must
    still resolve). */
export function planMap(rows: PlanRow[]): Map<PlanId, Plan> {
  return new Map(rows.map((row) => [row.id as PlanId, rowToPlan(row)]));
}

/**
 * Resolves `id` against `byId` (built by `planMap` from a live read of the
 * `plans` table), falling back to the compiled plan of the same id —
 * loudly, naming both the id and the caller, never silently.
 *
 * `quote()` (lib/pricing.ts) accepts either a `PlanId` or an
 * already-resolved `Plan`, but its `PlanId` branch re-resolves against the
 * compiled-in `PLANS` constant and never consults the database. Passing a
 * bare id to `quote()` anywhere in admin has already reintroduced this bug
 * twice — the public pricing page and this dashboard's own MRR once each —
 * both times only caught by deliberately editing a price in the database
 * and watching the number fail to move. `resolvePlan` is the one place
 * that lookup happens, so every caller passes `quote()` a `Plan` object
 * whose price came from the database that a staff member can actually
 * edit, and a plan id that exists on a subscription but not in `plans`
 * produces a warning instead of a silent mispricing. */
export function resolvePlan(id: string, byId: Map<PlanId, Plan>, context: string): Plan {
  const known = byId.get(id as PlanId);
  if (known) return known;
  console.warn(
    `[${context}] plan "${id}" was not found in the database — pricing it from the compiled fallback instead.`,
  );
  return compiledPlanById(id as PlanId);
}
