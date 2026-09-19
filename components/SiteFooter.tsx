"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import LocaleSwitch from "@/components/LocaleSwitch";
import { FOOTER_NAV, footerNote } from "@/lib/content/common";
import { SITE } from "@/lib/site";
import { href, keyFromSlug, type Locale, type PageKey } from "@/lib/i18n";

/**
 * Quiet by design: small type, no colour, everything at one weight. The
 * page ends rather than making one last pitch.
 */
export default function SiteFooter({ locale }: { locale: Locale }) {

  const pathname = usePathname() ?? `/${locale}`;
  const slug = pathname.split("/").filter(Boolean)[1];
  const pageKey: PageKey | null = slug ? keyFromSlug(locale, slug) : null;
  const year = 2026;

  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto w-full max-w-[1320px] px-6 py-14 sm:px-8">
        <p className="mb-10 max-w-[62ch] text-[0.75rem] leading-relaxed text-ink-3">
          {footerNote[locale]}
        </p>

        <div className="grid gap-10 border-t border-line pt-10 sm:grid-cols-3 lg:grid-cols-4">
          {FOOTER_NAV.map((group) => (
            <nav key={group.heading.da} aria-label={group.heading[locale]}>
              <h2 className="mb-3 text-[0.75rem] font-semibold text-ink">{group.heading[locale]}</h2>
              <ul className="flex flex-col gap-2.5">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={href(locale, item.key)}
                      className="text-[0.75rem] text-ink-2 transition-colors hover:text-ink hover:underline"
                    >
                      {item.label[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h2 className="mb-3 text-[0.75rem] font-semibold text-ink">
              {locale === "da" ? "Kontakt" : "Contact"}
            </h2>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-[0.75rem] text-ink-2 transition-colors hover:text-ink hover:underline"
                >
                  {SITE.email}
                </a>
              </li>
              <li>
                <a
                  href={SITE.social.instagram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[0.75rem] text-ink-2 transition-colors hover:text-ink hover:underline"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={SITE.social.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[0.75rem] text-ink-2 transition-colors hover:text-ink hover:underline"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.75rem] text-ink-3">
            © {year} {SITE.name} · CVR {SITE.cvr} · {SITE.address}
          </p>
          <LocaleSwitch locale={locale} pageKey={pageKey} />
        </div>
      </div>
    </footer>
  );
}
