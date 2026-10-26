import { renderSeasons } from "../_seasons-page";

/* Only the locale this slug belongs to. Without it Next inherits the
   parent's [locale] params and prerenders /da/seasons as well, which
   exists only to 404. */
export function generateStaticParams() {
  return [{ locale: "en" }];
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderSeasons(locale, "en");
}
