import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseEnv } from "./env";

/** A new client per request. Never share one across requests: the cache headers
    that keep a Set-Cookie response out of the CDN are delivered only with the
    first cookie write. */
export async function createClient() {
  const env = resolveSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const store = await cookies();

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
