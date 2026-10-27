"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { signOutFromSite } from "@/app/[locale]/_account-actions";
import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";
import { accountHref, type AccountChrome, type AccountTab } from "@/lib/v4/account-routes";
import { CaretIcon, GearIcon, PinIcon, ReceiptIcon, SignOutIcon, UserIcon } from "./Icons";

const MENU: { tab: AccountTab; Icon: typeof UserIcon }[] = [
  { tab: "summary", Icon: UserIcon },
  { tab: "billing", Icon: ReceiptIcon },
  { tab: "locations", Icon: PinIcon },
  { tab: "settings", Icon: GearIcon },
];

/**
 * What the header shows once somebody is signed in: a monogram, the
 * company name, and the four account pages behind a caret.
 *
 * It stands exactly where the Log ind link and the "Prøv 8 dage gratis"
 * button stand for a visitor — one control replacing two — because those
 * two are the only thing the signed-out header offers and neither means
 * anything to a customer who is already paying.
 *
 * The menu closes on a navigation, on Escape and on a click outside, in
 * that order of likelihood. It is deliberately not a <dialog> or a
 * focus-trapped overlay: it is five links in a corner, and trapping focus
 * in it would make leaving it harder than arriving.
 */
export default function AccountChip({
  locale: l,
  account,
  /** True on the account pages themselves, where the chip is the current
      location rather than a way to leave. */
  current = false,
}: {
  locale: Locale;
  account: AccountChrome;
  current?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const menuId = useId();
  const a = t.account;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`${a.chipLabel[l]} — ${account.name}`}
        className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-2.5 transition-colors sm:gap-2.5 sm:pr-3 ${
          current || open ? "border-line-strong bg-surface-2" : "border-line hover:bg-surface-2"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.6875rem] font-semibold tracking-[0.02em] text-accent"
        >
          {account.initials}
        </span>
        <span className="hidden max-w-[160px] truncate text-[0.875rem] font-medium text-ink sm:block">
          {account.name}
        </span>
        <CaretIcon size={15} className="shrink-0 text-ink-3" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={a.chipLabel[l]}
          className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-[232px] flex-col gap-0.5 rounded-[var(--radius-lg)] bg-surface p-2 shadow-[var(--shadow-card)] ring-1 ring-line"
        >
          {/* Who is signed in, which the chip itself has no room for:
              below sm it has no name at all, and above sm it has the
              company but never the person. */}
          <div className="flex flex-col gap-0.5 px-3 pb-2 pt-1.5">
            <p className="truncate text-[0.875rem] font-semibold text-ink">{account.name}</p>
            {(account.email || account.roleLabel) && (
              <p className="truncate text-[0.8125rem] text-ink-3">
                {[account.email, account.roleLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span aria-hidden="true" className="mx-1 mb-1 h-px bg-line" />

          {MENU.map(({ tab, Icon }) => (
            <Link
              key={tab}
              href={accountHref(l, tab)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[0.875rem] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              <Icon size={16} className="text-ink-3" />
              {/* The first item is the account itself, not the tab it
                  happens to open on — the design names it "Konto". */}
              {tab === "summary" ? a.heading[l] : a.tabs[tab][l]}
            </Link>
          ))}

          <span aria-hidden="true" className="mx-1 my-1 h-px bg-line" />

          <form action={signOutFromSite}>
            <input type="hidden" name="locale" value={l} />
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left text-[0.875rem] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <SignOutIcon size={16} className="text-ink-3" />
              {a.signOut[l]}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
