import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "../globals.css";

import { HTML_LANG, LOCALES, isLocale, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { meta } from "@/lib/content/meta";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PlayerProvider from "@/components/player/PlayerProvider";
import PlayerDock, { DockSpacer } from "@/components/player/PlayerDock";
import EditorShell from "@/components/dev/EditorShell";
import { CopyProvider } from "@/components/CopyProvider";
import { overridesFor } from "@/lib/copy-server";

/* One typeface for the whole site. Size and weight carry the hierarchy;
   figures use Inter's tabular set rather than a second, monospaced face. */
const sans = localFont({
  src: "../fonts/inter-latin.woff2",
  variable: "--f-sans",
  display: "swap",
  weight: "100 900",
  preload: true,
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "da";
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: meta.home.title[l],
      template: `%s — ${SITE.name}`,
    },
    description: meta.home.description[l],
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: HTML_LANG[l].replace("-", "_"),
      title: meta.home.title[l],
      description: meta.home.description[l],
    },
    alternates: {
      languages: { "da-DK": "/da", "en-GB": "/en" },
    },
    // The supplied mark, served straight out of public/. It is fully
    // opaque, so it also works as the Apple touch icon without iOS
    // compositing the transparent parts onto black.
    icons: {
      icon: [{ url: "/favicon.png", type: "image/png", sizes: "250x250" }],
      shortcut: "/favicon.png",
      apple: [{ url: "/favicon.png", sizes: "180x180" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /* Read at build time, not request time: this touches no request state, so
     every page stays prerendered and a save triggers revalidation instead. */
  const overrides = await overridesFor(locale);

  return (
    <html
      lang={HTML_LANG[locale]}
      suppressHydrationWarning
      className={sans.variable}
    >
      <body className="min-h-dvh antialiased">
        {/* Turns the page editable, but only for a visitor who is allowed to
            edit. Locally that is everyone and edits rewrite lib/content;
            on the deployed site it takes the password at /da?edit. */}
        <EditorShell dev={process.env.NODE_ENV === "development"} />
        <CopyProvider overrides={overrides}>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <a
              href="#main"
              className="u-label sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-5 focus:py-3 focus:text-accent-ink"
            >
              {locale === "da" ? "Spring til indhold" : "Skip to content"}
            </a>
            {/* One provider for the whole app: the audio element is mounted
                once here, so playback survives every navigation and the dock
                at the bottom of the page is always looking at the same
                player state. */}
            <PlayerProvider locale={locale}>
              <SiteHeader locale={locale} />
              <main id="main">{children}</main>
              <SiteFooter locale={locale} />
              <DockSpacer />
              <PlayerDock />
            </PlayerProvider>
          </ThemeProvider>
        </CopyProvider>
      </body>
    </html>
  );
}
