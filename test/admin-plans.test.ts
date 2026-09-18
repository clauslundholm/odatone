import { test } from "node:test";
import assert from "node:assert/strict";

import { planMap, resolvePlan } from "../lib/admin/plans.ts";
import { plan } from "../lib/pricing.ts";
import type { PlanRow } from "../lib/plans-row.ts";

const ROW: PlanRow = {
  id: "small",
  name: "Small Venue",
  monthly_ore: 90000, // edited from the compiled 14900, as if a staff member changed the price
  max_m2: 100,
  tagline: { da: "Til caféen.", en: "For the café." },
  features: [],
};

test("resolvePlan prefers the database row over the compiled constant", () => {
  const byId = planMap([ROW]);
  const resolved = resolvePlan("small", byId, "test");
  assert.equal(resolved.monthly, 900);
  assert.notEqual(resolved.monthly, plan("small").monthly);
});

test("resolvePlan falls back to the compiled plan, with a warning, when the id is missing", () => {
  const byId = planMap([]);
  const warnings: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  let resolved;
  try {
    resolved = resolvePlan("small", byId, "test-context");
  } finally {
    console.warn = original;
  }
  assert.equal(resolved.monthly, plan("small").monthly);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /test-context/);
  assert.match(String(warnings[0][0]), /small/);
});
