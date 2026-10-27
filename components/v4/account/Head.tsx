import Link from "next/link";

import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";
import { ACCOUNT_TABS, accountHref, longDate, type Account, type AccountTab } from "@/lib/v4/account";

/**
 * The account's own heading and the row of four tabs under it.
 *
 * The tabs are links, not a client-side switcher: each tab is a real URL
 * a customer can bookmark, send to a colleague, or land on from the
 * header chip's menu, and each loads only its own data — the invoice
 * list does not have to be read to look at the locations.
 */
export function Head({
  locale: l,
  account,
  tab,
}: {
  locale: Locale;
  account: Account;
  tab: AccountTab;
}) {
  const a = t.account;

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="u-display text-[1.75rem] tracking-[-0.02em]">{a.heading[l]}</h1>
        <p className="text-[0.875rem] text-ink-3">
          {a.subheading[l]
            .replace("{company}", account.customer.name)
            .replace("{date}", longDate(account.customer.createdAt, l))}
        </p>
      </div>

      <nav aria-label={a.tabsLabel[l]} className="-mx-1 flex min-w-0 gap-1 overflow-x-auto">
        {ACCOUNT_TABS.map((key) => {
          const on = key === tab;
          return (
            <Link
              key={key}
              href={accountHref(l, key)}
              aria-current={on ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-[0.9375rem] transition-colors ${
                on ? "bg-accent-soft font-semibold text-accent" : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {a.tabs[key][l]}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
