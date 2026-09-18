import { test } from "node:test";
import assert from "node:assert/strict";

import { meterSegments } from "../lib/meter.ts";

test("under the limit fills proportionally", () => {
  assert.deepEqual(meterSegments(50, 100), { inPct: 50, overPct: 0 });
});

test("at the limit is full but not over", () => {
  assert.deepEqual(meterSegments(100, 100), { inPct: 100, overPct: 0 });
});

test("over the limit splits into in and over", () => {
  // 150 of a 100 limit: the bar is the whole 150, two thirds within.
  assert.deepEqual(meterSegments(150, 100), { inPct: 67, overPct: 33 });
});

test("an unbounded plan is never over", () => {
  assert.deepEqual(meterSegments(5000, null), { inPct: 100, overPct: 0 });
});

test("zero and nonsense do not produce NaN", () => {
  assert.deepEqual(meterSegments(0, 100), { inPct: 0, overPct: 0 });
  assert.deepEqual(meterSegments(50, 0), { inPct: 0, overPct: 100 });
});
