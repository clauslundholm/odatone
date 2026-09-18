import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv, resolveServiceKey } from "./env";

/* Bypasses RLS. The ONLY legitimate caller is signup, where an anonymous
   visitor must create a customer and so has no session to authorise against.
   The "server-only" import above turns any client-component import of this
   file into a build error. */
export function createAdminClient() {
  const env = resolveSupabaseEnv();
  const key = resolveServiceKey();
  if (!env || !key) throw new Error("Supabase service role is not configured");
  return createSupabaseClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
