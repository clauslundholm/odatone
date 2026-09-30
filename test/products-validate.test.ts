import { test } from "node:test";
import assert from "node:assert/strict";

import { parseFeatures, parseMaxM2, parsePriceKr, parseProductId } from "../app/admin/products/validate.ts";

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

/* monthly_ore is a Postgres `integer` (max 2,147,483,647), and toOre()
   (lib/money.ts) multiplies this value by 100 before storing it. Round 2's
   review drove `99999999` kr. live: it passed the shape check, overflowed
   the column on save (Postgres 22003), and the operator saw a generic
   "something went wrong" message that pointed nowhere near the price
   field and could never be fixed by retrying. The boundary here is exact,
   not rounded: 21474836.47 * 100 is precisely 2147483647; one more øre
   overflows. */
test("parsePriceKr accepts the largest price monthly_ore can store", () => {
  assert.equal(parsePriceKr("21474836.47"), 21474836.47);
});

test("parsePriceKr rejects one øre more than monthly_ore can store", () => {
  assert.equal(parsePriceKr("21474836.48"), null);
});

test("parsePriceKr rejects a price many orders of magnitude too large", () => {
  assert.equal(parsePriceKr("99999999"), null);
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

/* max_m2 is also a Postgres `integer`. Round 2's review drove
   `99999999999` m² live: same 22003 overflow, same generic message — worse
   here, since the message wasn't even about the field that was wrong. */
test("parseMaxM2 accepts the largest m² the integer column can store", () => {
  assert.deepEqual(parseMaxM2("2147483647"), { value: 2147483647 });
});

test("parseMaxM2 rejects one m² more than the integer column can store", () => {
  assert.equal(parseMaxM2("2147483648"), null);
});

test("parseMaxM2 rejects an m² many orders of magnitude too large", () => {
  assert.equal(parseMaxM2("99999999999"), null);
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

test("parseProductId accepts a slug", () => {
  assert.equal(parseProductId("arena"), "arena");
  assert.equal(parseProductId("arena-stage"), "arena-stage");
  assert.equal(parseProductId("stage2"), "stage2");
  assert.equal(parseProductId("a"), "a");
  // Surrounding whitespace is a typing artefact, not part of the id.
  assert.equal(parseProductId("  arena  "), "arena");
  assert.equal(parseProductId("x".repeat(32)), "x".repeat(32));
});

test("parseProductId rejects anything that would not survive a URL, a log line or a foreign key", () => {
  for (const bad of [
    "",
    "   ",
    "Arena", // uppercase: the id appears in ?p= and in audit rows verbatim
    "arena stage",
    "arena_stage",
    "arena-", // trailing hyphen
    "-arena", // leading hyphen
    "arena--stage", // double hyphen
    "2arena", // leading digit
    "arena.stage",
    "arena/stage",
    "árena",
    "arena!",
    "x".repeat(33),
  ]) {
    assert.equal(parseProductId(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});
