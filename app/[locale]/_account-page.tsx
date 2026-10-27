import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Billing, type AccountInvoice } from "@/components/v4/account/Billing";
import { Head } from "@/components/v4/account/Head";
import { Locations } from "@/components/v4/account/Locations";
import { Settings } from "@/components/v4/account/Settings";
import { Summary } from "@/components/v4/account/Summary";
import Shell from "@/components/v4/Shell";
import { LinkButton } from "@/components/ui/Button";
import { fetchAllRows } from "@/lib/admin/paginate";
import { v4 as t } from "@/lib/content/v4";
import { kr } from "@/lib/format";
import { isLocale, type Locale } from "@/lib/i18n";
import { activePlans } from "@/lib/plans-server";
import { quote } from "@/lib/pricing";
import { isFallback, type Fallback } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { loadAccount, type Account, type AccountTab } from "@/lib/v4/account";

type InvoiceRow = {
  id: string;
  number: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string | null;
  total_ore: number;
  status: string;
  pdf_path: string | null;
};

/** Never indexed: four pages that are either a sign-in prompt or one
    customer's private figures. */
export function accountMetadata(locale: Locale, tab: AccountTab): Metadata {
  return {
    title: t.account.tabs[tab][locale],
    robots: { index: false, follow: false },
  };
}

/**
 * The account, inside the product shell exactly as the design draws it.
 *
 * The placement is the whole point. A customer's subscription, invoices
 * and rooms used to live at /my-odatone behind a sidebar of their own —
 * a second application wearing the same colours. Here they are four tabs
 * in the same column Spilleplan and Sæsoner use, under the same search
 * bar, beside the same library, above the same player. Signing in does
 * not take you somewhere else; it fills in the parts of this page that
 * were asking you to sign up.
 *
 * Like renderSchedule, this renders the shell for a visitor with no
 * session and asks them to sign in inside the content column, rather
 * than bouncing them to a login — which would be a dead end arrived at
 * from what looks like the public site. The rail, the search and the
 * player keep working, because none of those need an account.
 *
 * Nothing here uses the service role. Every row comes back through RLS
 * as whoever is asking (0003_tenancy.sql), so a signed-out read returns
 * an empty set by policy rather than by a check written here.
 */
export async function renderAccount(raw: string, expected: Locale, tab: AccountTab) {
  if (!isLocale(raw) || raw !== expected) notFound();
  const locale: Locale = raw;

  const plans = await activePlans();
  const cheapest = plans.reduce<(typeof plans)[number] | null>(
    (low, p) => (!low || p.monthly < low.monthly ? p : low),
    null,
  );
  const priceFrom = cheapest ? kr(Math.round(quote(cheapest, "monthly", 1).perLocation), locale) : "—";

  const account = await loadAccount(locale);

  if (!account) {
    return (
      <Shell locale={locale} priceFrom={priceFrom} active="account">
        <section className="u-card flex flex-col items-start gap-3 p-8">
          <h1 className="u-display text-[1.5rem]">{t.account.signedOutHeading[locale]}</h1>
          <p className="max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-2">
            {t.account.signedOutLede[locale]}
          </p>
          <LinkButton href="/my-odatone" size="md" className="mt-2">
            {t.account.signIn[locale]}
          </LinkButton>
        </section>
      </Shell>
    );
  }

  return (
    <Shell
      locale={locale}
      priceFrom={priceFrom}
      active="account"
      account={account.chrome}
      lists={account.lists}
    >
      <div className="flex flex-col gap-7">
        <Head locale={locale} account={account} tab={tab} />
        {tab === "summary" && <Summary locale={locale} account={account} />}
        {tab === "billing" && (
          <Billing locale={locale} account={account} invoices={await loadInvoices()} />
        )}
        {tab === "locations" && (
          <Locations locale={locale} account={account} fallbacks={await loadFallbacks(account)} />
        )}
        {tab === "settings" && <Settings locale={locale} account={account} />}
      </div>
    </Shell>
  );
}

/**
 * This customer's invoices, newest first.
 *
 * No `customer_id` filter of this function's own: `invoices_read`'s
 * `customer_id = auth_customer_id()` clause already narrows the table to
 * the caller's own customer, and an explicit `.eq()` here would be both
 * redundant and, built from the wrong value, a second way to misscope a
 * read RLS already guarantees.
 */
async function loadInvoices(): Promise<AccountInvoice[]> {
  const supabase = await createClient();
  const result = await fetchAllRows<InvoiceRow>(
    (from, to) =>
      supabase
        .from("invoices")
        .select("id, number, period_start, period_end, due_at, total_ore, status, pdf_path", {
          count: "exact",
        })
        .order("issued_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    "account: invoices",
  );
  if (result.error) console.error("[account] failed to read invoices", result.error);

  return result.rows.map((r) => ({
    id: r.id,
    number: r.number,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    dueAt: r.due_at,
    totalOre: r.total_ore,
    status: r.status,
    pdfPath: r.pdf_path,
  }));
}

/**
 * What each room plays when the week has nothing planned.
 *
 * Read on its own rather than alongside the other location columns so
 * that a database without 0016_schedule_per_location.sql applied — which
 * is the state of any deployment behind on migrations — loses only this
 * one panel instead of the whole page. Null means "could not read it",
 * and the tab then omits the panel rather than claiming silence.
 */
async function loadFallbacks(account: Account): Promise<Record<string, Fallback> | null> {
  if (account.locations.length === 0) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("locations").select("id, fallback");
  if (error) {
    console.error("[account] failed to read location fallbacks", error);
    return null;
  }

  const out: Record<string, Fallback> = {};
  for (const row of (data ?? []) as { id: string; fallback: string | null }[]) {
    /* The column is checked in the database, so an unknown value here
       means the check was widened without this being told. Fall back to
       silence rather than rendering a raw enum value. */
    out[row.id] = row.fallback && isFallback(row.fallback) ? row.fallback : "silence";
  }
  return out;
}
