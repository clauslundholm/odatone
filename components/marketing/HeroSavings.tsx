"use client";

import { useEffect, useMemo, useState } from "react";

import { VENUE_TYPES, calculate, venueType, type VenueTypeId } from "@/lib/rates";
import { recommendPlan } from "@/lib/pricing";
import { DEFAULT_PROFILE, loadProfile, saveProfile, type VenueProfile } from "@/lib/profile";
import { home } from "@/lib/content/home";
import { ui } from "@/lib/content/common";
import { href, type Locale } from "@/lib/i18n";
import { kr, m2 as fmtM2 } from "@/lib/format";
import { TextLink } from "@/components/ui/Button";
import Counter from "@/components/ui/Counter";

/**
 * The savings claim, made specific in one tap. The choice is written to the
 * shared venue profile, so the calculator further down the page and step one
 * of the signup flow both open already filled in.
 */
const HERO_VENUES: VenueTypeId[] = ["cafe", "restaurant", "bar", "retail", "salon", "hotel"];

export default function HeroSavings({ locale }: { locale: Locale }) {
  const l = locale;
  const [profile, setProfile] = useState<VenueProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const pick = (id: VenueTypeId) => {
    const t = venueType(id);
    setProfile((prev) => {
      // A new type means a new sensible floor area; keep whatever the
      // visitor set themselves if they are re-picking the same one.
      const next: VenueProfile =
        prev.type === id ? prev : { ...prev, type: id, m2: t.defaultM2 };
      saveProfile(next);
      return next;
    });
  };

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

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-3">
        <p className="u-label">{home.hero.pickPrompt[l]}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {HERO_VENUES.map((id) => {
            const t = venueType(id);
            const active = profile.type === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-pressed={active}
                className={`rounded-full px-4 py-2 text-[0.875rem] font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-ink"
                    : "bg-surface-2 text-ink-2 hover:text-ink"
                }`}
              >
                {t.label[l]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="u-label">{home.hero.savingsLabel[l]}</p>
        <p className="u-num u-gradient text-[clamp(3.2rem,10vw,6rem)]">
          <Counter value={result.savingYear} locale={l} />
          <span className="ml-2 text-[0.28em] tracking-normal">
            {l === "da" ? "kr." : "kr."}
          </span>
        </p>
        <p className="text-[0.9375rem] text-ink-2">
          {home.hero.perYear[l]} ·{" "}
          {home.hero.todayLine[l]
            .replace("{today}", `${kr(result.currentMonth, l)}/${l === "da" ? "md." : "mo"}`)
            .replace("{ours}", `${kr(result.odatoneMonth, l)}/${l === "da" ? "md." : "mo"}`)}
        </p>
        <p className="u-label text-[0.75rem]">
          {v.label[l]}, {fmtM2(profile.m2, l)} · {ui.indicativeShort[l]}
        </p>
      </div>

      <TextLink href={`${href(l, "savings")}#calculator`}>{home.hero.calcLink[l]}</TextLink>
    </div>
  );
}
