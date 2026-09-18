"use client";
import { createBrowserClient as create } from "@supabase/ssr";
import { resolveSupabaseEnv } from "./env";

/* NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are read here by
   their full literal names, not through resolveSupabaseEnv's default
   process.env lookup. Next inlines process.env.NEXT_PUBLIC_* at build time
   only when it can see the whole expression in the source; a dynamic lookup
   (e.g. process.env[name]) yields undefined in the browser bundle. */
export function createBrowserClient() {
  const env = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!env) throw new Error("Supabase is not configured");
  return create(env.url, env.anonKey);
}
