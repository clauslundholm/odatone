import { test } from "node:test";
import assert from "node:assert/strict";

import { rowToPlan, type PlanRow } from "../lib/plans-row.ts";

const BASE: PlanRow = {
  id: "small",
  name: "Small Venue",
  monthly_ore: 14900,
  max_m2: 100,
  tagline: { da: "Til caféen.", en: "For the café." },
  features: [{ da: "Funktion", en: "Feature" }],
};

test("monthly_ore converts to kroner, not raw øre (a slip here is a 100x price error)", () => {
  assert.equal(rowToPlan(BASE).monthly, 149);
  assert.equal(rowToPlan({ ...BASE, monthly_ore: 24900 }).monthly, 249);
});

test("max_m2: null survives as maxM2: null for the unbounded plan", () => {
  const row: PlanRow = { ...BASE, id: "main", max_m2: null };
  assert.equal(rowToPlan(row).maxM2, null);
});

test("id, name, tagline and features pass through unchanged", () => {
  const p = rowToPlan(BASE);
  assert.equal(p.id, "small");
  assert.equal(p.name, "Small Venue");
  assert.deepEqual(p.tagline, BASE.tagline);
  assert.deepEqual(p.features, BASE.features);
});
