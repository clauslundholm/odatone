/* Credentials arrive under different names depending on how the project was
   created: the Vercel Marketplace integration, the Supabase dashboard and the
   newer publishable/secret key scheme all spell them differently. Whichever is
   present wins, exactly as lib/copy-store.ts does for Upstash. */

export type SupabaseEnv = { url: string; anonKey: string };

type Source = Record<string, string | undefined>;

const pick = (src: Source, ...names: string[]): string | null => {
  for (const n of names) {
    const v = src[n];
    if (v) return v;
  }
  return null;
};

/** Null is a normal state — locally, and on any deploy made before the
    integration was added. Callers decide what that means rather than crashing
    a render. A half-configured environment counts as absent: a URL without a
    key cannot produce a working client. */
export function resolveSupabaseEnv(source: Source = process.env): SupabaseEnv | null {
  const url = pick(source, "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = pick(
    source,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  return url && anonKey ? { url, anonKey } : null;
}

/* Deliberately refuses any NEXT_PUBLIC_ name. A service-role key under a public
   name would be inlined into the client bundle by the compiler, and this
   function is the last place that mistake can be caught. */
export function resolveServiceKey(source: Source = process.env): string | null {
  return pick(source, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}
