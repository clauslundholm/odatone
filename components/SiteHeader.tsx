"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Wordmark from "@/components/ui/Wordmark";
import ThemeToggle from "@/components/ThemeToggle";
import LocaleSwitch from "@/components/LocaleSwitch";
import { LinkButton } from "@/components/ui/Button";
import { NAV, ui } from "@/lib/content/common";
import { href, keyFromSlug, type Locale, type PageKey } from "@/lib/i18n";

/**
 * A slim, translucent bar. It never goes solid — the blur does the work,
 * so the page appears to run underneath it.
 */
export default function SiteHeader({ locale }: { locale: Locale }) {

  const pathname = usePathname() ?? `/${locale}`;
  const slug = pathname.split("/").filter(Boolean)[1];
  const pageKey: PageKey | null = slug ? keyFromSlug(locale, slug) : null;
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="border-b border-line bg-bg/72 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 w-full max-w-[1320px] items-center gap-6 px-6 sm:h-[52px] sm:px-8">
          <Link
            href={href(locale, null)}
            aria-label="Odatone"
            className="shrink-0 transition-opacity hover:opacity-70"
          >
            <Wordmark height={17} />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = pageKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={href(locale, item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`text-[0.8125rem] font-normal tracking-[-0.005em] transition-opacity hover:opacity-100 ${
                    active ? "text-ink opacity-100" : "text-ink opacity-70"
                  }`}
                >
                  {item.label[locale]}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
            <div className="hidden sm:block">
              <LocaleSwitch locale={locale} pageKey={pageKey} />
            </div>
            <ThemeToggle locale={locale} />
            {/* The customer portal, not the player app this used to point
                at. /my-odatone rather than its /login: proxy.ts sends a
                visitor with no session to the login carrying ?next=, so a
                customer who is already signed in lands on their own page
                instead of a form they don't need. No locale segment —
                the portal takes its language from a cookie
                (lib/portal-locale.ts), defaulting to Danish. */}
            <Link
              href="/my-odatone"
              className="hidden text-[0.8125rem] text-ink opacity-70 transition-opacity hover:opacity-100 md:block"
            >
              {ui.logIn[locale]}
            </Link>
            <div className="hidden sm:block">
              <LinkButton href={href(locale, "signup")} variant="primary" size="sm">
                {ui.tryFree[locale]}
              </LinkButton>
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? ui.close[locale] : ui.menu[locale]}
              className="grid h-8 w-8 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2 lg:hidden"
            >
              <span className="relative block h-2.5 w-4">
                <span
                  className={`absolute left-0 block h-px w-4 bg-current transition-transform duration-300 ${
                    open ? "top-1 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-px w-4 bg-current transition-transform duration-300 ${
                    open ? "top-1 -rotate-45" : "top-2.5"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-b border-line bg-bg/95 backdrop-blur-2xl lg:hidden">
          <nav className="mx-auto flex max-w-[1320px] flex-col px-6 py-3 sm:px-8" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={href(locale, item.key)}
                className="border-b border-line py-3.5 text-[1.4rem] font-medium tracking-[-0.02em] text-ink transition-opacity hover:opacity-60"
              >
                {item.label[locale]}
              </Link>
            ))}
            <Link
              href={href(locale, "contact")}
              className="border-b border-line py-3.5 text-[1.4rem] font-medium tracking-[-0.02em] text-ink transition-opacity hover:opacity-60"
            >
              {locale === "da" ? "Kontakt salg" : "Talk to sales"}
            </Link>
            <div className="flex items-center gap-3 pt-5">
              <LocaleSwitch locale={locale} pageKey={pageKey} />
              <Link
                href="/my-odatone"
                className="rounded-full bg-surface-2 px-4 py-2 text-[0.8125rem] text-ink"
              >
                {ui.logIn[locale]}
              </Link>
            </div>
            <LinkButton href={href(locale, "signup")} variant="primary" size="lg" className="mt-4">
              {ui.startTrial[locale]}
            </LinkButton>
          </nav>
        </div>
      )}
    </header>
  );
}
