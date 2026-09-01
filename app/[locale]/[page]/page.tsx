import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LOCALES, PAGE_KEYS, SLUGS, isLocale, keyFromSlug, type Locale } from "@/lib/i18n";
import { meta } from "@/lib/content/meta";

import PlayerPage from "@/components/pages/PlayerPage";
import SavingsPage from "@/components/pages/SavingsPage";
import PricingPage from "@/components/pages/PricingPage";
import ArtistsPage from "@/components/pages/ArtistsPage";
import AboutPage from "@/components/pages/AboutPage";
import ContactPage from "@/components/pages/ContactPage";
import SignupPage from "@/components/pages/SignupPage";
import LegalPage from "@/components/pages/LegalPage";

/**
 * One dynamic route serves every content page, so slugs can be localised
 * (/da/priser and /en/pricing) while the pages stay statically generated
 * and the language switcher only has to resolve a page key.
 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    PAGE_KEYS.map((key) => ({ locale, page: SLUGS[key][locale] })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}): Promise<Metadata> {
  const { locale, page } = await params;
  if (!isLocale(locale)) return {};
  const key = keyFromSlug(locale, page);
  if (!key) return {};
  return {
    title: meta[key].title[locale],
    description: meta[key].description[locale],
    alternates: {
      canonical: `/${locale}/${SLUGS[key][locale]}`,
      languages: {
        "da-DK": `/da/${SLUGS[key].da}`,
        "en-GB": `/en/${SLUGS[key].en}`,
      },
    },
    openGraph: {
      title: meta[key].title[locale],
      description: meta[key].description[locale],
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale)) notFound();
  const l: Locale = locale;
  const key = keyFromSlug(l, page);

  switch (key) {
    case "player":
      return <PlayerPage locale={l} />;
    case "savings":
      return <SavingsPage locale={l} />;
    case "pricing":
      return <PricingPage locale={l} />;
    case "artists":
      return <ArtistsPage locale={l} />;
    case "about":
      return <AboutPage locale={l} />;
    case "contact":
      return <ContactPage locale={l} />;
    case "signup":
      return <SignupPage locale={l} />;
    case "privacy":
      return <LegalPage locale={l} kind="privacy" />;
    case "terms":
      return <LegalPage locale={l} kind="terms" />;
    default:
      notFound();
  }
}
