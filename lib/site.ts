import type { L10n } from "./i18n";

export const SITE = {
  name: "Odatone",
  domain: "odatone.com",
  url: "https://odatone.com",
  email: "info@odatone.com",
  salesEmail: "salg@odatone.com",
  phone: "+45 70 60 50 40", // PLACEHOLDER — no phone number is published on the current site.
  cvr: "00 00 00 00", // PLACEHOLDER — not published on the current site.
  address: "København, Danmark", // PLACEHOLDER — no street address is published.
  social: {
    // PLACEHOLDER — guessed handles, confirm before launch.
    instagram: "https://instagram.com/odatone",
    linkedin: "https://www.linkedin.com/company/odatone",
  },
} as const;

/** Numbers used as proof throughout the marketing pages. */
export const PROOF = {
  tracks: 4000, // "over 4.000 licensfrie numre" — current odatone.com
  customers: 1100, // "1.100+ danske kunder" — current odatone.com
  /* The v4 web design prints this in the nav, the hero and the signup CTA.
     Every piece of copy that states the trial now interpolates it — it used
     to be written out by hand in 22 places across eight content files,
     including the terms (lib/content/legal.ts), where it is a contractual
     term rather than marketing. */
  trialDays: 8,
  playerTrialDays: 7, // the free web player demo window in this build
  setupMinutes: 5,
} as const;

export const claim = (da: string, en: string): L10n => ({ da, en });
