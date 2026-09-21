"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { SunGlyph, SystemThemeGlyph, MoonGlyph } from "@/components/admin/icons";

/**
 * The three-way theme control in the sidebar's footer: light, system,
 * dark. The marketing site's components/ThemeToggle.tsx is a single button
 * that flips between two themes; inside the portal frame there is room to
 * show all three states at once, and "system" is worth offering to people
 * who keep a machine on a schedule.
 *
 * Rendered as a radiogroup rather than three toggle buttons because the
 * three are mutually exclusive — that is what lets a screen reader
 * announce "2 of 3" instead of three unrelated pressed/unpressed states.
 *
 * `theme` is unknowable during SSR (it lives in localStorage), so before
 * mount no segment is marked selected. Guessing would light up the wrong
 * one for a beat on every load for anyone whose choice is not the default.
 */
const OPTIONS = [
  { value: "light", Glyph: SunGlyph },
  { value: "system", Glyph: SystemThemeGlyph },
  { value: "dark", Glyph: MoonGlyph },
] as const;

export type ThemeSegmentLabels = {
  /** Names the group itself, e.g. "Theme" / "Tema". */
  group: string;
  light: string;
  system: string;
  dark: string;
};

export function ThemeSegments({ labels }: { labels: ThemeSegmentLabels }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
      <span className="text-[0.78125rem] text-ink-2">{labels.group}</span>
      {/* A rounded rectangle, not a pill: at 32px tall a fully-rounded track
          turns the outer two segments into lozenges and the control starts
          reading as three separate buttons rather than one switch. */}
      <div
        role="radiogroup"
        aria-label={labels.group}
        className="flex items-center gap-0.5 rounded-[8px] border border-line bg-surface-2 p-0.5"
      >
        {OPTIONS.map(({ value, Glyph }) => {
          const selected = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={labels[value]}
              title={labels[value]}
              onClick={() => setTheme(value)}
              className={`grid h-[26px] w-[30px] place-items-center rounded-[6px] transition-colors ${
                selected ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              <Glyph className="h-[15px] w-[15px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
