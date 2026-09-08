"use client";

import { useEffect, useMemo, useState } from "react";

import {
  HOURS_BANDS,
  STREAMING_MONTHLY_DEFAULT,
  VENUE_TYPES,
  calculate,
  venueType,
  type HoursBand,
  type VenueTypeId,
} from "@/lib/rates";
import { recommendPlan } from "@/lib/pricing";
import { DEFAULT_PROFILE, loadProfile, saveProfile, type VenueProfile } from "@/lib/profile";
import { savings as savingsDefaults } from "@/lib/content/savings";
import { ui as uiDefaults } from "@/lib/content/common";
import { useCopy } from "@/components/CopyProvider";
import { href, type Locale } from "@/lib/i18n";
import { kr, m2 as fmtM2, num } from "@/lib/format";
import { LinkButton, TextLink } from "@/components/ui/Button";
import Counter from "@/components/ui/Counter";

export default function Calculator({
  locale,
  compact = false,
  id,
}: {
  locale: Locale;
  compact?: boolean;
  id?: string;
}) {
  const savings = useCopy(savingsDefaults);
  const ui = useCopy(uiDefaults);

  const l = locale;
  const [profile, setProfile] = useState<VenueProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveProfile(profile);
  }, [profile, hydrated]);

  const v = venueType(profile.type);
  const plan = useMemo(
    () => recommendPlan(profile.m2, profile.type),
    [profile.m2, profile.type],
  );

  const result = useMemo(
    () =>
      calculate({
        type: profile.type,
        m2: profile.m2,
        hours: profile.hours,
        locations: profile.locations,
        includeStreaming: profile.includeStreaming,
        odatonePerLocationMonth: plan.monthly,
      }),
    [profile, plan],
  );

  const set = (patch: Partial<VenueProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const pickType = (id: VenueTypeId) => {
    const t = venueType(id);
    setProfile((p) => ({ ...p, type: id, m2: Math.min(Math.max(p.m2, t.minM2), t.maxM2) }));
  };

  const bars = [
    { label: savings.koda[l], value: result.kodaYear },
    { label: savings.gramex[l], value: result.gramexYear },
    ...(result.streamingYear > 0
      ? [{ label: savings.streaming[l], value: result.streamingYear }]
      : []),
  ];
  const maxBar = Math.max(result.currentYear, 1);

  return (
    <div id={id} className="u-card grid overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------- inputs ---------------- */}
      <div className="flex flex-col gap-9 p-8 sm:p-10">
        <fieldset>
          <legend className="u-label mb-4">{savings.venueType[l]}</legend>
          <div className="flex flex-wrap gap-2">
            {VENUE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickType(t.id)}
                aria-pressed={profile.type === t.id}
                className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-colors ${
                  profile.type === t.id
                    ? "bg-accent text-accent-ink"
                    : "bg-surface-2 text-ink-2 hover:text-ink"
                }`}
              >
                {t.label[l]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-3">{v.note[l]}</p>
        </fieldset>

        <fieldset>
          <div className="mb-3 flex items-baseline justify-between">
            <legend className="u-label">{savings.area[l]}</legend>
            <span className="u-num text-[1.5rem]">{fmtM2(profile.m2, l)}</span>
          </div>
          <input
            type="range"
            className="oda-range"
            min={v.minM2}
            max={v.maxM2}
            step={5}
            value={profile.m2}
            aria-label={savings.area[l]}
            style={{
              ["--fill" as string]: `${((profile.m2 - v.minM2) / (v.maxM2 - v.minM2)) * 100}%`,
            }}
            onChange={(e) => set({ m2: Number(e.target.value) })}
          />
          <div className="u-tabular flex justify-between pt-1 text-[0.75rem] text-ink-3">
            <span>{fmtM2(v.minM2, l)}</span>
            <span>{fmtM2(v.maxM2, l)}</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="u-label mb-3">{savings.hours[l]}</legend>
          <div className="flex gap-0.5 rounded-full bg-surface-2 p-1">
            {HOURS_BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => set({ hours: b.id as HoursBand })}
                aria-pressed={profile.hours === b.id}
                className={`flex-1 rounded-full px-3 py-2 text-[0.8125rem] font-medium leading-tight transition-colors ${
                  profile.hours === b.id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {b.label[l]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <fieldset>
            <legend className="u-label mb-3">{savings.locations[l]}</legend>
            <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
              <Stepper
                sign="−"
                label="-1"
                onClick={() => set({ locations: Math.max(1, profile.locations - 1) })}
                disabled={profile.locations <= 1}
              />
              <span className="u-num w-12 text-center text-[1.25rem]">
                {num(profile.locations, l)}
              </span>
              <Stepper
                sign="+"
                label="+1"
                onClick={() => set({ locations: Math.min(99, profile.locations + 1) })}
                disabled={profile.locations >= 99}
              />
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 pb-1">
            <input
              type="checkbox"
              checked={profile.includeStreaming}
              onChange={(e) => set({ includeStreaming: e.target.checked })}
              className="peer sr-only"
            />
            <span
              className={`relative grid h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                profile.includeStreaming ? "bg-accent" : "bg-surface-3"
              }`}
            >
              <span
                className={`absolute h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                  profile.includeStreaming ? "left-[20px]" : "left-[2px]"
                }`}
              />
            </span>
            <span className="max-w-[24ch] text-[0.8125rem] leading-snug text-ink-2">
              {savings.streamingLine[l]}{" "}
              <span className="u-tabular text-ink-3">
                ({kr(STREAMING_MONTHLY_DEFAULT, l)}/{l === "da" ? "md." : "mo"})
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ---------------- result ---------------- */}
      <div className="flex flex-col gap-8 bg-surface-2/60 p-8 sm:p-10">
        <div>
          <p className="u-label mb-3">{savings.youSave[l]}</p>
          <p className="u-num u-gradient text-[clamp(2.8rem,8vw,4.5rem)]">
            <Counter value={result.savingYear} locale={l} />
            <span className="ml-2 text-[0.3em] tracking-normal">
              {l === "da" ? "kr. om året" : "kr. a year"}
            </span>
          </p>
          <p className="mt-3 text-[0.9375rem] text-ink-2">
            {kr(result.savingMonth, l)} {savings.perMonthShort[l]} ·{" "}
            <span className="text-accent">{num(result.savingPct, l)} %</span>{" "}
            {savings.ofYourBill[l]}
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-7">
          <div className="flex items-baseline justify-between">
            <p className="u-label">{savings.todayHeading[l]}</p>
            <p className="u-num text-[1.25rem]">{kr(result.currentYear, l)}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[0.8125rem] text-ink-2">{b.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-2 rounded-full bg-ink-3 transition-[width] duration-500"
                    style={{ width: `${(b.value / maxBar) * 100}%` }}
                  />
                </span>
                <span className="u-tabular w-24 shrink-0 text-right text-[0.8125rem] text-ink-2">
                  {kr(b.value, l)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-7">
          <div className="flex items-baseline justify-between">
            <p className="u-label text-accent">{savings.withOdatone[l]}</p>
            <p className="u-num text-[1.25rem] text-accent">{kr(result.odatoneYear, l)}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-[0.8125rem] text-ink-2">
                {savings.subscription[l]}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="block h-2 rounded-full transition-[width] duration-500"
                  style={{
                    width: `${(result.odatoneYear / maxBar) * 100}%`,
                    background: "var(--g-brand)",
                  }}
                />
              </span>
              <span className="u-tabular w-24 shrink-0 text-right text-[0.8125rem] text-ink-2">
                {kr(result.odatoneYear, l)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-[0.8125rem] text-ink-2">
                {savings.licences[l]}
              </span>
              <span className="h-2 flex-1 rounded-full bg-surface-3" />
              <span className="u-tabular w-24 shrink-0 text-right text-[0.8125rem] text-accent">
                {savings.none[l]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-line pt-7">
          <p className="text-[0.9375rem] text-ink-2">
            <span className="u-label mr-2 inline">{savings.recommended[l]}</span>
            <span className="u-title text-[1rem] text-ink">{plan.name}</span>
            <span className="u-tabular ml-2 text-ink-3">
              {kr(plan.monthly, l)} {ui.perMonthPerLocation[l]}
            </span>
          </p>
          {!compact && (
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
              <LinkButton href={href(l, "signup")} variant="primary" size="md">
                {savings.ctaWithNumbers[l]}
              </LinkButton>
              <TextLink href={href(l, "pricing")}>{savings.ctaSecondary[l]}</TextLink>
            </div>
          )}
          <p className="text-[0.75rem] leading-relaxed text-ink-3">{ui.indicative[l]}</p>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  sign,
  label,
  onClick,
  disabled,
}: {
  sign: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full text-[1.0625rem] text-ink-2 transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      {sign}
    </button>
  );
}
