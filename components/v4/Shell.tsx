"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";

import Wordmark from "@/components/ui/Wordmark";
import { LinkButton } from "@/components/ui/Button";
import { usePlayer } from "@/components/player/PlayerProvider";
import { MOODS, filterTracks, type Mood } from "@/lib/tracks";
import { MOOD_PHOTO } from "@/lib/v4/photos";
import { BUILDER_ID } from "@/lib/v4/anchors";
import { href, type Locale } from "@/lib/i18n";
import { v4 as t } from "@/lib/content/v4";
import ThemeToggle from "@/components/ThemeToggle";
import { listLook, listTile } from "@/lib/v4/list-look";
import {
  CalendarIcon,
  GripIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  SeasonIcon,
  SlidersIcon,
} from "./Icons";

/**
 * The chrome for the product-first landing page: a search bar across the
 * top, a standing left rail, and a slim footer under the main column.
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
  lists = [],
}: {
  locale: Locale;
  children: ReactNode;
  rail?: ReactNode;
  /** Which rail item is the current page. */
  active?: "home" | "search" | "build" | "schedule" | "seasons";
  /** The cheapest active plan, already formatted. Passed in because this
      is a client component and the plans come from the database. */
  priceFrom: string;
  /** The customer's saved lists, shown under "Dine lister" and draggable
      into the Ugeplan. Empty on every page that does not pass them. */
  lists?: { id: string; name: string; basedOn: string | null }[];
}) {
  const p = usePlayer();
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);

  const moodCounts = useMemo(() => {
    const out = {} as Record<Mood, number>;
    for (const m of MOODS) {
      out[m.id] = filterTracks({ ...p.filters, mood: m.id, genres: [] }).length;
    }
    return out;
  }, [p.filters]);

  /* The season and schedule slugs are localised and have no PageKey —
     they are product routes, outside the (site) group and outside SLUGS.

     Søg has no `to` at all. It used to point at /afspiller, and with that
     page gone the search field it would have sent you to is the one in
     this very header — so the item focuses it instead of navigating
     somewhere to find another. */
  const nav: {
    key: string;
    label: string;
    Icon: typeof HomeIcon;
    to?: string;
    onClick?: () => void;
  }[] = [
    { key: "home", label: t.rail.home[l], to: `/${l}`, Icon: HomeIcon },
    { key: "search", label: t.rail.search[l], onClick: () => search.current?.focus(), Icon: SearchIcon },
    {
      key: "schedule",
      label: t.schedule.heading[l],
      to: `/${l}/${l === "da" ? "spilleplan" : "schedule"}`,
      Icon: CalendarIcon,
    },
    {
      key: "seasons",
      label: t.rail.seasons[l],
      to: `/${l}/${l === "da" ? "saesoner" : "seasons"}`,
      Icon: SeasonIcon,
    },
    /* The builder lives in the front page's right rail (BUILDER_ID in
       components/v4/Landing.tsx), so from anywhere else this is a
       navigation and from the front page itself an anchor jump. */
    { key: "build", label: t.rail.build[l], to: `/${l}#${BUILDER_ID}`, Icon: SlidersIcon },
  ];

  return (
    /* Deliberately not min-h-dvh with a flex-1 row: that would stretch
       the rail card to the bottom of the window whatever the page holds,
       leaving a tall empty white column under the footer. Sized to its
       content, the row is as tall as the main column and the rail card
       ends level with it, with the price block at its foot. */
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-4 bg-bg/90 px-6 py-3.5 backdrop-blur">
        <Link href={`/${l}`} aria-label="Odatone" className="shrink-0">
          <Wordmark height={22} />
        </Link>

        <label className="relative mx-auto flex w-full max-w-[560px] items-center">
          <span className="sr-only">{t.search.label[l]}</span>
          <SearchIcon size={16} className="pointer-events-none absolute left-5 text-ink-3" />
          <input
            ref={search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder[l]}
            className="w-full rounded-full bg-surface-2 py-3 pl-12 pr-5 text-[0.875rem] text-ink outline-none transition-shadow placeholder:text-ink-3 focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
        </label>

        <nav className="ml-auto flex shrink-0 items-center gap-4">
          <ThemeToggle locale={l} />
          {/* The design has a "Priser" link here. There is no pricing
              page any more; the price lives in the rail's own block and
              in Kom i gang, so a link to a deleted page is not kept. */}
          <Link href="/my-odatone" className="text-[0.875rem] font-medium text-ink transition-opacity hover:opacity-70">
            {t.nav.login[l]}
          </Link>
          <LinkButton href={href(l, "signup")} size="sm">
            {t.nav.cta[l]}
          </LinkButton>
        </nav>
      </header>

      <div className="flex gap-5 px-6 pb-6">
        {/* The rail is a card, not a column of links on the page
            background — the same white surface the hero sits beside, and
            it runs the full height of the column rather than stopping
            under its last link. */}
        <aside className="hidden w-[232px] shrink-0 flex-col gap-6 rounded-[var(--radius-xl)] bg-surface p-4 lg:flex">
          <nav className="flex flex-col gap-0.5">
            {nav.map(({ key, label, to, Icon, onClick }) => {
              const on = key === active;
              const cls = `flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-2.5 text-left text-[0.9375rem] transition-colors ${
                on ? "bg-accent-soft font-semibold text-accent" : "font-medium text-ink hover:bg-surface-2"
              }`;
              const inner = (
                <>
                  <Icon size={18} className={on ? "text-accent" : "text-ink-2"} />
                  {label}
                </>
              );
              return to ? (
                <Link key={key} href={to} aria-current={on ? "page" : undefined} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button key={key} type="button" onClick={onClick} className={cls}>
                  {inner}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col gap-1">
            <p className="u-label px-4 pb-1 text-ink-3">{t.rail.moods[l]}</p>
            <ul className="flex flex-col gap-0.5">
              {MOODS.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => p.setFilters({ mood: m.id, genres: [] })}
                    aria-pressed={p.filters.mood === m.id}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-4 py-2 text-left transition-colors hover:bg-surface-2 ${
                      p.filters.mood === m.id ? "bg-surface-2" : ""
                    }`}
                  >
                    <img
                      src={MOOD_PHOTO[m.id]}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-[var(--radius-sm)] object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                        {m.label[l]}
                      </span>
                      <span className="block text-[0.8125rem] text-ink-3">
                        {t.rail.trackCount[l].replace("{n}", String(moodCounts[m.id]))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-1">
            <p className="u-label px-4 pb-1 text-ink-3">{t.rail.yourLists[l]}</p>

            {/* Drag sources for the Ugeplan, and nothing more: the item
                carries its id on the drag and the page that cares reads
                it off `dataTransfer`. No callback crosses into the rail,
                so the shell stays a server-rendered prop away from every
                page that does not schedule anything. */}
            {lists.map((list) => (
              <div
                key={list.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", list.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                title={t.rail.dragHint[l]}
                className="flex cursor-grab items-center gap-3 rounded-[var(--radius-md)] px-4 py-2 transition-colors hover:bg-surface-2 active:cursor-grabbing"
              >
                <span
                  aria-hidden="true"
                  className="h-11 w-11 shrink-0 rounded-[var(--radius-sm)]"
                  style={{ background: listTile(listLook(list)) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                    {list.name}
                  </span>
                  <span className="block text-[0.8125rem] text-ink-3">{t.rail.dragHint[l]}</span>
                </span>
                <GripIcon size={14} className="shrink-0 text-ink-3" />
              </div>
            ))}

            <Link
              href={href(l, "signup")}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-2 transition-colors hover:bg-surface-2"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-sm)] text-white"
                style={{ background: "var(--g-brand)" }}
              >
                <PlusIcon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-ink">
                  {t.rail.newList[l]}
                </span>
                <span className="block text-[0.8125rem] leading-snug text-ink-3">
                  {t.rail.newListNote[l]}
                </span>
              </span>
            </Link>
          </div>

          {/* The price shown is the cheapest ACTIVE plan, passed down from
              the server — not a figure typed here. The design's "149 kr."
              is Small Venue's, and Small Venue is no longer sold. */}
          <div className="mt-auto rounded-[var(--radius-lg)] bg-surface-2 p-5">
            <p className="u-num text-[1.0625rem] text-ink">{t.rail.priceFrom[l].replace("{price}", priceFrom)}</p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">{t.rail.priceNote[l]}</p>
          </div>
        </aside>

        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}

          {/* mt-auto, so on a short page — Spilleplan signed out, say —
              the footer drops to the foot of the row the rail sets
              rather than floating halfway up beside a full-length card. */}
          <footer className="mt-auto pt-10">
            <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-ink-3">
              <span>{t.footer.copyright[l]}</span>
              <Link href={href(l, "signup")} className="hover:text-ink">{t.footer.getStarted[l]}</Link>
              <Link href={href(l, "terms")} className="hover:text-ink">{t.footer.terms[l]}</Link>
              <Link href={href(l, "privacy")} className="hover:text-ink">{t.footer.privacy[l]}</Link>
              <Link href={href(l, "contact")} className="hover:text-ink">{t.footer.contact[l]}</Link>
            </p>
          </footer>
        </main>

        {rail && <aside className="hidden w-[320px] shrink-0 xl:block">{rail}</aside>}
      </div>
    </div>
  );
}
