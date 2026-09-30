import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PLANS, quote } from "../../lib/pricing.ts";

test("the website's pricing module is reachable from the app", () => {
  assert.equal(PLANS.length, 3);
  assert.equal(quote(PLANS[0], "monthly", 1).perLocation, PLANS[0].monthly);
});

test("tsconfig maps @web/* onto the website's lib folder", () => {
  const tsconfig = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"));
  assert.deepEqual(tsconfig.compilerOptions.paths["@web/*"], ["../lib/*"]);
  assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true);
});

test("the env example names all three variables and no values", () => {
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_API_URL"]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
  }
  assert.doesNotMatch(example, /^EXPO_PUBLIC_SUPABASE_ANON_KEY=.+$/m);
});
