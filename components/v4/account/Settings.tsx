import Link from "next/link";

import { signOutFromSite } from "@/app/[locale]/_account-actions";
import { v4 as t } from "@/lib/content/v4";
import { LOCALE_LABEL, LOCALES, type Locale } from "@/lib/i18n";
import { accountHref, type Account } from "@/lib/v4/account";
import { SettingsForm } from "./SettingsForm";
import { ThemeChoice } from "./ThemeChoice";

/**
 * Indstillinger: the billing details on the left, everything about this
 * browser and this login on the right.
 *
 * The design's third preference group — three notification toggles
 * (invoice ready, new seasons, weekly digest) — is deliberately not
 * here. There is no table to store the choice in and nothing that sends
 * any of those three emails, so each switch would be a control that
 * remembers nothing and promises mail that never arrives. It belongs
 * with the sender, not ahead of it.
 */
export function Settings({ locale: l, account }: { locale: Locale; account: Account }) {
  const a = t.account.settings;
  const other = LOCALES;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SettingsForm
        locale={l}
        canEdit={account.canEdit}
        companyName={account.customer.name}
        initial={{
          billingEmail: account.customer.billingEmail,
          cvr: account.customer.cvr ?? "",
          address: account.customer.address ?? "",
          postcode: account.customer.postcode ?? "",
          city: account.customer.city ?? "",
          phone: account.customer.phone ?? "",
        }}
      />

      <div className="flex flex-col gap-6">
        <section className="u-card flex flex-col">
          <header className="border-b border-line px-6 py-4">
            <h2 className="text-[0.9375rem] font-semibold text-ink">{a.prefsPanel[l]}</h2>
          </header>
          <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                {a.languageGroup[l]}
              </p>
              {/* Links, not a cookie: on the site the language IS the URL
                  (/da/konto, /en/account), so switching it is a
                  navigation to the same tab in the other language and
                  the browser's back button does the obvious thing. */}
              <div className="inline-flex items-center gap-0.5 self-start rounded-full bg-surface-2 p-1">
                {other.map((to) => {
                  const on = to === l;
                  return (
                    <Link
                      key={to}
                      href={accountHref(to, "settings")}
                      aria-current={on ? "true" : undefined}
                      className={`rounded-full px-3.5 py-1.5 text-[0.875rem] transition-colors ${
                        on
                          ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "font-medium text-ink-3 hover:text-ink"
                      }`}
                    >
                      {LOCALE_LABEL[to]}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                {a.themeGroup[l]}
              </p>
              <ThemeChoice locale={l} />
            </div>
          </div>
        </section>

        <section className="u-card flex flex-col">
          <header className="border-b border-line px-6 py-4">
            <h2 className="text-[0.9375rem] font-semibold text-ink">{a.securityPanel[l]}</h2>
          </header>
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                {a.email[l]}
              </p>
              <p className="truncate text-[0.9375rem] text-ink">{account.email ?? "—"}</p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                  {a.password[l]}
                </p>
                {/* The design shows "Sidst ændret 4. marts 2026". Nothing
                    records when a password last changed — GoTrue does not
                    expose it on the session — so the line says what will
                    happen instead of a date that would be invented. */}
                <p className="text-[0.9375rem] text-ink-2">{a.passwordNote[l]}</p>
              </div>
              <Link
                href="/my-odatone/nulstil"
                className="shrink-0 rounded-full border border-line-strong px-3.5 py-1.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface-2"
              >
                {a.changePassword[l]}
              </Link>
            </div>

            <form action={signOutFromSite} className="border-t border-line pt-5">
              <input type="hidden" name="locale" value={l} />
              <button
                type="submit"
                className="text-[0.9375rem] font-medium text-bad underline-offset-2 hover:underline"
              >
                {t.account.signOut[l]}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
