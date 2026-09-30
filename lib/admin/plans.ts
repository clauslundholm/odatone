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
  return new Map(rows.map((row) => [row.id, rowToPlan(row)]));
}

/**
 * Resolves `id` against `byId` (built by `planMap` from a live read of the
 * `plans` table), falling back to the compiled plan of the same id —
 * loudly, naming both the id and the caller, never silently — and returning
 * `undefined` when neither has it.
 *
 * `quote()` (lib/pricing.ts) takes a resolved `Plan`, never an id, because
 * its former id branch re-resolved against the compiled-in `PLANS` constant
 * and never consulted the database. Passing a bare id to `quote()` in admin
 * reintroduced that bug twice — the public pricing page and this dashboard's
 * own MRR once each — both times caught only by editing a price in the
 * database and watching the number fail to move. `resolvePlan` is the one
 * place the lookup happens, so every caller prices from a `Plan` whose
 * figures came from the table a staff member can actually edit.
 *
 * The `undefined` return is what /admin/products creating plans costs.
 * Before, a subscription naming an id the database read had missed was
 * priced from the compiled plan of that id, and since the only three ids
 * that could exist were the three compiled ones, that fallback always found
 * a real plan. A plan created in /admin has no compiled counterpart, so for
 * it the fallback finds nothing — and `compiledPlanById` used to answer that
 * with Small Venue at 149 kr. rather than with nothing. Each caller now
 * decides: the pages that already render a "no plan" state use it, the
 * dashboard leaves the subscription out of MRR and says how many it left
 * out, and issuing an invoice refuses outright. None of them guesses a
 * price. */
export function resolvePlan(id: string, byId: Map<PlanId, Plan>, context: string): Plan | undefined {
  const known = byId.get(id);
  if (known) return known;

  const compiled = compiledPlanById(id);
  if (compiled) {
    console.warn(
      `[${context}] plan "${id}" was not found in the database — pricing it from the compiled fallback instead.`,
    );
    return compiled;
  }

  console.error(
    `[${context}] plan "${id}" is in neither the database nor the compiled fallback — refusing to price it.`,
  );
  return undefined;
}
