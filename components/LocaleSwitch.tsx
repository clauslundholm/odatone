"use client";

import Link from "next/link";
import { LOCALES, LOCALE_SHORT, href, type Locale, type PageKey } from "@/lib/i18n";

export default function LocaleSwitch({
  locale,
  pageKey,
  className = "",
}: {
  locale: Locale;
  pageKey: PageKey | null;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5 ${className}`}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <Link
            key={l}
            href={href(l, pageKey)}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium leading-none transition-colors ${
              active ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
            }`}
          >
            {LOCALE_SHORT[l]}
          </Link>
        );
      })}
    </div>
  );
}
