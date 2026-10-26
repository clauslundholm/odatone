import type { ReactNode } from "react";

import { LocaleSwitch } from "@/components/portal/LocaleSwitch";
import Wordmark from "@/components/ui/Wordmark";
import type { Locale } from "@/lib/i18n";

/**
 * The frame every signed-out portal screen sits in: dotted field, centred
 * card, language switch, wordmark.
 *
 * Extracted when password reset became a second screen that needs it. Two
 * hand-kept copies of this would drift the first time the card's radius or
 * the dot spacing changed, and the two screens are one step apart in the
 * same journey — a visitor goes from the sign-in card to the reset card and
 * back, so any difference between them reads as a glitch rather than as a
 * different page.
 */
export function AuthCard({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        backgroundImage: "radial-gradient(var(--c-line-strong) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-4">
        <LocaleSwitch locale={locale} className="justify-center" />
        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
          <div className="mb-6 flex justify-center">
            <Wordmark height={22} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
