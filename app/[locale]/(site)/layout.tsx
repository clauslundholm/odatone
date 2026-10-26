import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { isLocale, type Locale } from "@/lib/i18n";

/* The marketing chrome, moved off [locale]/layout.tsx so the v4 landing
   page can carry its own. v4 replaces both the header (it has a search
   field and a sidebar) and the footer (a single slim line), and two
   headers stacked is what you get if the shared layout keeps rendering
   one. Route groups do not affect the URL, so every page below here keeps
   the path it had. */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "da";
  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main">{children}</main>
      <SiteFooter locale={locale} />
    </>
  );
}
