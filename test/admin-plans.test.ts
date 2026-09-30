import { test } from "node:test";
import assert from "node:assert/strict";

import { planMap, resolvePlan } from "../lib/admin/plans.ts";
import { compiled } from "./helpers.ts";
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
  assert.equal(resolved?.monthly, 900);
  assert.notEqual(resolved?.monthly, compiled("small").monthly);
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
  assert.equal(resolved?.monthly, compiled("small").monthly);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /test-context/);
  assert.match(String(warnings[0][0]), /small/);
});

/* The case /admin/products creating plans brought into existence, and the
   whole reason resolvePlan may return nothing. "arena" is a plan a staff
   member made after this code shipped: it has no compiled counterpart, so
   when the database read that should have supplied it fails, there is
   nothing to fall back to. Before, `plan()` answered that with PLANS[0] —
   Small Venue at 149 kr. — so a 499 kr. subscription was priced at 149 kr.
   on every admin screen and in the customer's own portal, with a warning
   that read as though the fallback had worked. */
test("resolvePlan returns undefined, loudly, for an id in neither the database nor the compiled plans", () => {
  const errors: unknown[][] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.error = (...args: unknown[]) => errors.push(args);
  console.warn = (...args: unknown[]) => warnings.push(args);
  let resolved;
  try {
    resolved = resolvePlan("arena", planMap([]), "test-context");
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  assert.equal(resolved, undefined);
  /* An error, not a warning: a warning is what a *successful* compiled
     fallback deserves, and the two must not be confused in a log. */
  assert.equal(warnings.length, 0);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0][0]), /test-context/);
  assert.match(String(errors[0][0]), /arena/);
});

test("resolvePlan finds a plan that exists only in the database", () => {
  const arena: PlanRow = {
    id: "arena",
    name: "Arena Stage",
    monthly_ore: 49900,
    max_m2: null,
    tagline: { da: "Til arenaen.", en: "For the arena." },
    features: [],
  };
  const resolved = resolvePlan("arena", planMap([arena]), "test");
  assert.equal(resolved?.name, "Arena Stage");
  assert.equal(resolved?.monthly, 499);
});
