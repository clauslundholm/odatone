import { notFound } from "next/navigation";

import Seasons from "@/components/v4/Seasons";
import Shell from "@/components/v4/Shell";
import { isLocale, type Locale } from "@/lib/i18n";
import { activePlans } from "@/lib/plans-server";
import { kr } from "@/lib/format";
import { quote } from "@/lib/pricing";
import { hasSession, loadAccount } from "@/lib/v4/account";

/* Shared by the two localised routes below. The slug differs per language
   (/da/saesoner, /en/seasons) and Next cannot vary a path segment by a
   dynamic parent, so each slug gets a one-line route file and both render
   this. The alternative — folding them into [page] — would put them under
   the marketing chrome, and these belong inside the product shell. */
export async function renderSeasons(raw: string, expected: Locale) {
  if (!isLocale(raw) || raw !== expected) notFound();
  const locale: Locale = raw;

  const plans = await activePlans();
  const cheapest = plans.reduce<(typeof plans)[number] | null>(
    (low, p) => (!low || p.monthly < low.monthly ? p : low),
    null,
  );
  const priceFrom = cheapest ? kr(Math.round(quote(cheapest, "monthly", 1).perLocation), locale) : "—";

  const account = await loadAccount(locale);
  /* Not `account !== null`: that is also null for staff, who should
     not be shown the price pitch meant for visitors. */
  const signedIn = await hasSession();

  return (
    <Shell
      locale={locale}
      signedIn={signedIn}
      priceFrom={priceFrom}
      active="seasons"
      account={account?.chrome ?? null}
      lists={account?.lists ?? []}
    >
      <Seasons locale={locale} />
    </Shell>
  );
}
