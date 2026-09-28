import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInvoiceLines, lineTotals, formatInvoiceNumber } from "../lib/invoicing.ts";
import { PLANS, quote } from "../lib/pricing.ts";
import { toOre } from "../lib/money.ts";

const medium = PLANS.find((p) => p.id === "medium")!;

test("formats a gapless-looking invoice number", () => {
  assert.equal(formatInvoiceNumber(2026, 1), "2026-0001");
  assert.equal(formatInvoiceNumber(2026, 42), "2026-0042");
  assert.equal(formatInvoiceNumber(2026, 12345), "2026-12345");
});

test("one line per subscription, quantity is the location count", () => {
  const lines = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 2,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].position, 1);
  assert.equal(lines[0].quantity, 2);
});

test("an annual term bills twelve months, not one", () => {
  // quote()'s perLocation is always a MONTHLY rate. Billing an annual
  // subscription at perLocation would undercharge by a factor of twelve.
  const monthly = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 1,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  const annual = buildInvoiceLines({
    plan: medium, billing: "annual", locations: 1,
    periodStart: "2026-03-01", periodEnd: "2027-03-01",
  });
  const q = quote(medium, "annual", 1);
  assert.equal(annual[0].unitOre, toOre(q.perLocation * 12));
  // The bug this guards is "forgot to multiply by twelve", which would make
  // the annual unit equal to one annual-rate month. Do NOT assert a ratio
  // against the monthly unit: ANNUAL_DISCOUNT_PCT is 45, so an annual line is
  // ~6.6x a monthly one, not ~12x, and a ratio test silently encodes an
  // assumption about how deep the discount is.
  assert.notEqual(annual[0].unitOre, toOre(q.perLocation));
  assert.ok(annual[0].unitOre > monthly[0].unitOre);
});

test("the description names the plan and the period", () => {
  const [line] = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 3,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  assert.match(line.description, /Medium Stage/);
  assert.match(line.description, /2026-03-01/);
  assert.match(line.description, /2026-04-01/);
});

test("totals come from the lines, and always add up", () => {
  const lines = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 7,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  const t = lineTotals(lines);
  assert.equal(t.subtotalOre, lines[0].quantity * lines[0].unitOre);
  assert.equal(t.subtotalOre + t.vatOre, t.totalOre);
  assert.equal(t.vatOre, Math.round(t.subtotalOre * 0.25));
});

test("the line total never drifts far from quote()", () => {
  // quote() rounds to two decimal kroner at each step, so
  // toOre(perLocation) * n can differ from toOre(monthlyExVat) by a few øre.
  // The lines are authoritative -- an invoice must add up in the reader's
  // hand -- but the divergence must stay bounded and tiny.
  for (const plan of PLANS) {
    for (const billing of ["monthly", "annual"] as const) {
      for (let n = 1; n <= 40; n++) {
        const lines = buildInvoiceLines({
          plan, billing, locations: n,
          periodStart: "2026-03-01", periodEnd: "2026-04-01",
        });
        const q = quote(plan, billing, n);
        const drift = Math.abs(lineTotals(lines).subtotalOre - toOre(q.chargeExVat));
        assert.ok(drift <= n, `${plan.id}/${billing}/${n}: drift ${drift} øre exceeds ${n}`);
      }
    }
  }
});

test("refuses a customer with no locations", () => {
  // quote() clamps locations to a minimum of 1, so calling it naively would
  // invoice a phantom location for a customer who has none.
  assert.throws(
    () => buildInvoiceLines({
      plan: medium, billing: "monthly", locations: 0,
      periodStart: "2026-03-01", periodEnd: "2026-04-01",
    }),
    /at least one location/i,
  );
});
