import { toOre, vatOre } from "./money.ts";
import { quote, type Billing, type Plan } from "./pricing.ts";

export type InvoiceLineDraft = {
  position: number;
  description: string;
  quantity: number;
  unitOre: number;
};

export type BuildLinesInput = {
  plan: Plan;
  billing: Billing;
  locations: number;
  /** ISO date, inclusive. */
  periodStart: string;
  /** ISO date, exclusive. */
  periodEnd: string;
};

/** `YYYY-NNNN`, zero-padded to four digits and allowed to grow past it. */
export function formatInvoiceNumber(year: number, n: number): string {
  return `${year}-${String(n).padStart(4, "0")}`;
}

const TERM_LABEL: Record<Billing, string> = {
  monthly: "monthly",
  annual: "annual",
};

/**
 * Turns a subscription into the lines of one invoice.
 *
 * Prices come from `quote()` rather than being re-derived here. That function
 * already applies the volume tiers and the annual discount, and already backs
 * both the public pricing page and the admin MRR figure; a second
 * implementation of the same arithmetic would disagree the first time a
 * discount changed.
 *
 * `quote()`'s `perLocation` is always a MONTHLY rate whatever the term, so an
 * annual invoice multiplies it by twelve. Missing that undercharges an annual
 * customer by a factor of twelve, which is the single most expensive mistake
 * available in this file.
 */
export function buildInvoiceLines(input: BuildLinesInput): InvoiceLineDraft[] {
  if (!Number.isInteger(input.locations) || input.locations < 1) {
    /* quote() clamps to a minimum of one location, so passing zero through
       would bill a phantom location rather than fail. A customer with no
       locations has nothing to invoice; that is a caller error, not a
       zero-amount invoice. Non-integer locations would make quantity * unitOre
       non-integral øre, violating the money-is-always-an-integer-number-of-øre
       constraint. */
    throw new Error("cannot invoice a customer with at least one location missing");
  }

  const q = quote(input.plan, input.billing, input.locations);
  const months = input.billing === "annual" ? 12 : 1;

  return [
    {
      position: 1,
      description: `${input.plan.name} — ${TERM_LABEL[input.billing]} — ${input.periodStart} to ${input.periodEnd}`,
      quantity: input.locations,
      unitOre: toOre(q.perLocation * months),
    },
  ];
}

/**
 * The lines are authoritative for the invoice's total, not `quote()`.
 *
 * `quote()` rounds to two decimal kroner at each step, so its `chargeExVat`
 * can differ from the sum of the lines by a few øre. Between the two, the
 * lines win: an invoice has to add up in the reader's hand, and a document
 * whose stated total is not the sum of its own rows is one a bookkeeper will
 * reject.
 */
export function lineTotals(lines: InvoiceLineDraft[]): {
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
} {
  const subtotalOre = lines.reduce((sum, l) => sum + l.quantity * l.unitOre, 0);
  const vat = vatOre(subtotalOre);
  return { subtotalOre, vatOre: vat, totalOre: subtotalOre + vat };
}
