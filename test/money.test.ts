import { test } from "node:test";
import assert from "node:assert/strict";

import { toOre, toKroner, vatOre, invoiceTotals, formatDkk } from "../lib/money.ts";

test("converts kroner to øre without float drift", () => {
  assert.equal(toOre(149), 14900);
  assert.equal(toOre(199.99), 19999);
  /* 1.005 * 100 is 100.49999999999999 in binary floating point, so a naive
     Math.round gives 100 — a whole øre lost. */
  assert.equal(toOre(1.005), 101);
});

test("converts back", () => {
  assert.equal(toKroner(14900), 149);
});

test("VAT is 25 percent, rounded to whole øre", () => {
  assert.equal(vatOre(14900), 3725);
  assert.equal(vatOre(1), 0);
  assert.equal(vatOre(2), 1);
});

test("invoice totals always add up", () => {
  const t = invoiceTotals(14900);
  assert.equal(t.subtotalOre + t.vatOre, t.totalOre);
});

test("invoice totals add up for every awkward subtotal", () => {
  for (let subtotal = 0; subtotal < 5000; subtotal += 7) {
    const t = invoiceTotals(subtotal);
    assert.equal(t.subtotalOre + t.vatOre, t.totalOre, `subtotal ${subtotal}`);
    // Verify VAT independently: subtotal * 25 / 100, rounded
    const expectedVat = Math.round((subtotal * 25) / 100);
    assert.equal(t.vatOre, expectedVat, `VAT for subtotal ${subtotal}`);
  }
});

test("formats Danish and English", () => {
  assert.match(formatDkk(14900, "da"), /149/);
  assert.match(formatDkk(14900, "en"), /149/);
});

test("toOre of small negative is normalized zero", () => {
  const result = toOre(-0.003);
  assert.ok(Object.is(result, 0), "should be positive zero, not negative zero");
  assert.equal(result, 0);
});

test("vatOre of negative subtotal is normalized zero", () => {
  const result = vatOre(-1);
  assert.ok(Object.is(result, 0), "should be positive zero, not negative zero");
  assert.equal(result, 0);
});

test("invoiceTotals of small negative subtotal returns normalized zero VAT", () => {
  // -1 * 25 / 100 = -0.25, which rounds to zero (or -0 without the fix)
  const t = invoiceTotals(-1);
  assert.ok(Object.is(t.vatOre, 0), "VAT should be positive zero, not negative zero");
  assert.equal(t.subtotalOre, -1);
  assert.equal(t.totalOre, -1); // -1 + 0 = -1
});
