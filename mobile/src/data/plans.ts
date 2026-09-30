import { PLANS, type Plan } from "@web/pricing";
import { rowToPlan, type PlanRow } from "@web/plans-row";
import { useEffect, useState } from "react";

import { configured, supabase } from "../auth/supabase";

/** The plans on sale, with the prices staff last set in /admin/products.
    Starts from the compiled defaults and swaps in the database's rows
    when they arrive — the same fallback the website's activePlans()
    makes (lib/plans-server.ts), and the same query: active plans, in
    their `sort` order, readable by anyone (plans_public_read). */
export function usePlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(PLANS);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    Promise.resolve(
      supabase
        .from("plans")
        .select("id, name, monthly_ore, max_m2, tagline, features")
        .eq("active", true)
        .order("sort", { ascending: true }),
    )
      .then(({ data, error }) => {
        if (alive && !error && data && data.length > 0) setPlans((data as PlanRow[]).map(rowToPlan));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return plans;
}
