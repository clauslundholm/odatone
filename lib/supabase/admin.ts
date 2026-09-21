import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv, resolveServiceKey } from "./env";

/* Bypasses RLS. Two legitimate callers, both of which need GoTrue's admin
   API to create an auth user:

     - the public signup (app/actions.ts), where an anonymous visitor must
       create a customer and so has no session to authorise against;
     - the staff invite (app/admin/users/actions.ts), which DOES have a
       session and therefore settles authorisation against it, under RLS,
       before this client is constructed at all.

   Anything else reaching for this is almost certainly a mistake: with this
   key, every policy in 0003_tenancy.sql is inert. The "server-only" import
   above turns any client-component import of this file into a build error,
   but it cannot tell a careless server caller from a careful one. */
export function createAdminClient() {
  const env = resolveSupabaseEnv();
  const key = resolveServiceKey();
  if (!env || !key) throw new Error("Supabase service role is not configured");
  return createSupabaseClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
