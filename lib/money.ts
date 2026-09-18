import { VAT_PCT } from "./pricing.ts";
import type { Locale } from "./i18n";
import { HTML_LANG } from "./i18n.ts";

/* Money is integer øre everywhere it is stored or added up. Kroner exist only
   at the two edges: the pricing maths in lib/pricing.ts, which predates this
   and the marketing site depends on, and the strings people read. */

/** Rounds half away from zero. Math.round(-0.5) is -0, which would make a
    credit note off by an øre. Normalise -0 away at the exit. */
const round = (n: number): number => {
  const r = n < 0 ? -Math.round(-n) : Math.round(n);
  /* -Math.round(0.3) is -0, which would render as "-0 kr." and store as a
     negative zero. Normalise it away at the one place it can appear. */
  return r === 0 ? 0 : r;
};

export function toOre(kroner: number): number {
  /* Convert to øre and apply toFixed to the product: 1.005 * 100 is
     100.49999999999999 in binary floating point, so a naive Math.round
     gives 100 (a whole øre lost). toFixed(4) stringifies and re-parses to
     discard the trailing noise before rounding. */
  return round(Number((kroner * 100).toFixed(4)));
}

export function toKroner(ore: number): number {
  return ore / 100;
}

export function vatOre(subtotalOre: number): number {
  return round((subtotalOre * VAT_PCT) / 100);
}

/** The total is derived, never independently rounded — that is how an invoice
    ends up a øre short of the sum of its own lines. */
export function invoiceTotals(subtotalOre: number) {
  const vat = vatOre(subtotalOre);
  return { subtotalOre, vatOre: vat, totalOre: subtotalOre + vat };
}

export function formatDkk(ore: number, locale: Locale): string {
  return new Intl.NumberFormat(HTML_LANG[locale], {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: ore % 100 === 0 ? 0 : 2,
  }).format(toKroner(ore));
}
