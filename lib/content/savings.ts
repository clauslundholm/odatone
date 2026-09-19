import type { L10n } from "@/lib/i18n";

export const savings = {
  eyebrow: { da: "Regnestykket", en: "The arithmetic" } as L10n,
  title: {
    da: "Hvad betaler du\nfor musik i dag?",
    en: "What are you paying\nfor music today?",
  } as L10n,
  lede: {
    da: "Tre regninger bliver til én. Sæt din forretning op herunder, så udregner vi hvor meget du kan spare om året ved at vælge Odatone.",
    en: "Three bills become one. Set up your business below and we do the rest.",
  } as L10n,

  venueType: { da: "Type forretning", en: "Type of business" } as L10n,
  area: { da: "Kundeareal", en: "Customer-facing area" } as L10n,
  hours: { da: "Åbningstid", en: "Opening hours" } as L10n,
  locations: { da: "Lokationer", en: "Locations" } as L10n,
  streamingLine: {
    da: "Jeg betaler også for en streamingtjeneste",
    en: "I also pay for a streaming service",
  } as L10n,

  todayHeading: { da: "I dag", en: "Today" } as L10n,
  withOdatone: { da: "Med Odatone", en: "With Odatone" } as L10n,
  koda: { da: "Koda", en: "Koda" } as L10n,
  gramex: { da: "Gramex", en: "Gramex" } as L10n,
  streaming: { da: "Streamingtjeneste", en: "Streaming service" } as L10n,
  totalToday: { da: "I alt i dag", en: "Total today" } as L10n,
  subscription: { da: "Abonnement", en: "Subscription" } as L10n,
  licences: { da: "Licenser", en: "Licences" } as L10n,
  none: { da: "0 kr. — indeholdt", en: "0 kr. — included" } as L10n,

  youSave: { da: "Du sparer", en: "You save" } as L10n,
  perYear: { da: "om året", en: "a year" } as L10n,
  perMonthShort: { da: "om måneden", en: "a month" } as L10n,
  ofYourBill: { da: "af musikregningen", en: "of your music bill" } as L10n,
  recommended: { da: "Anbefalet plan", en: "Recommended plan" } as L10n,

  ctaWithNumbers: { da: "Start med denne opsætning", en: "Start with this setup" } as L10n,
  ctaSecondary: { da: "Se hele prislisten", en: "See the full price list" } as L10n,

  disclaimerTitle: { da: "Om tallene", en: "About these figures" } as L10n,
  disclaimer: {
    da: "Koda og Gramex opkræver efter areal, type forretning og åbningstid. Beregningen her bruger vejledende satser, så du kan se størrelsesordenen — din egen regning kan afvige. Odatone-prisen er den faktiske listepris.",
    en: "Koda and Gramex charge by floor area, type of business and opening hours. This calculation uses indicative rates so you can see the order of magnitude — your own bill may differ. The Odatone price is the actual list price.",
  } as L10n,

  faqTitle: { da: "Men er det lovligt?", en: "But is it legal?" } as L10n,
  faq: {
    da: [
      [
        "Hvorfor skal jeg ikke betale Koda og Gramex?",
        "Koda og Gramex opkræver på vegne af de rettighedshavere, de repræsenterer. Odatones musik er skrevet og indspillet til formålet, og rettighederne er afregnet direkte med musikerne, før nummeret lander i biblioteket. Der er derfor ingen tredjepart tilbage at betale.",
      ],
      [
        "Hvad hvis Koda kontakter mig?",
        "Så sender du dem din Odatone-dokumentation. Du får et abonnementsbevis med lokation og periode, som viser præcis hvilken musik der bliver spillet hvor.",
      ],
      [
        "Må jeg spille min egen Spotify ved siden af?",
        "Nej — i det øjeblik der spilles anden musik i lokalet, gælder de almindelige regler for netop den musik. Odatone dækker det, der kommer fra Odatone.",
      ],
      [
        "Hvad med lyd til events og livemusik?",
        "Livemusik og arrangementer med entré er en anden kategori og hører ikke under et baggrundsmusikabonnement. Ring til os, så finder vi ud af det.",
      ],
    ],
    en: [
      [
        "Why don't I pay Koda and Gramex?",
        "Koda and Gramex collect on behalf of the rights holders they represent. Odatone's music is written and recorded for the purpose, and the rights are settled directly with the musicians before a track enters the library. There is no third party left to pay.",
      ],
      [
        "What if Koda contacts me?",
        "You send them your Odatone documentation. You get a subscription certificate with location and period showing exactly what music is played where.",
      ],
      [
        "Can I play my own Spotify alongside it?",
        "No — the moment other music plays in the room, the ordinary rules apply to that music. Odatone covers what comes from Odatone.",
      ],
      [
        "What about events and live music?",
        "Live music and ticketed events are a different category and are not covered by a background music subscription. Call us and we will sort it out.",
      ],
    ],
  } as Record<"da" | "en", string[][]>,
};
