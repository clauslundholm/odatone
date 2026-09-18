import { unstable_cache, revalidateTag } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv } from "@/lib/supabase/env";
import { PLANS, plan as staticPlan, type Plan, type PlanId } from "@/lib/pricing";
import { toKroner } from "@/lib/money";

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

type PlanRow = {
  id: string;
  name: string;
  monthly_ore: number;
  max_m2: number | null;
  tagline: Plan["tagline"];
  features: Plan["features"];
};

/* Reading the table is a network call, and an uncached one during render
   opts the route into dynamic rendering — the same trap lib/copy-server.ts
   documents for the copy store. Caching it puts the read back in the build
   rather than in the request, so the 25 marketing pages keep prerendering.
   Nothing expires on a timer — a save revalidates this tag, which is the
   only thing that ever changes the answer. */
const readPlans = unstable_cache(
  async (): Promise<Plan[]> => {
    const supabase = anonClient();
    if (!supabase) return PLANS;
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, monthly_ore, max_m2, tagline, features")
      .eq("active", true)
      .order("sort", { ascending: true });
    if (error || !data || data.length === 0) return PLANS;
    return (data as PlanRow[]).map((row) => ({
      id: row.id as PlanId,
      name: row.name,
      monthly: toKroner(row.monthly_ore),
      maxM2: row.max_m2,
      tagline: row.tagline,
      features: row.features,
    }));
  },
  ["plans"],
  { tags: [PLANS_TAG] },
);

/** The fallback is deliberate: an unreachable or empty database returns the
    compiled-in PLANS rather than throwing or showing a visitor no prices at
    all — the same contract lib/copy-server.ts uses for copy. */
export async function activePlans(): Promise<Plan[]> {
  try {
    return await readPlans();
  } catch {
    return PLANS;
  }
}

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
