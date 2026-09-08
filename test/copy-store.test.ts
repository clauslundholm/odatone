import { test } from "node:test";
import assert from "node:assert/strict";

import { getOverrides, setOverride, listHistory, isConfigured } from "../lib/copy-store.ts";

/* Both spellings the store accepts: Upstash's own, and the KV_REST_API_* names
   the Vercel Marketplace integration injects. Clearing one is not enough to
   describe an unconfigured store. */
function unconfigure() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

test("returns no overrides when Redis is not configured", async () => {
  unconfigure();
  assert.deepEqual(await getOverrides("da"), {});
});

test("reports failure rather than throwing when writing unconfigured", async () => {
  unconfigure();
  await assert.rejects(() => setOverride("da", "a", "b"), /not configured/);
});

test("returns an empty history when Redis is not configured", async () => {
  unconfigure();
  assert.deepEqual(await listHistory(), []);
});

test("is not configured when neither spelling is present", () => {
  unconfigure();
  assert.equal(isConfigured(), false);
});

test("accepts Upstash's own UPSTASH_REDIS_REST_* names", () => {
  unconfigure();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  assert.equal(isConfigured(), true);
  unconfigure();
});

test("accepts the marketplace integration's KV_REST_API_* names", () => {
  unconfigure();
  process.env.KV_REST_API_URL = "https://example.upstash.io";
  process.env.KV_REST_API_TOKEN = "token";
  assert.equal(isConfigured(), true);
  unconfigure();
});

test("a url without a token is not configured", () => {
  unconfigure();
  process.env.KV_REST_API_URL = "https://example.upstash.io";
  assert.equal(isConfigured(), false);
  unconfigure();
});
