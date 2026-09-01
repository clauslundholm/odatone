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
        priority: key === "pricing" || key === "player" ? 0.9 : 0.6,
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
