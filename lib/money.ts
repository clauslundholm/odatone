import { VAT_PCT } from "./pricing.ts";
import type { Locale } from "./i18n";

/* Money is integer øre everywhere it is stored or added up. Kroner exist only
   at the two edges: the pricing maths in lib/pricing.ts, which predates this
   and the marketing site depends on, and the strings people read. */

/** Rounds half away from zero. Math.round(-0.5) is -0, which would make a
    credit note off by an øre. */
const round = (n: number): number => (n < 0 ? -Math.round(-n) : Math.round(n));

export function toOre(kroner: number): number {
  /* toFixed before multiplying: 8.115 * 100 is 811.4999999999999 in binary
     floating point, which rounds down to the wrong answer. */
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
  return new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: ore % 100 === 0 ? 0 : 2,
  }).format(toKroner(ore));
}
