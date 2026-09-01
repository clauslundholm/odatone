import type { L10n } from "@/lib/i18n";

export const pricing = {
  eyebrow: { da: "Priser", en: "Pricing" } as L10n,
  title: {
    da: "Én pris.\nIngen licenser\novenpå.",
    en: "One price.\nNo licences\non top.",
  } as L10n,
  lede: {
    da: "Vælg størrelsen på forretningen, og betal én ting. Koda, Gramex og hele musikbiblioteket er inkluderet i tallet, du ser.",
    en: "Pick the size of your business and pay for one thing. Koda, Gramex and the entire music library are inside the number you see.",
  } as L10n,

  monthly: { da: "Måned", en: "Monthly" } as L10n,
  annual: { da: "År", en: "Annual" } as L10n,
  billedAnnually: { da: "faktureres årligt", en: "billed annually" } as L10n,
  mostPopular: { da: "Mest valgte", en: "Most chosen" } as L10n,

  volumeHeading: { da: "Flere lokationer", en: "Several locations" } as L10n,
  volumeBody: {
    da: "Rabatten lægges automatisk oveni, uanset hvilken plan lokationerne kører. Én faktura, én kontrakt, én kontaktperson.",
    en: "The discount is applied automatically, whatever plan each location runs. One invoice, one contract, one contact person.",
  } as L10n,

  includedHeading: { da: "Med i alle planer", en: "In every plan" } as L10n,
  included: {
    da: [
      "Hele biblioteket — over 4.000 numre",
      "Koda- og Gramex-rettigheder afregnet",
      "Dokumentation til myndigheder og udlejer",
      "Browser, iOS og Android",
      "Nye numre hver måned",
      "Support på dansk og engelsk",
      "14 dages gratis prøveperiode",
      "Ingen binding på månedsabonnement",
    ],
    en: [
      "The full library — over 4,000 tracks",
      "Koda and Gramex rights settled",
      "Documentation for authorities and landlords",
      "Browser, iOS and Android",
      "New tracks every month",
      "Support in Danish and English",
      "14-day free trial",
      "No lock-in on monthly billing",
    ],
  } as Record<"da" | "en", string[]>,

  compareHeading: { da: "Sammenlign planerne", en: "Compare the plans" } as L10n,
  compare: {
    head: { da: ["", "Small", "Medium", "Main"], en: ["", "Small", "Medium", "Main"] },
    rows: {
      da: [
        ["Areal pr. lokation", "Op til 100 m²", "Op til 300 m²", "Ubegrænset"],
        ["Zoner pr. lokation", "1", "3", "Ubegrænset"],
        ["Tidsplaner", "Daglig", "Døgnplan", "Døgnplan pr. zone"],
        ["Offline-buffer", "—", "Ja", "Ja"],
        ["Fjernstyring af lokationer", "—", "—", "Ja"],
        ["Kurateret profil", "—", "—", "Ja"],
        ["Fakturering", "Kort", "Kort eller faktura", "Faktura eller EAN"],
        ["Support", "E-mail", "E-mail og telefon", "Fast kontaktperson"],
      ],
      en: [
        ["Area per location", "Up to 100 m²", "Up to 300 m²", "Unlimited"],
        ["Zones per location", "1", "3", "Unlimited"],
        ["Schedules", "Daily", "Round the clock", "Per zone, round the clock"],
        ["Offline buffer", "—", "Yes", "Yes"],
        ["Remote control of locations", "—", "—", "Yes"],
        ["Curated profile", "—", "—", "Yes"],
        ["Invoicing", "Card", "Card or invoice", "Invoice or EAN"],
        ["Support", "Email", "Email and phone", "A named contact"],
      ],
    } as Record<"da" | "en", string[][]>,
  },
};
