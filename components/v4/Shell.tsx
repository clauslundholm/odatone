"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

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
import { accountHref, listHref, type AccountChrome } from "@/lib/v4/account-routes";
import AccountChip from "./AccountChip";
import {
  CalendarIcon,
  GripIcon,
  CloseIcon,
  MenuIcon,
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
  account = null,
}: {
  locale: Locale;
  children: ReactNode;
  rail?: ReactNode;
  /** Which rail item is the current page. "account" highlights none of
      them: the account pages are reached from the header chip, not from
      the rail, and lighting up Spilleplan there would be a lie. */
  active?: "home" | "build" | "schedule" | "seasons" | "account";
  /** The cheapest active plan, already formatted. Passed in because this
      is a client component and the plans come from the database. */
  priceFrom: string;
  /** The customer's saved lists, shown under "Dine lister" and draggable
      into the Ugeplan. Empty on every page that does not pass them. */
  lists?: { id: string; name: string; basedOn: string | null }[];
  /** The signed-in customer, or null/absent for a visitor. Two things in
      this chrome change on it and nothing else does: the header's Log ind
      + trial pair becomes one account chip, and the rail's "from {price}"
      pitch becomes the plan they are already on. Everything between —
      search, moods, the player, the week — is the same product either
      way, which is the whole premise of putting the account in here
      rather than in a portal of its own. */
  account?: AccountChrome | null;
}) {
  const p = usePlayer();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  /* Closed by arriving somewhere, by Escape, and by the backdrop. A
     drawer that survives a navigation covers the page it just opened. */
  useEffect(() => setMenuOpen(false), [pathname]);

  /* The player and its dock are mounted in app/[locale]/layout.tsx,
     above this shell and outside it, so they cannot see who is signed
     in. Telling them from here is what keeps the free-trial countdown —
     and the expiry that pauses playback — away from a paying customer,
     without a session read in the layout taking every prerendered
     marketing page dynamic. */
  const { setSignedIn } = p;
  useEffect(() => setSignedIn(Boolean(account)), [setSignedIn, account]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    /* The page behind must not scroll under the drawer. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const moodCounts = useMemo(() => {
    const out = {} as Record<Mood, number>;
    for (const m of MOODS) {
      out[m.id] = filterTracks({ ...p.filters, mood: m.id, genres: [] }).length;
    }
    return out;
  }, [p.filters]);

  /* The season and schedule slugs are localised and have no PageKey —
     they are product routes, outside the (site) group and outside SLUGS.

     No Søg row: the search field is in the header of this very shell, on
     every page, so a rail item for it was a button whose only job was to
     move the cursor a few hundred pixels to its right. */
  const nav: {
    key: string;
    label: string;
    Icon: typeof HomeIcon;
    to?: string;
    onClick?: () => void;
  }[] = [
    { key: "home", label: t.rail.home[l], to: `/${l}`, Icon: HomeIcon },
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

  /* Defined once and rendered in two places — the standing column at lg
     and up, the drawer below it. Two copies would drift the first time a
     rail item changed. */
  const railBody = (
    <>
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
            /* A link AND a drag source. Dragging it onto the week is what
               the Ugeplan wants; clicking it opens the editor, which is
               the only way to reach /da/liste/<id> — until this existed,
               a saved list could be scheduled but never renamed or
               re-tuned. A drag still starts cleanly from an anchor, so
               the two do not fight. */
            <Link
              key={list.id}
              href={listHref(l, list.id)}
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
            </Link>
          ))}

          {/* Signed out this sells the profile a list needs; signed in
              there already is one, so it simply says where the list goes
              and leads to the builder rather than back to signup. */}
          <Link
            href={account ? `/${l}#${BUILDER_ID}` : href(l, "signup")}
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
                {account ? t.account.rail.newListNote[l] : t.rail.newListNote[l]}
              </span>
            </span>
          </Link>
        </div>

        {/* The same block, one pitch and one statement of fact. For a
            visitor it is the cheapest ACTIVE plan, passed down from the
            server — not a figure typed here, because the design's
            "149 kr." is Small Venue's and Small Venue is no longer sold.
            For a customer the pitch is already answered, so the space
            says what they are on and when it renews instead. */}
        {account ? (
          <div className="mt-auto flex flex-col gap-1 rounded-[var(--radius-lg)] bg-surface-2 p-5">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
              {t.account.rail.yourPlan[l]}
            </p>
            {account.plan ? (
              <>
                <Link
                  href={accountHref(l)}
                  className="text-[1.0625rem] font-semibold text-ink transition-opacity hover:opacity-70"
                >
                  {account.plan.name}
                </Link>
                <p className="u-num text-[0.8125rem] leading-relaxed text-ink-2">{account.plan.line}</p>
                {account.plan.renews && (
                  <p className="text-[0.8125rem] leading-relaxed text-ink-3">{account.plan.renews}</p>
                )}
              </>
            ) : (
              <Link
                href={accountHref(l)}
                className="text-[1.0625rem] font-semibold text-ink transition-opacity hover:opacity-70"
              >
                {t.account.rail.noPlan[l]}
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-auto rounded-[var(--radius-lg)] bg-surface-2 p-5">
            <p className="u-num text-[1.0625rem] text-ink">{t.rail.priceFrom[l].replace("{price}", priceFrom)}</p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">{t.rail.priceNote[l]}</p>
          </div>
        )}
    </>
  );

  return (
    /* Deliberately not min-h-dvh with a flex-1 row: that would stretch
       the rail card to the bottom of the window whatever the page holds,
       leaving a tall empty white column under the footer. Sized to its
       content, the row is as tall as the main column and the rail card
       ends level with it, with the price block at its foot. */
    <div className="flex flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-3 bg-bg/90 px-4 py-3.5 backdrop-blur sm:px-6">
        {/* The rail is the only navigation this chrome has, and below lg
            it is not on screen — so without this button a phone can
            reach the front page and nothing else. */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="oda-rail"
          aria-label={t.rail.menu[l]}
          className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2 lg:hidden"
        >
          <MenuIcon size={20} />
        </button>

        {/* Both marks, one shown per theme. The colour file leaves the
            "tone." letterforms unfilled, so they render black and vanish
            on a dark page; swapping by CSS rather than by reading the
            theme keeps this a server-rendered <img> with no flash. */}
        <Link href={`/${l}`} aria-label="Odatone" className="shrink-0">
          <span className="oda-mark-light">
            <Wordmark height={22} />
          </span>
          <span className="oda-mark-dark">
            <Wordmark height={22} tone="on-dark" />
          </span>
        </Link>

        <label className="relative order-last flex w-full items-center lg:order-none lg:mx-auto lg:max-w-[560px]">
          <span className="sr-only">{t.search.label[l]}</span>
          <SearchIcon size={16} className="pointer-events-none absolute left-5 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder[l]}
            className="w-full rounded-full bg-surface-2 py-3 pl-12 pr-5 text-[0.875rem] text-ink outline-none transition-shadow placeholder:text-ink-3 focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
        </label>

        <nav className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          <ThemeToggle locale={l} />
          {/* The design has a "Priser" link here. There is no pricing
              page any more; the price lives in the rail's own block and
              in Kom i gang, so a link to a deleted page is not kept. */}
          {account ? (
            <AccountChip locale={l} account={account} current={active === "account"} />
          ) : (
            <>
              <Link
                href="/my-odatone"
                className="hidden text-[0.875rem] font-medium text-ink transition-opacity hover:opacity-70 sm:block"
              >
                {t.nav.login[l]}
              </Link>
              <LinkButton href={href(l, "signup")} size="sm">
                <span className="sm:hidden">{t.nav.ctaShort[l]}</span>
                <span className="hidden sm:inline">{t.nav.cta[l]}</span>
              </LinkButton>
            </>
          )}
        </nav>
      </header>

      <div className="flex gap-5 px-6 pb-6">
        {/* The rail is a card, not a column of links on the page
            background — the same white surface the hero sits beside, and
            it runs the full height of the column rather than stopping
            under its last link. */}
        {/* Below lg the rail is not on screen, so the same content is
            what the drawer shows — one definition, not two that drift. */}
        <aside
          id="oda-rail"
          className="hidden w-[232px] shrink-0 flex-col gap-6 rounded-[var(--radius-xl)] bg-surface p-4 lg:flex"
        >
          {railBody}
        </aside>

        {/* main and the right rail share a column so the builder falls
            below the page on a phone instead of disappearing with the
            aside — "Byg din liste" in the nav has to lead somewhere. */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 xl:flex-row">

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

          {rail && <aside className="w-full shrink-0 xl:w-[320px]">{rail}</aside>}
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t.rail.closeMenu[l]}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.rail.menu[l]}
            className="oda-scroll absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-6 overflow-y-auto bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between">
              <Link href={`/${l}`} aria-label="Odatone" onClick={() => setMenuOpen(false)}>
                <span className="oda-mark-light">
                  <Wordmark height={20} />
                </span>
                <span className="oda-mark-dark">
                  <Wordmark height={20} tone="on-dark" />
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.rail.closeMenu[l]}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            {railBody}
            {/* The chip is in the header at every width, so the drawer
                does not repeat the account pages — only the sign-in link
                a visitor cannot otherwise reach below sm. */}
            {!account && (
              <Link
                href="/my-odatone"
                onClick={() => setMenuOpen(false)}
                className="rounded-[var(--radius-md)] px-4 py-2.5 text-[0.9375rem] font-medium text-ink hover:bg-surface-2 sm:hidden"
              >
                {t.nav.login[l]}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
