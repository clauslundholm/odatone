import { test } from "node:test";
import assert from "node:assert/strict";

import { getOverrides, setOverride, listHistory } from "../lib/copy-store.ts";

test("returns no overrides when Redis is not configured", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.deepEqual(await getOverrides("da"), {});
});

test("reports failure rather than throwing when writing unconfigured", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  await assert.rejects(() => setOverride("da", "a", "b"), /not configured/);
});

test("returns an empty history when Redis is not configured", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.deepEqual(await listHistory(), []);
});
