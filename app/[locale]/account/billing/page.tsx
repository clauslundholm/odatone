import { accountMetadata, renderAccount } from "../../_account-page";

/* Only the locale this slug belongs to. Without it Next inherits the
   parent's [locale] params and prerenders the other language's copy of
   this path, which exists only to 404 — the same guard
   saesoner/seasons and spilleplan/schedule each carry. */
export function generateStaticParams() {
  return [{ locale: "en" }];
}

export const metadata = accountMetadata("en", "billing");

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderAccount(locale, "en", "billing");
}
