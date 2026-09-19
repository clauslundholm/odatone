import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseEnv } from "./env";

/** A new client per request. Never share one across requests: the cache headers
    that keep a Set-Cookie response out of the CDN are delivered only with the
    first cookie write.

    `await cookies()` must run before the env check below, not after. Reading
    cookies is what tells Next this route can't be prerendered — awaiting it
    only once we already know we have credentials would let a build with no
    Supabase env vars configured (a normal state; see lib/supabase/env.ts)
    reach the throw first, during static generation, and fail the entire
    `next build` for every route, not just this one. Awaiting it unconditionally
    marks the route dynamic regardless of configuration, so the same missing-env
    throw instead surfaces at request time as this route's own 500. */
export async function createClient() {
  const store = await cookies();
  const env = resolveSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured");

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Components cannot write cookies. proxy.ts refreshes the
             session, so this is safe to swallow — and only here. */
        }
      },
    },
  });
}
