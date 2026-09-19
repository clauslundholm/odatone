import type { L10n } from "@/lib/i18n";

export const about = {
  eyebrow: { da: "Om Odatone", en: "About Odatone" } as L10n,
  title: {
    da: "Nogen skulle\nlave regnestykket\nom.",
    en: "Someone had to\nredo the\narithmetic.",
  } as L10n,
  lede: {
    da: "Erhvervslivet stod med to dårlige valg: Dyr musik med licenser og efterregninger  -eller billig, sjælløs royaltyfri musik, ingen gider høre på. Odatone er det tredje.",
    en: "Business had two bad options: expensive music with licences and back-bills — or cheap, soulless royalty-free music nobody wants to hear. Odatone is the third.",
  } as L10n,

  storyHeading: { da: "Hvordan det startede", en: "How it started" } as L10n,
  story: {
    da: [
      "Odatone begyndte som 1000TRAX: et bibliotek af originalmusik indspillet til erhvervsbrug, bygget fordi ingen af de eksisterende muligheder gav mening for hverken forretningen eller musikeren.",
      "Forretningen betalte tre gange — abonnement, Koda og Gramex — og risikerede en efterregning oveni. Musikeren fik brøkdele af en øre pr. afspilning. Ingen af parterne var glade, og pengene forsvandt et sted derimellem.",
      "Løsningen var at vende det om: indspil musikken selv, betal musikerne ordentligt for arbejdet, og sælg adgangen som ét abonnement uden licenser ovenpå. I dag ligger der over 4.000 numre i biblioteket, og 1.100+ danske forretninger spiller dem.",
    ],
    en: [
      "Odatone began as 1000TRAX: a library of original music recorded for commercial use, built because none of the existing options made sense for the business or the musician.",
      "The business paid three times — subscription, Koda and Gramex — and risked a back-bill on top. The musician got fractions of a penny per play. Nobody was happy, and the money disappeared somewhere in between.",
      "The fix was to turn it around: record the music ourselves, pay the musicians properly for the work, and sell access as one subscription with no licences on top. Today the library holds over 4,000 tracks and 1,100+ Danish businesses play them.",
    ],
  } as Record<"da" | "en", string[]>,

  peopleHeading: { da: "Dem der bygger det", en: "The people building it" } as L10n,
  people: [
    {
      name: "Michael Pfundheller",
      role: { da: "Musik", en: "Music" } as L10n,
      bio: {
        da: "Grammy-vindende producer med 40 år i studiet og en række guld- og platinplader. Han satte ord på problemet: erhvervsmusik behøver ikke lyde som erhvervsmusik.",
        en: "Grammy-winning producer with 40 years in the studio and a shelf of gold and platinum records. He named the problem: music for business does not have to sound like music for business.",
      } as L10n,
    },
    {
      name: "Werner Valeur",
      role: { da: "Produkt", en: "Product" } as L10n,
      bio: {
        da: "Serieiværksætter og manden bag regnskabsprogrammet Billy. Han står for den del, hvor du kan gå fra tilmelding til musik i højttalerne på fem minutter.",
        en: "Serial entrepreneur and the man behind the accounting software Billy. He owns the part where you get from signup to music in the speakers in five minutes.",
      } as L10n,
    },
  ],
  peopleNote: {
    da: "Biografierne er skrevet ud fra det nuværende odatone.com — få dem godkendt inden lancering.",
    en: "The biographies are written from the current odatone.com — get them approved before launch.",
  } as L10n,

  valuesHeading: { da: "Tre ting vi ikke gør", en: "Three things we don't do" } as L10n,
  values: {
    da: [
      ["Vi genererer ikke musik", "Hvert nummer har en komponist, en besætning og en indspilningsdato."],
      ["Vi sender ikke efterregninger", "Prisen på din plan er prisen. Der kommer ikke en licens bagefter."],
      ["Vi binder dig ikke", "Månedsabonnement kan opsiges til udgangen af en måned. Uden samtale."],
    ],
    en: [
      ["We don't generate music", "Every track has a composer, a line-up and a recording date."],
      ["We don't send back-bills", "The price of your plan is the price. No licence arrives afterwards."],
      ["We don't lock you in", "A monthly subscription can be cancelled to the end of a month. Without a phone call."],
    ],
  } as Record<"da" | "en", string[][]>,
};
