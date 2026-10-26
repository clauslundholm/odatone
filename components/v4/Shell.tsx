"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import Wordmark from "@/components/ui/Wordmark";
import { LinkButton } from "@/components/ui/Button";
import { usePlayer } from "@/components/player/PlayerProvider";
import { MOODS, filterTracks, type Mood } from "@/lib/tracks";
import { href, type Locale } from "@/lib/i18n";
import { v4 as t } from "@/lib/content/v4";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * The chrome for the product-first landing page: a search bar across the
 * top, a standing left rail, and a slim footer.
 *
 * It replaces SiteHeader/SiteFooter for this page rather than sitting
 * under them — which is why the marketing chrome moved into
 * app/[locale]/(site)/layout.tsx. Two headers stacked is what you get
 * otherwise.
 *
 * Mood counts come from the same `filterTracks` the player filters with,
 * so the number beside "Rolig" is the number of tracks choosing Rolig
 * would actually queue. A hand-written count would be wrong the first time
 * the catalogue changed, and the catalogue is about to change completely
 * (docs/1000trax-api-requirements.md).
 */
export default function Shell({
  locale: l,
  children,
  rail,
  priceFrom,
  active = "home",
}: {
  locale: Locale;
  children: ReactNode;
  rail?: ReactNode;
  /** Which rail item is the current page. */
  active?: "home" | "search" | "build" | "schedule" | "seasons";
  /** The cheapest active plan, already formatted. Passed in because this
      is a client component and the plans come from the database. */
  priceFrom: string;
}) {
  const p = usePlayer();
  const [query, setQuery] = useState("");

  const moodCounts = useMemo(() => {
    const out = {} as Record<Mood, number>;
    for (const m of MOODS) {
      out[m.id] = filterTracks({ ...p.filters, mood: m.id, genres: [] }).length;
    }
    return out;
  }, [p.filters]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-bg/90 px-5 py-3 backdrop-blur">
        <Link href={`/${l}`} aria-label="Odatone" className="shrink-0">
          <Wordmark height={20} />
        </Link>

        <label className="relative mx-auto flex w-full max-w-[520px] items-center">
          <span className="sr-only">{t.search.label[l]}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder[l]}
            className="w-full rounded-full border border-line bg-surface-2 px-5 py-2.5 text-[0.875rem] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
        </label>

        <nav className="ml-auto flex shrink-0 items-center gap-3">
          <ThemeToggle locale={l} />
          <Link href={href(l, "pricing")} className="u-link text-[0.875rem]">
            {t.nav.pricing[l]}
          </Link>
          <Link href="/my-odatone" className="u-link text-[0.875rem]">
            {t.nav.login[l]}
          </Link>
          <LinkButton href={href(l, "signup")} size="sm">
            {t.nav.cta[l]}
          </LinkButton>
        </nav>
      </header>

      <div className="flex flex-1 gap-5 p-5">
        <aside className="hidden w-[232px] shrink-0 flex-col gap-7 lg:flex">
          <nav className="flex flex-col gap-1">
            {[
              { key: "home", label: t.rail.home[l], to: `/${l}` },
              { key: "search", label: t.rail.search[l], to: href(l, "player") },
              { key: "build", label: t.rail.build[l], to: href(l, "player") },
              /* The season slug is localised and has no PageKey — it is a
                 product route, not a marketing page, so it lives outside
                 the (site) group and outside SLUGS. */
              { key: "schedule", label: t.schedule.heading[l], to: `/${l}/${l === "da" ? "spilleplan" : "schedule"}` },
              { key: "seasons", label: t.rail.seasons[l], to: `/${l}/${l === "da" ? "saesoner" : "seasons"}` },
            ].map((item) => (
              <Link
                key={item.key}
                href={item.to}
                aria-current={item.key === active ? "page" : undefined}
                className={`rounded-[var(--radius-md)] px-4 py-2.5 text-[0.875rem] transition-colors ${
                  item.key === active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2">
            <p className="u-label px-4 text-ink-3">{t.rail.moods[l]}</p>
            <ul className="flex flex-col gap-0.5">
              {MOODS.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => p.setFilters({ mood: m.id, genres: [] })}
                    aria-pressed={p.filters.mood === m.id}
                    className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-2.5 text-left transition-colors hover:bg-surface-2 ${
                      p.filters.mood === m.id ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="text-[0.875rem] text-ink">{m.label[l]}</span>
                    <span className="u-label text-ink-3">{moodCounts[m.id]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* The price shown is the cheapest ACTIVE plan, passed down from
              the server — not a figure typed here. The design's "149 kr."
              is Small Venue's, and Small Venue is no longer sold. */}
          <div className="mt-auto rounded-[var(--radius-lg)] bg-surface-2 p-5">
            <p className="u-num text-[1.0625rem] text-ink">{t.rail.priceFrom[l].replace("{price}", priceFrom)}</p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">{t.rail.priceNote[l]}</p>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>

        {rail && <aside className="hidden w-[320px] shrink-0 xl:block">{rail}</aside>}
      </div>

      <footer className="border-t border-line px-6 py-5">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-ink-3">
          <span>{t.footer.copyright[l]}</span>
          <Link href={href(l, "pricing")} className="hover:text-ink">{t.nav.pricing[l]}</Link>
          <Link href={href(l, "about")} className="hover:text-ink">{t.footer.about[l]}</Link>
          <Link href={href(l, "terms")} className="hover:text-ink">{t.footer.terms[l]}</Link>
          <Link href={href(l, "privacy")} className="hover:text-ink">{t.footer.privacy[l]}</Link>
          <Link href={href(l, "contact")} className="hover:text-ink">{t.footer.contact[l]}</Link>
        </p>
      </footer>
    </div>
  );
}
