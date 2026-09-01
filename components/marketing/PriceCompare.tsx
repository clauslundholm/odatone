import { HEADLINE_EXAMPLE, calculate, venueType } from "@/lib/rates";
import { ui } from "@/lib/content/common";
import { home } from "@/lib/content/home";
import { kr, m2 as fmtM2, num } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * One worked example, stated as plainly as possible: what three bills cost
 * today, and what one costs instead.
 */
export default function PriceCompare({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const l = locale;
  const r = calculate(HEADLINE_EXAMPLE);
  const v = venueType(HEADLINE_EXAMPLE.type);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
        <span className="u-num text-[clamp(1.5rem,3vw,2rem)] text-ink-3 line-through decoration-1">
          {kr(r.currentMonth, l)}
        </span>
        <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden="true" className="text-ink-3">
          <path d="M1 6h19M15.5 1.5 20.5 6l-5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="u-num u-gradient text-[clamp(2rem,4.5vw,3rem)]">
          {kr(r.odatoneMonth, l)}
        </span>
        <span className="u-label w-full sm:w-auto">
          {l === "da" ? "om måneden" : "a month"} · {v.label[l]}, {fmtM2(HEADLINE_EXAMPLE.m2, l)}
        </span>
      </div>
    );
  }

  const rows: [string, number][] = [
    ["Koda", r.kodaYear],
    ["Gramex", r.gramexYear],
    [l === "da" ? "Streamingtjeneste" : "Streaming service", r.streamingYear],
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="u-card-flat p-8 sm:p-10">
        <p className="u-label mb-8">
          {home.strip.before[l]} — {v.label[l]}, {fmtM2(HEADLINE_EXAMPLE.m2, l)}
        </p>
        <dl className="flex flex-col gap-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-[0.9375rem] text-ink-2">{label}</dt>
              <dd className="u-tabular text-[0.9375rem] text-ink">
                {kr(Math.round(value / 12), l)}
                <span className="ml-1 text-ink-3">/{l === "da" ? "md." : "mo"}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-6">
          <p className="u-label">{l === "da" ? "I alt" : "Total"}</p>
          <p className="u-num text-[clamp(2rem,4vw,2.75rem)] text-ink">{kr(r.currentMonth, l)}</p>
        </div>
      </div>

      <div className="u-card relative overflow-hidden p-8 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.14] blur-[70px]"
          style={{ background: "var(--g-brand)" }}
        />
        <p className="u-label mb-8 text-accent">{home.strip.after[l]}</p>
        <dl className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[0.9375rem] text-ink-2">Odatone Small Venue</dt>
            <dd className="u-tabular text-[0.9375rem] text-ink">
              {kr(r.odatoneMonth, l)}
              <span className="ml-1 text-ink-3">/{l === "da" ? "md." : "mo"}</span>
            </dd>
          </div>
          {["Koda", "Gramex"].map((label) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-[0.9375rem] text-ink-2">{label}</dt>
              <dd className="text-[0.9375rem] text-accent">
                {l === "da" ? "Indeholdt" : "Included"}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-6">
          <div>
            <p className="u-label">{l === "da" ? "Du sparer" : "You save"}</p>
            <p className="u-tabular mt-1 text-[0.8125rem] text-ink-3">
              {num(r.savingPct, l)} % · {kr(r.savingYear, l)}/{l === "da" ? "år" : "yr"}
            </p>
          </div>
          <p className="u-num u-gradient text-[clamp(2rem,4vw,2.75rem)]">
            {kr(r.savingMonth, l)}
          </p>
        </div>
        <p className="u-label mt-6 text-[0.6875rem]">{ui.indicative[l]}</p>
      </div>
    </div>
  );
}
