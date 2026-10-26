import type { L10n, PageKey } from "@/lib/i18n";
import { PROOF } from "../site";

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
      da: `Én side, fem minutter, musik i højttalerne. ${PROOF.trialDays} dage gratis, ingen binding.`,
      en: `One page, five minutes, music in the speakers. ${PROOF.trialDays} days free, no commitment.`,
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
