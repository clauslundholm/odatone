import { test } from "node:test";
import assert from "node:assert/strict";

import { toOre, toKroner, vatOre, invoiceTotals, formatDkk } from "../lib/money.ts";

test("converts kroner to øre without float drift", () => {
  assert.equal(toOre(149), 14900);
  assert.equal(toOre(199.99), 19999);
  // 0.1 + 0.2 territory: 8.115 * 100 is 811.4999... in binary floating point.
  assert.equal(toOre(8.115), 812);
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
  }
});

test("formats Danish and English", () => {
  assert.match(formatDkk(14900, "da"), /149/);
  assert.match(formatDkk(14900, "en"), /149/);
});
