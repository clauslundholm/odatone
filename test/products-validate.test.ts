import { test } from "node:test";
import assert from "node:assert/strict";

import { parseFeatures, parseMaxM2, parsePriceKr } from "../app/admin/products/validate.ts";

/* Task 12's fix round: a blank or non-numeric price field, coerced with a
   bare `Number(...)`, silently became 0 or NaN-that-slips-past-a-loose-
   check and reached the database — a save that showed no error and
   published "0 kr." live. These pin the rejection at the string level,
   before any coercion happens. */
test("parsePriceKr rejects blank and non-numeric input", () => {
  assert.equal(parsePriceKr(""), null);
  assert.equal(parsePriceKr("   "), null);
  assert.equal(parsePriceKr("abc"), null);
  assert.equal(parsePriceKr("-5"), null);
  assert.equal(parsePriceKr("1e10"), null);
  assert.equal(parsePriceKr("NaN"), null);
  assert.equal(parsePriceKr("Infinity"), null);
});

test("parsePriceKr accepts a plain non-negative number, with up to 2 decimals", () => {
  assert.equal(parsePriceKr("0"), 0);
  assert.equal(parsePriceKr("149"), 149);
  assert.equal(parsePriceKr("149.5"), 149.5);
  assert.equal(parsePriceKr("149.99"), 149.99);
  assert.equal(parsePriceKr("  159  "), 159);
});

test("parsePriceKr rejects more than 2 decimal places", () => {
  assert.equal(parsePriceKr("149.999"), null);
});

/* A blank max_m2 field is a deliberate "unbounded" (null); anything else
   that isn't a positive whole number must be an error, not a second,
   silent way to spell "unbounded". The fix round found `Number("abc")`
   (NaN) being written through as `null` via the old
   `raw === "" ? null : Number(raw)` shape — an unbounded plan by typo,
   which then wrongly captured recommendPlan's recommendation for every
   venue size once planForM2 started reading this column. */
test("parseMaxM2: blank means unbounded", () => {
  assert.deepEqual(parseMaxM2(""), { value: null });
  assert.deepEqual(parseMaxM2("   "), { value: null });
});

test("parseMaxM2: a positive whole number is accepted", () => {
  assert.deepEqual(parseMaxM2("100"), { value: 100 });
  assert.deepEqual(parseMaxM2("  150  "), { value: 150 });
});

test("parseMaxM2: non-numeric, negative, zero and fractional values are all rejected, not silently unbounded", () => {
  assert.equal(parseMaxM2("abc"), null);
  assert.equal(parseMaxM2("-5"), null);
  assert.equal(parseMaxM2("0"), null);
  assert.equal(parseMaxM2("100.5"), null);
  assert.equal(parseMaxM2("NaN"), null);
});

/* Blank-in-both-languages entries are dropped (this is also what absorbs a
   textarea's own trailing newline); blank-in-only-one-language entries are
   kept, since that's a real content gap for a translator, not something
   to silently discard. */
test("parseFeatures drops an entry blank in both languages", () => {
  const out = parseFeatures("A\n\nC", "One\n\nThree");
  assert.deepEqual(out, [
    { da: "A", en: "One" },
    { da: "C", en: "Three" },
  ]);
});

test("parseFeatures keeps an entry blank in only one language", () => {
  const out = parseFeatures("A\nB", "One\n");
  assert.deepEqual(out, [
    { da: "A", en: "One" },
    { da: "B", en: "" },
  ]);
});

test("parseFeatures absorbs a textarea's trailing newline without an extra blank entry", () => {
  const out = parseFeatures("A\nB\n", "One\nTwo\n");
  assert.deepEqual(out, [
    { da: "A", en: "One" },
    { da: "B", en: "Two" },
  ]);
});

test("parseFeatures on two entirely blank textareas produces no entries", () => {
  assert.deepEqual(parseFeatures("", ""), []);
  assert.deepEqual(parseFeatures("\n\n", "\n\n"), []);
});
