import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv } from "@/lib/supabase/env";
import { PLANS, plan as staticPlan, type Plan, type PlanId } from "@/lib/pricing";
import { rowToPlan, type PlanRow } from "@/lib/plans-row";

/** Everything that invalidates the stored plans carries this tag, so one save
    is enough to make every page that shows prices rebuild against it. */
export const PLANS_TAG = "plans";

/* Deliberately not lib/supabase/server.ts's createClient(): that one awaits
   cookies() to attach a session, and cookies() is a Next "Dynamic API" that
   cannot be called inside a function wrapped in unstable_cache — Next throws
   `used cookies() inside a function cached with unstable_cache()` (E846).
   Confirmed by wiring it that way and running the build: the error fired on
   every render, was swallowed by activePlans()'s fallback below, and the
   database was silently never read even though the build "succeeded".

   The marketing pages render without a session anyway — supabase/migrations/
   0003_tenancy.sql's `plans_public_read` policy exists precisely so an
   anonymous key can read active plans — so a plain, cookie-free client is
   both sufficient and the only one that can live inside the cache scope. */
function anonClient() {
  const env = resolveSupabaseEnv();
  if (!env) return null;
  return createSupabaseClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/* Reading the table is a network call, and an uncached one during render
   opts the route into dynamic rendering — the same trap lib/copy-server.ts
   documents for the copy store. Caching it puts the read back in the build
   rather than in the request, so the 25 marketing pages keep prerendering.
   Nothing expires on a timer — a save revalidates this tag, which is the
   only thing that ever changes the answer.

   Every early return is logged before it fires: the fallback to compiled
   PLANS is deliberate (see activePlans() below), but silent, it makes "the
   database is unreachable" indistinguishable from "the database has no
   active plans" indistinguishable from "everything worked" — all three
   render the same page. An operator who edits a price and sees no change
   needs the server log to say which of those actually happened. */
const readPlans = unstable_cache(
  async (): Promise<Plan[]> => {
    const supabase = anonClient();
    if (!supabase) {
      console.warn("[plans] Supabase is not configured — serving compiled PLANS.");
      return PLANS;
    }

    const { data, error } = await supabase
      .from("plans")
      .select("id, name, monthly_ore, max_m2, tagline, features")
      .eq("active", true)
      .order("sort", { ascending: true });

    if (error) {
      console.warn(`[plans] database read failed (${error.message}) — serving compiled PLANS.`);
      return PLANS;
    }
    if (!data || data.length === 0) {
      /* Distinct from a read failure: this is what it looks like if an
         operator deactivates every plan, not a fault. */
      console.warn("[plans] no active plans in the database — serving compiled PLANS.");
      return PLANS;
    }
    return (data as PlanRow[]).map(rowToPlan);
  },
  ["plans"],
  /* Fix round 6: revalidatePlans() (below) was the *only* thing that ever
     invalidated this cache, and only updatePlan calls it -- a price
     changed by any other writer (a direct SQL update, a future admin
     script, a support fix applied by hand) left this cache serving the
     old number indefinitely. Verified live: a price changed by SQL left
     /admin/products showing the new value while /da/priser kept showing
     the old one under a banner reading "These prices are live on
     odatone.com." `revalidate: 300` is a floor under every writer that
     doesn't go through updatePlan, not a replacement for the tag: a form
     save still revalidates instantly via revalidatePlans(), this only
     bounds how stale any *other* path can ever leave the public price. */
  { tags: [PLANS_TAG], revalidate: 300 },
);

/** The fallback is deliberate: an unreachable or empty database returns the
    compiled-in PLANS rather than throwing or showing a visitor no prices at
    all — the same contract lib/copy-server.ts uses for copy.

    Wrapped in React's cache() exactly as lib/copy-server.ts wraps
    overridesFor: one render pass makes one round trip no matter how many
    components ask, including planById() below calling this directly. */
export const activePlans = cache(async (): Promise<Plan[]> => {
  try {
    return await readPlans();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[plans] unexpected error reading plans (${message}) — serving compiled PLANS.`);
    return PLANS;
  }
});

/** Single plan lookup, falling back to the compiled-in plan of the same id
    (lib/pricing.ts's own default) if the database doesn't have it. */
export async function planById(id: PlanId): Promise<Plan> {
  const plans = await activePlans();
  return plans.find((p) => p.id === id) ?? staticPlan(id);
}

/* { expire: 0 } mirrors app/api/edits/route.ts's revalidateTag(OVERRIDES_TAG,
   { expire: 0 }) for the copy store: a price change should never be served
   stale, so the next request blocks for a fresh read rather than getting
   stale-while-revalidate's one-year window. */
export function revalidatePlans(): void {
  revalidateTag(PLANS_TAG, { expire: 0 });
}
