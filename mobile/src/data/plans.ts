import { PLANS, type Plan } from "@web/pricing";
import { rowToPlan, type PlanRow } from "@web/plans-row";
import { useEffect, useState } from "react";

import { configured, supabase } from "../auth/supabase";

/** The plans on sale, with the prices staff last set in /admin/products.
    Starts from the compiled defaults and swaps in the database's rows
    when they arrive — the same fallback the website's activePlans()
    makes (lib/plans-server.ts), and the same query: active plans, in
    their `sort` order, readable by anyone (plans_public_read). */
export function usePlans(enabled = true): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(PLANS);

  useEffect(() => {
    if (!enabled || !configured) return;
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
  }, [enabled]);

  return plans;
}

/** The name to show for the plan a customer is subscribed to, or null when
    there is no plan id. A plan staff have since deactivated is not among
    the active plans, but the customer may still read the row of a plan
    they are subscribed to (migration 0009_customer_plan_visibility.sql),
    so it is asked for by id, without the `active` filter. Order: the
    active plans already loaded; that read; the compiled plans; the raw id.
    Nothing is queried when there is no id (signed out, staff). */
export function usePlanName(planId: string | null): string | null {
  const active = usePlans(planId !== null);
  const known = planId ? active.find((p) => p.id === planId)?.name : undefined;
  const [fetched, setFetched] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!planId || known || !configured) return;
    let alive = true;
    Promise.resolve(supabase.from("plans").select("name").eq("id", planId).maybeSingle())
      .then(({ data, error }) => {
        const name = (data as { name?: unknown } | null)?.name;
        if (alive && !error && typeof name === "string" && name) setFetched({ id: planId, name });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [planId, known]);

  if (!planId) return null;
  if (known) return known;
  if (fetched?.id === planId) return fetched.name;
  return PLANS.find((p) => p.id === planId)?.name ?? planId;
}
