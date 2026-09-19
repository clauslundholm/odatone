import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSupabaseEnv, resolveServiceKey } from "../lib/supabase/env.ts";

test("reads the public spelling", () => {
  const env = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  });
  assert.deepEqual(env, { url: "https://x.supabase.co", anonKey: "anon-key" });
});

test("falls back to the unprefixed spelling", () => {
  const env = resolveSupabaseEnv({
    SUPABASE_URL: "https://y.supabase.co",
    SUPABASE_ANON_KEY: "other-key",
  });
  assert.deepEqual(env, { url: "https://y.supabase.co", anonKey: "other-key" });
});

test("accepts the publishable-key spelling", () => {
  const env = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://z.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-key",
  });
  assert.equal(env?.anonKey, "pub-key");
});

test("absent credentials are a normal state, not an error", () => {
  assert.equal(resolveSupabaseEnv({}), null);
});

test("a half-configured environment is treated as absent", () => {
  assert.equal(resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }), null);
});

test("the service key is read separately and never from a public name", () => {
  assert.equal(resolveServiceKey({ SUPABASE_SERVICE_ROLE_KEY: "svc" }), "svc");
  assert.equal(resolveServiceKey({ SUPABASE_SECRET_KEY: "secret" }), "secret");
  assert.equal(resolveServiceKey({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leaked" }), null);
});
