import type { L10n, PageKey } from "@/lib/i18n";

export const ui = {
  tryPlayer: { da: "Prøv afspilleren gratis", en: "Try the player free" } as L10n,
  seeSavings: { da: "Se hvad du sparer", en: "See what you save" } as L10n,
  getStarted: { da: "Kom i gang", en: "Get started" } as L10n,
  startTrial: { da: "Start 14 dage gratis", en: "Start 14 days free" } as L10n,
  talkToSales: { da: "Tal med salg", en: "Talk to sales" } as L10n,
  seePricing: { da: "Se priser", en: "See pricing" } as L10n,
  logIn: { da: "Log ind", en: "Log in" } as L10n,
  tryFree: { da: "Prøv gratis", en: "Try it free" } as L10n,
  learnMore: { da: "Læs mere", en: "Learn more" } as L10n,
  menu: { da: "Menu", en: "Menu" } as L10n,
  close: { da: "Luk", en: "Close" } as L10n,
  back: { da: "Tilbage", en: "Back" } as L10n,
  next: { da: "Videre", en: "Continue" } as L10n,
  theme: { da: "Skift tema", en: "Switch theme" } as L10n,
  language: { da: "Sprog", en: "Language" } as L10n,
  perMonthPerLocation: {
    da: "pr. lokation / måned",
    en: "per location / month",
  } as L10n,
  exVat: { da: "ekskl. moms", en: "excl. VAT" } as L10n,
  indicativeShort: {
    da: "vejledende tal",
    en: "indicative figures",
  } as L10n,
  indicative: {
    da: "Vejledende tal. Bekræft dine egne satser hos Koda og Gramex.",
    en: "Indicative figures. Confirm your own rates with Koda and Gramex.",
  } as L10n,
} as const;

export const NAV: { key: PageKey; label: L10n }[] = [
  { key: "player", label: { da: "Afspil", en: "Player" } },
  { key: "savings", label: { da: "Besparelse", en: "Savings" } },
  { key: "pricing", label: { da: "Priser", en: "Pricing" } },
  { key: "artists", label: { da: "Artister", en: "Artists" } },
  { key: "about", label: { da: "Om os", en: "About" } },
];

export const FOOTER_NAV: { heading: L10n; items: { key: PageKey; label: L10n }[] }[] = [
  {
    heading: { da: "Produkt", en: "Product" },
    items: [
      { key: "player", label: { da: "Afspil", en: "Player" } },
      { key: "pricing", label: { da: "Priser", en: "Pricing" } },
      { key: "savings", label: { da: "Besparelsesberegner", en: "Savings calculator" } },
      { key: "signup", label: { da: "Kom i gang", en: "Get started" } },
    ],
  },
  {
    heading: { da: "Odatone", en: "Odatone" },
    items: [
      { key: "about", label: { da: "Om os", en: "About us" } },
      { key: "artists", label: { da: "Artister", en: "Artists" } },
      { key: "contact", label: { da: "Kontakt salg", en: "Talk to sales" } },
    ],
  },
  {
    heading: { da: "Jura", en: "Legal" },
    items: [
      { key: "privacy", label: { da: "Privatliv", en: "Privacy" } },
      { key: "terms", label: { da: "Betingelser", en: "Terms" } },
    ],
  },
];

export const footerNote: L10n = {
  da: "Odatone er kurateret, licensfri musik til erhverv. Alle rettigheder til numrene er afregnet med musikerne, før du trykker play.",
  en: "Odatone is curated, licence-free music for business. Every right to every track is settled with the musicians before you press play.",
};
