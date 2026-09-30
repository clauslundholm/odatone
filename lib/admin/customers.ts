import { isEarning, mrrOre, type SubscriptionForMrr, type SubscriptionStatus } from "./stats.ts";
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
    /** The raw `subscriptions.plan_id`. Kept alongside the resolved plan so
        an unresolvable one can still be named in the table — see `plan`. */
    planId: string;
    /** The resolved plan, or null when `planId` matches neither a `plans`
        row nor a compiled fallback (lib/admin/plans.ts's `resolvePlan`).
        Null is not the same as having no subscription: the customer has one
        and it is presumably being charged for, we just cannot say what it
        costs. Collapsing the two would erase the customer's plan from this
        table entirely and leave nothing to investigate. */
    plan: Plan | null;
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
      already applies, reused rather than re-implemented here. Also zero
      when the plan could not be resolved, in which case `planUnpriced` says
      so rather than leaving a real customer looking like a free one. */
  mrrOre: number;
  /** True when this customer has a subscription whose plan could not be
      resolved, so `planName` is a bare id and `mrrOre` is zero for want of
      a price rather than for want of a subscription. */
  planUnpriced: boolean;
};

/** Shapes raw, per-customer aggregates into what the list table renders.
    Pure and synchronous so it's unit-testable without a database — the
    page (app/admin/customers/page.tsx) does the Supabase reads and
    aggregation; this only decides how to present the result. */
export function customerRows(raw: RawCustomer[]): CustomerRow[] {
  return raw.map((customer) => {
    const sub = customer.subscription;
    /* No plan, no price: mrrOre needs a Plan to call quote() with, and there
       is deliberately nothing to substitute — see RawCustomer.subscription's
       `plan` field. An empty list here yields zero, and `planUnpriced` below
       is what distinguishes that zero from the free-of-charge kind. */
    const subs: SubscriptionForMrr[] =
      sub && sub.plan
        ? [
            {
              plan: sub.plan,
              billing: sub.billing,
              locations: customer.locationCount,
              status: sub.status,
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
      /* Falls back to the raw id, which is the only thing known about the
         plan at that point and the one string that makes the row
         actionable: it is what someone would search /admin/products for. */
      planName: sub ? (sub.plan?.name ?? sub.planId) : null,
      mrrOre: mrrOre(subs),
      planUnpriced: Boolean(sub && !sub.plan),
    };
  });
}

/** A customer can accumulate more than one `subscriptions` row over time —
    a plan change, a lapsed trial re-started, or the ordinary shape of an
    upgrade: a live `active` row plus a newer `pending` row awaiting
    activation. The list and detail pages both only ever want the one that
    represents what the customer is actually paying for *right now*, so
    this prefers an earning subscription (`isEarning` — active, trialing or
    past_due, the same rule `mrrOre` prices by) over a merely newer one; a
    pending upgrade sitting beside a live subscription must not zero out
    that customer's MRR on this page while the dashboard, which reads the
    same `subscriptions` table without this preference, still reports the
    real figure — two admin screens disagreeing about the same customer is
    worse than either being wrong alone.

    Within whichever pool applies (the earning rows if there are any,
    otherwise every row), "current" means most recently created, compared
    with `Date.parse` rather than a raw string comparison — lexicographic
    ordering of ISO-8601 timestamps only holds for a fixed offset and a
    fixed fractional-second precision, both of which are true of what
    Postgres/PostgREST happens to emit today but neither of which this
    function should have to assume.

    Returns null for a customer with no subscription at all (e.g. a pending
    signup that hasn't chosen a plan). */
export function latestSubscription<T extends { created_at: string; status: string }>(
  subs: T[],
): T | null {
  if (subs.length === 0) return null;
  const earning = subs.filter((s) => isEarning(s.status));
  const pool = earning.length > 0 ? earning : subs;
  return pool.reduce((latest, s) => (Date.parse(s.created_at) > Date.parse(latest.created_at) ? s : latest));
}

/** Whether a location's floor area still fits inside its plan's bound.
    `maxM2 === null` is the unbounded (Main Stage) plan, which nothing can
    outgrow. This is the test the detail page's per-location Meter and
    "over" Badge are both driven by. */
export function locationFit(m2: number | null, maxM2: number | null): "within" | "over" | "unknown" {
  /* "unknown" is not a hedge, it is the third real state. Signup stopped
     asking for a floor area, so a location written after 0014 has none, and
     an unstated area is not the same as an area that fits — reporting
     "within" for it would put a reassuring meter next to a figure nobody
     ever gave. */
  if (m2 === null) return "unknown";
  if (maxM2 === null) return "within";
  return m2 > maxM2 ? "over" : "within";
}
