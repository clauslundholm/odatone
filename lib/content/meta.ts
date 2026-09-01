import type { L10n, PageKey } from "@/lib/i18n";

type Meta = { title: L10n; description: L10n };

export const meta: Record<PageKey | "home", Meta> = {
  home: {
    title: {
      da: "Odatone — musik til din forretning, 90 % billigere",
      en: "Odatone — music for your business, 90% cheaper",
    },
    description: {
      da: "Lovlig baggrundsmusik til erhverv. Over 4.000 numre indspillet af professionelle musikere. Ingen Koda. Ingen Gramex. Fra 149 kr. om måneden.",
      en: "Legal background music for business. Over 4,000 tracks recorded by professional musicians. No Koda. No Gramex. From DKK 149 a month.",
    },
  },
  player: {
    title: { da: "Afspiller", en: "Player" },
    description: {
      da: "Prøv Odatone-afspilleren gratis. Vælg genre, tempo og vokal, og hør hvordan din forretning kommer til at lyde.",
      en: "Try the Odatone player for free. Pick genre, tempo and vocals, and hear how your business will sound.",
    },
  },
  savings: {
    title: { da: "Hvad sparer du?", en: "What do you save?" },
    description: {
      da: "Regn din musikregning ud. Koda, Gramex og streaming mod ét abonnement hos Odatone.",
      en: "Work out your music bill. Koda, Gramex and streaming against one Odatone subscription.",
    },
  },
  pricing: {
    title: { da: "Priser", en: "Pricing" },
    description: {
      da: "Tre planer, én pris pr. lokation. Ingen licenser oveni, ingen efterregning, ingen binding.",
      en: "Three plans, one price per location. No licences on top, no surprise bill, no lock-in.",
    },
  },
  artists: {
    title: { da: "Artister", en: "Artists" },
    description: {
      da: "Musikken er skrevet og indspillet af navngivne musikere, der får ordentligt betalt for arbejdet.",
      en: "The music is written and recorded by named musicians who are paid properly for the work.",
    },
  },
  about: {
    title: { da: "Om Odatone", en: "About Odatone" },
    description: {
      da: "En Grammy-vindende producer og manden bag Billy byggede den musiktjeneste, erhvervslivet manglede.",
      en: "A Grammy-winning producer and the man behind Billy built the music service business needed.",
    },
  },
  contact: {
    title: { da: "Kontakt salg", en: "Talk to sales" },
    description: {
      da: "Flere lokationer, kæde eller særlige krav? Vi ringer tilbage inden for én arbejdsdag.",
      en: "Multiple locations, a chain or special requirements? We call back within one working day.",
    },
  },
  signup: {
    title: { da: "Kom i gang", en: "Get started" },
    description: {
      da: "Fire trin, fem minutter, musik i højttalerne. 14 dage gratis, ingen betalingskort krævet.",
      en: "Four steps, five minutes, music in the speakers. 14 days free, no card required.",
    },
  },
  privacy: {
    title: { da: "Privatlivspolitik", en: "Privacy policy" },
    description: {
      da: "Hvordan Odatone behandler personoplysninger.",
      en: "How Odatone handles personal data.",
    },
  },
  terms: {
    title: { da: "Handelsbetingelser", en: "Terms of business" },
    description: {
      da: "Vilkår for abonnement på Odatone.",
      en: "Terms for an Odatone subscription.",
    },
  },
};
