import type { Locale } from "./i18n";

const NUM_LOCALE: Record<Locale, string> = { da: "da-DK", en: "en-GB" };

/** 14.772 (da) / 14,772 (en) — no currency symbol; we set the unit in copy. */
export function num(value: number, locale: Locale, decimals = 0): string {
  return new Intl.NumberFormat(NUM_LOCALE[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** "1.380 kr." — Danish businesses read kroner, not DKK, in both languages. */
export function kr(value: number, locale: Locale, decimals = 0): string {
  return `${num(value, locale, decimals)} kr.`;
}

export function perMonth(value: number, locale: Locale): string {
  return locale === "da" ? `${kr(value, locale)}/md.` : `${kr(value, locale)}/mo`;
}

export function perYear(value: number, locale: Locale): string {
  return locale === "da" ? `${kr(value, locale)}/år` : `${kr(value, locale)}/yr`;
}

export function pct(value: number, locale: Locale): string {
  return `${num(value, locale)} %`.replace(" %", locale === "da" ? " %" : "%");
}

export function m2(value: number, locale: Locale): string {
  return `${num(value, locale)} m²`;
}

export function clockTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
