import type { L10n, PageKey } from "@/lib/i18n";
import { PROOF } from "../site";

export const ui = {
  tryPlayer: { da: "Prøv afspilleren gratis", en: "Try the player free" } as L10n,
  seeSavings: { da: "Se hvad du sparer", en: "See what you save" } as L10n,
  getStarted: { da: "Kom i gang", en: "Get started" } as L10n,
  startTrial: { da: `Start ${PROOF.trialDays} dage gratis`, en: `Start ${PROOF.trialDays} days free` } as L10n,
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

/* There is no primary nav any more. Afspil, Besparelse, Priser, Artister
   and Om os were the whole of it, and the four pages still under this
   chrome — Kom i gang, Kontakt, Privatliv, Betingelser — are a call to
   action and three support pages, not a menu. SiteHeader therefore
   carries the wordmark, the language, the login and the CTA, and nothing
   between them. */

export const FOOTER_NAV: { heading: L10n; items: { key: PageKey; label: L10n }[] }[] = [
  {
    heading: { da: "Odatone", en: "Odatone" },
    items: [
      { key: "signup", label: { da: "Kom i gang", en: "Get started" } },
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
