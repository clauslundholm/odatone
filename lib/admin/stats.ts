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

/* Normalised to a month so an annual customer is comparable to a monthly one,
   and computed with the same quote() the pricing page uses — two implementations
   of this arithmetic would disagree the first time a discount changed. */
export function mrrOre(subs: SubscriptionForMrr[]): number {
  return subs
    .filter((s) => EARNING.includes(s.status))
    .reduce((sum, s) => sum + toOre(quote(s.plan, s.billing, s.locations).monthlyExVat), 0);
}
