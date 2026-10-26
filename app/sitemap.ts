import type { MetadataRoute } from "next";
import { LOCALES, PAGE_KEYS, SLUGS } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    entries.push({
      url: `${SITE.url}/${locale}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((x) => [x, `${SITE.url}/${x}`])),
      },
    });
    for (const key of PAGE_KEYS) {
      entries.push({
        url: `${SITE.url}/${locale}/${SLUGS[key][locale]}`,
        lastModified: now,
        changeFrequency: "monthly",
        /* Kom i gang is the one page here that converts; the rest are
           support and legal. The product pages that used to rank 0.9
           are gone, and what they ranked for is the front page now. */
        priority: key === "signup" ? 0.9 : 0.6,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((x) => [x, `${SITE.url}/${x}/${SLUGS[key][x]}`]),
          ),
        },
      });
    }
  }

  return entries;
}
