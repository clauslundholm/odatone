"use client";

import { useState } from "react";

import { PLANS, VOLUME_TIERS, quote, type Billing, type PlanId } from "@/lib/pricing";
import { ui } from "@/lib/content/common";
import { pricing } from "@/lib/content/pricing";
import { kr, num } from "@/lib/format";
import { href, type Locale } from "@/lib/i18n";
import { LinkButton } from "@/components/ui/Button";
import { CheckIcon } from "@/components/player/Icons";

export default function PricingTable({
  locale,
  recommended = "medium",
  showVolume = true,
}: {
  locale: Locale;
  recommended?: PlanId;
  showVolume?: boolean;
}) {
  const l = locale;
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-0.5 rounded-full bg-surface-2 p-1">
          {(["monthly", "annual"] as Billing[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              aria-pressed={billing === b}
              className={`rounded-full px-5 py-2 text-[0.875rem] font-medium transition-colors ${
                billing === b ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
              }`}
            >
              {b === "monthly" ? pricing.monthly[l] : pricing.annual[l]}
              {b === "annual" && <span className="ml-1.5 text-accent">−{num(45, l)} %</span>}
            </button>
          ))}
        </div>
        <p className="u-label">{ui.exVat[l]}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const q = quote(p.id, billing, 1);
          const featured = p.id === recommended;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col gap-7 rounded-[var(--radius-xl)] p-8 sm:p-9 ${
                featured
                  ? "bg-surface shadow-[var(--shadow-card)] ring-1 ring-accent/30"
                  : "u-card-flat"
              }`}
            >
              {featured && (
                <span className="absolute right-6 top-6 rounded-full bg-accent-soft px-3 py-1 text-[0.75rem] font-medium text-accent">
                  {pricing.mostPopular[l]}
                </span>
              )}
              <div>
                <h3 className="u-title text-[1.1875rem]">{p.name}</h3>
                <p className="mt-2 max-w-[28ch] text-[0.9375rem] text-ink-2">{p.tagline[l]}</p>
              </div>

              <div>
                <p className="u-num text-[clamp(2.2rem,4.5vw,2.9rem)]">
                  {kr(Math.round(q.perLocation), l)}
                </p>
                <p className="u-label mt-2">{ui.perMonthPerLocation[l]}</p>
                {billing === "annual" && (
                  <p className="u-tabular mt-2 text-[0.8125rem] text-accent">
                    {kr(Math.round(q.yearlyExVat), l)}/{l === "da" ? "år" : "yr"} ·{" "}
                    {pricing.billedAnnually[l]}
                  </p>
                )}
              </div>

              <ul className="flex flex-col gap-3 border-t border-line pt-7">
                {p.features.map((f) => (
                  <li key={f.da} className="flex items-start gap-3 text-[0.9375rem] text-ink-2">
                    <CheckIcon size={13} className="mt-1 shrink-0 text-accent" />
                    <span>{f[l]}</span>
                  </li>
                ))}
              </ul>

              <LinkButton
                href={`${href(l, "signup")}?plan=${p.id}&billing=${billing}`}
                variant={featured ? "primary" : "quiet"}
                size="md"
                className="mt-auto w-full"
              >
                {ui.startTrial[l]}
              </LinkButton>
            </div>
          );
        })}
      </div>

      {showVolume && (
        <div className="u-card-flat flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <p className="u-title mb-2 text-[1.0625rem]">{pricing.volumeHeading[l]}</p>
            <p className="max-w-[48ch] text-[0.9375rem] text-ink-2">{pricing.volumeBody[l]}</p>
          </div>
          <ul className="flex flex-wrap gap-x-10 gap-y-4">
            {VOLUME_TIERS.filter((t) => t.discountPct > 0).map((t) => (
              <li key={t.min}>
                <p className="u-num u-gradient text-[1.75rem]">−{num(t.discountPct, l)} %</p>
                <p className="u-label mt-1">{t.label[l]}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
