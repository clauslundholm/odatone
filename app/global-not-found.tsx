import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "404 — Odatone",
  description: "Siden findes ikke / Page not found",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "250x250" }],
    shortcut: "/favicon.png",
    apple: [{ url: "/favicon.png", sizes: "180x180" }],
  },
};

export default function GlobalNotFound() {
  return (
    <html lang="da" data-theme="light">
      <body className="min-h-dvh bg-bg text-ink">
        <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="u-label text-accent">404</p>
          <h1 className="u-display text-[clamp(2.2rem,7vw,4rem)]">Der er stille herinde.</h1>
          <p className="u-lede">Siden findes ikke. / This page does not exist.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/da"
              className="rounded-full bg-accent px-6 py-3 text-[0.9375rem] font-medium text-accent-ink transition-opacity hover:opacity-88"
            >
              Til forsiden
            </Link>
            <Link
              href="/en"
              className="rounded-full bg-surface-2 px-6 py-3 text-[0.9375rem] font-medium text-ink transition-colors hover:bg-surface-3"
            >
              English home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
