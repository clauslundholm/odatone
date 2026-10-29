import { notFound } from "next/navigation";

import Landing, { Rail } from "@/components/v4/Landing";
import Shell from "@/components/v4/Shell";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n";
import { activePlans } from "@/lib/plans-server";
import { kr } from "@/lib/format";
import { quote } from "@/lib/pricing";
import { hasSession, loadAccount, loadWeekNow } from "@/lib/v4/account";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * The product-first landing page — the v4 design. It replaces the previous
 * marketing home (hero, savings calculator, price comparison, proof tiles,
 * FAQ), which argued for the product; this one is the product.
 *
 * It carries its own chrome, which is why SiteHeader/SiteFooter moved to
 * (site)/layout.tsx and no longer wrap every route.
 *
 * Reading the session here is what takes this page off the prerender —
 * `loadAccountChrome` reaches for cookies, and a page whose output
 * depends on who is asking cannot be a file on a CDN. That is the price
 * of the signed-in front page the design asks for, and it is paid
 * knowingly: a customer who is already paying should not be met by
 * "Prøv 8 dage gratis" in the corner of their own player. Signed out it
 * costs one JWT check that touches no table (see loadAccount), and the
 * plan prices below are still served from `unstable_cache`, so the
 * twenty-five marketing pages under (site) keep prerendering exactly as
 * before — only this route and its three product siblings render per
 * request.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  /* The cheapest plan a visitor can actually buy, priced the same way the
     pricing page prices it. Not a constant: the design's "149 kr." is
     Small Venue's, and Small Venue is no longer in the catalogue. */
  const plans = await activePlans();
  const cheapest = plans.reduce<(typeof plans)[number] | null>(
    (low, p) => (!low || p.monthly < low.monthly ? p : low),
    null,
  );
  const priceFrom = cheapest
    ? kr(Math.round(quote(cheapest, "monthly", 1).perLocation), locale)
    : "—";

  const account = await loadAccount(locale);
  /* Not `account !== null`: that is also null for staff, who should
     not be shown the price pitch meant for visitors. */
  const signedIn = await hasSession();
  /* Only for a customer: the hero then reports their own week instead
     of selling the library, which is what the design asks for and what
     this extra read is for. */
  const week = account ? await loadWeekNow(account) : null;

  return (
    <Shell
      locale={locale}
      signedIn={signedIn}
      priceFrom={priceFrom}
      rail={<Rail locale={locale} signedIn={Boolean(account)} />}
      account={account?.chrome ?? null}
      lists={account?.lists ?? []}
    >
      <Landing locale={locale} week={week} />
    </Shell>
  );
}
