import { mrrOre, type SubscriptionForMrr, type SubscriptionStatus } from "./stats.ts";
import type { Billing, Plan } from "../pricing.ts";

/**
 * One customer, with every figure the list needs already aggregated by the
 * caller (locations counted, the current subscription's plan already
 * resolved against the database — see lib/admin/plans.ts — never a bare
 * PlanId). Aggregating per customer in the page, rather than querying per
 * row here, is what keeps this an in-memory map instead of an N+1 query
 * against tables that only grow.
 */
export type RawCustomer = {
  id: string;
  name: string;
  cvr: string | null;
  status: string;
  createdAt: string;
  locationCount: number;
  /** The customer's current subscription, or null if it has none yet
      (e.g. a pending signup with no plan chosen). */
  subscription: {
    plan: Plan;
    billing: Billing;
    status: SubscriptionStatus;
  } | null;
};

export type CustomerRow = {
  id: string;
  name: string;
  cvr: string | null;
  status: string;
  createdAt: string;
  locationCount: number;
  planName: string | null;
  /** This customer's contribution to MRR, in øre. Zero for a customer with
      no subscription, or one that isn't currently earning (pending,
      cancelled) — the same EARNING test lib/admin/stats.ts's mrrOre
      already applies, reused rather than re-implemented here. */
  mrrOre: number;
};

/** Shapes raw, per-customer aggregates into what the list table renders.
    Pure and synchronous so it's unit-testable without a database — the
    page (app/admin/customers/page.tsx) does the Supabase reads and
    aggregation; this only decides how to present the result. */
export function customerRows(raw: RawCustomer[]): CustomerRow[] {
  return raw.map((customer) => {
    const subs: SubscriptionForMrr[] = customer.subscription
      ? [
          {
            plan: customer.subscription.plan,
            billing: customer.subscription.billing,
            locations: customer.locationCount,
            status: customer.subscription.status,
          },
        ]
      : [];

    return {
      id: customer.id,
      name: customer.name,
      cvr: customer.cvr,
      status: customer.status,
      createdAt: customer.createdAt,
      locationCount: customer.locationCount,
      planName: customer.subscription?.plan.name ?? null,
      mrrOre: mrrOre(subs),
    };
  });
}

/** A customer can accumulate more than one `subscriptions` row over time
    (a plan change, a lapsed trial re-started); the list and detail pages
    both only ever want the current one. "Current" means most recently
    created — plain ISO-8601 timestamps sort correctly as strings, so this
    needs no date parsing. Returns null for a customer with no subscription
    at all (e.g. a pending signup that hasn't chosen a plan). */
export function latestSubscription<T extends { created_at: string }>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  return subs.reduce((latest, s) => (s.created_at > latest.created_at ? s : latest));
}

/** Whether a location's floor area still fits inside its plan's bound.
    `maxM2 === null` is the unbounded (Main Stage) plan, which nothing can
    outgrow. This is the test the detail page's per-location Meter and
    "over" Badge are both driven by. */
export function locationFit(m2: number, maxM2: number | null): "within" | "over" {
  return maxM2 === null || m2 <= maxM2 ? "within" : "over";
}
