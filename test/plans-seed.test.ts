import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { PLANS } from "../lib/pricing.ts";

test("the committed seed matches lib/pricing.ts", () => {
  const url = new URL("../supabase/seed.sql", import.meta.url);
  const before = readFileSync(url, "utf8");
  execFileSync("node", ["scripts/plans-seed.mjs"], { cwd: process.cwd() });
  assert.equal(
    readFileSync(url, "utf8"),
    before,
    "supabase/seed.sql is stale - run `node scripts/plans-seed.mjs` and commit the result",
  );
});

test("every plan's price survives the round trip to øre", () => {
  for (const p of PLANS) {
    assert.equal(Math.round(p.monthly * 100) / 100, p.monthly, p.id);
  }
});
