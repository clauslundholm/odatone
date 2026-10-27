"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";

const OPTIONS = ["light", "system", "dark"] as const;

/**
 * Lys / System / Mørk, as three words rather than
 * components/admin/ThemeSegments' three glyphs: there is room for them
 * here, and a sun and a moon side by side need a tooltip to tell a
 * reader which one is currently on.
 *
 * `theme` is unknowable during SSR — it lives in localStorage — so
 * before mount no segment is marked selected. Guessing would light the
 * wrong one for a beat on every load for anyone whose choice is not the
 * default.
 */
export function ThemeChoice({ locale: l }: { locale: Locale }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const a = t.account.settings;
  const label = { light: a.themeLight[l], system: a.themeSystem[l], dark: a.themeDark[l] };

  return (
    <div
      role="radiogroup"
      aria-label={a.themeGroup[l]}
      className="inline-flex items-center gap-0.5 self-start rounded-full bg-surface-2 p-1"
    >
      {OPTIONS.map((value) => {
        const on = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(value)}
            className={`rounded-full px-3.5 py-1.5 text-[0.875rem] transition-colors ${
              on ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "font-medium text-ink-3 hover:text-ink"
            }`}
          >
            {label[value]}
          </button>
        );
      })}
    </div>
  );
}
