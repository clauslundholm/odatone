import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import "../globals.css";

/**
 * The root layout for the whole /admin tree. English only — the admin
 * backend is a staff tool, not a customer-facing surface, so it does not
 * wire into the site's DA/EN `L10n` machinery the way `app/[locale]`
 * does. Screens behind the gate mount `AppShell` themselves; this layout
 * only supplies `<html>`/`<body>` and the light/dark theme, matching
 * `app/[locale]/layout.tsx`'s own `ThemeProvider` setup.
 */
export const metadata: Metadata = {
  title: { default: "Odatone admin", template: "%s — Odatone admin" },
  description: "Staff console for Odatone.",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "250x250" }],
    shortcut: "/favicon.png",
    apple: [{ url: "/favicon.png", sizes: "180x180" }],
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
