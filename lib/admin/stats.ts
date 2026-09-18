import { quote, type Billing, type PlanId } from "../pricing.ts";
import { toOre } from "../money.ts";

export type SubscriptionStatus = "pending" | "trialing" | "active" | "past_due" | "cancelled";
export type SubscriptionForMrr = {
  planId: PlanId; billing: Billing; locations: number; status: SubscriptionStatus;
};

const EARNING: SubscriptionStatus[] = ["active", "trialing", "past_due"];

/* Normalised to a month so an annual customer is comparable to a monthly one,
   and computed with the same quote() the pricing page uses — two implementations
   of this arithmetic would disagree the first time a discount changed. */
export function mrrOre(subs: SubscriptionForMrr[]): number {
  return subs
    .filter((s) => EARNING.includes(s.status))
    .reduce((sum, s) => sum + toOre(quote(s.planId, s.billing, s.locations).monthlyExVat), 0);
}
