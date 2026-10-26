import { notFound } from "next/navigation";

import Landing, { Rail } from "@/components/v4/Landing";
import Shell from "@/components/v4/Shell";
import { LOCALES, isLocale, type Locale } from "@/lib/i18n";
import { activePlans } from "@/lib/plans-server";
import { kr } from "@/lib/format";
import { quote } from "@/lib/pricing";

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

  return (
    <Shell locale={locale} priceFrom={priceFrom} rail={<Rail locale={locale} />}>
      <Landing locale={locale} />
    </Shell>
  );
}
