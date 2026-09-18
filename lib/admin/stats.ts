import { quote, type Billing, type Plan } from "../pricing.ts";
import { toOre } from "../money.ts";

export type SubscriptionStatus = "pending" | "trialing" | "active" | "past_due" | "cancelled";

/* `plan` is a resolved Plan object, not a PlanId. quote()'s string branch
   re-looks the id up against the compiled PLANS array, never the database
   — so a mere id here would silently re-introduce the exact bug this type
   exists to prevent: an admin who edits a price in the database would see
   the pricing page move and this dashboard's MRR stay frozen at the old
   number. The caller (app/admin/page.tsx) is responsible for resolving
   each subscription's plan_id against the database (falling back to the
   compiled plan, loudly, only if the database doesn't have that id) —
   mrrOre itself must never re-resolve by id. */
export type SubscriptionForMrr = {
  plan: Plan; billing: Billing; locations: number; status: SubscriptionStatus;
};

const EARNING: SubscriptionStatus[] = ["active", "trialing", "past_due"];

/** The one definition of "is this subscription currently earning". Exported
    so lib/admin/customers.ts's `latestSubscription` can prefer an earning
    subscription over a newer non-earning one (a pending upgrade sitting
    alongside a live `active` row) without keeping its own separate copy of
    this list to drift out of sync with mrrOre's. Takes a plain `string`,
    not `SubscriptionStatus`, because callers are typically narrowing a raw
    database column and a stricter parameter type would force every call
    site to cast first. */
export function isEarning(status: string): boolean {
  return (EARNING as readonly string[]).includes(status);
}

/* Normalised to a month so an annual customer is comparable to a monthly one,
   and computed with the same quote() the pricing page uses — two implementations
   of this arithmetic would disagree the first time a discount changed. */
export function mrrOre(subs: SubscriptionForMrr[]): number {
  return subs
    .filter((s) => isEarning(s.status))
    .reduce((sum, s) => sum + toOre(quote(s.plan, s.billing, s.locations).monthlyExVat), 0);
}
