import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import "../globals.css";

import { getPortalLocale } from "@/lib/portal-locale";
import { HTML_LANG } from "@/lib/i18n";

/**
 * The root layout for the whole /my-odatone tree — the customer portal's
 * front door (Task 14). Unlike app/admin/layout.tsx, this one is
 * bilingual: `lang` follows the visitor's own cookie-backed choice (see
 * lib/portal-locale.ts for why a cookie rather than a URL segment), so a
 * screen reader announces the right language even before either page's
 * own content renders.
 *
 * The title/description below are deliberately both languages at once,
 * matching app/global-not-found.tsx's own bilingual copy, rather than
 * switching per visitor — metadata is read by crawlers and share
 * previews as often as by the signed-in visitor themselves, and this
 * portal isn't indexed anyway (robots below).
 */
export const metadata: Metadata = {
  title: { default: "Mit Odatone / My Odatone", template: "%s — Odatone" },
  description: "Kundeportal for Odatone. / Customer portal for Odatone.",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "250x250" }],
    shortcut: "/favicon.png",
    apple: [{ url: "/favicon.png", sizes: "180x180" }],
  },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const locale = await getPortalLocale();

  return (
    <html lang={HTML_LANG[locale]} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
