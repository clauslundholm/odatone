import type { L10n } from "@/lib/i18n";

export const signup = {
  eyebrow: { da: "Kom i gang", en: "Get started" } as L10n,
  title: { da: "Fire trin.\nSå spiller det.", en: "Four steps.\nThen it plays." } as L10n,

  steps: [
    { key: "venue", label: { da: "Forretningen", en: "Your business" } as L10n },
    { key: "plan", label: { da: "Plan", en: "Plan" } as L10n },
    { key: "account", label: { da: "Konto", en: "Account" } as L10n },
    { key: "payment", label: { da: "Betaling", en: "Payment" } as L10n },
  ],

  venue: {
    heading: { da: "Fortæl os om rummet", en: "Tell us about the room" } as L10n,
    body: {
      da: "Vi bruger det til at foreslå den rigtige plan og en stemning, der passer til dine gæster. Du kan ændre alt bagefter.",
      en: "We use this to suggest the right plan and a mood that suits your guests. You can change all of it afterwards.",
    } as L10n,
    savingsNote: {
      da: "Med den opsætning sparer du",
      en: "With that setup you save",
    } as L10n,
  },

  plan: {
    heading: { da: "Vælg din plan", en: "Choose your plan" } as L10n,
    body: {
      da: "Vi har forudvalgt den, der passer til arealet. Alle planer starter med 14 dage gratis, og du kan skifte når som helst.",
      en: "We have pre-selected the one that fits your floor area. Every plan starts with 14 days free and you can switch whenever.",
    } as L10n,
    recommended: { da: "Anbefalet til dig", en: "Recommended for you" } as L10n,
    tooSmall: {
      da: "Din lokation er større end denne plan dækker",
      en: "Your location is larger than this plan covers",
    } as L10n,
  },

  account: {
    heading: { da: "Din konto", en: "Your account" } as L10n,
    body: {
      da: "Kun det vi skal bruge for at oprette abonnementet og sende dig dokumentationen.",
      en: "Only what we need to set up the subscription and send you the documentation.",
    } as L10n,
  },

  payment: {
    heading: { da: "Betaling", en: "Payment" } as L10n,
    body: {
      da: "Vi trækker ingenting nu. De første 14 dage er gratis, og du får en påmindelse tre dage før perioden slutter.",
      en: "Nothing is charged now. The first 14 days are free and you get a reminder three days before the period ends.",
    } as L10n,
    card: { da: "Betalingskort", en: "Card" } as L10n,
    invoice: { da: "Faktura / EAN", en: "Invoice / EAN" } as L10n,
    cardNumber: { da: "Kortnummer", en: "Card number" } as L10n,
    expiry: { da: "Udløb", en: "Expiry" } as L10n,
    cvc: { da: "CVC", en: "CVC" } as L10n,
    ean: { da: "EAN-nummer", en: "EAN number" } as L10n,
    po: { da: "Rekvisitionsnummer", en: "Purchase order" } as L10n,
    terms: {
      da: "Jeg accepterer handelsbetingelserne og privatlivspolitikken.",
      en: "I accept the terms of business and the privacy policy.",
    } as L10n,
    submit: { da: "Start prøveperioden", en: "Start the trial" } as L10n,
    submitting: { da: "Opretter…", en: "Setting up…" } as L10n,
    demoNote: {
      da: "Prototype: intet kort bliver gemt eller opkrævet. Kobl en betalingsudbyder på inden lancering.",
      en: "Prototype: no card is stored or charged. Connect a payment provider before launch.",
    } as L10n,
  },

  done: {
    heading: { da: "Så er der lyd.", en: "You're live." } as L10n,
    body: {
      da: "Vi har sendt en bekræftelse til {email}. Du kan åbne afspilleren nu — abonnementet er aktivt fra i dag, og de første 14 dage er gratis.",
      en: "We have sent a confirmation to {email}. You can open the player now — the subscription is active from today and the first 14 days are free.",
    } as L10n,
    nextHeading: { da: "Tre ting mere", en: "Three more things" } as L10n,
    next: {
      da: [
        ["Åbn afspilleren", "Log ind på en hvilken som helst skærm i lokalet og tryk play."],
        ["Hent app'en", "iOS og Android, hvis du hellere vil styre musikken fra telefonen."],
        ["Gem dokumentationen", "Dit abonnementsbevis ligger på kontoen — det er det, du viser frem, hvis nogen spørger."],
      ],
      en: [
        ["Open the player", "Log in on any screen in the venue and press play."],
        ["Get the app", "iOS and Android, if you would rather run the music from a phone."],
        ["Keep the documentation", "Your subscription certificate sits in your account — that is what you show if anyone asks."],
      ],
    } as Record<"da" | "en", string[][]>,
    openPlayer: { da: "Åbn afspilleren", en: "Open the player" } as L10n,
    startOver: { da: "Prøv flowet igen", en: "Run the flow again" } as L10n,
  },

  summary: {
    heading: { da: "Din opsætning", en: "Your setup" } as L10n,
    venue: { da: "Forretning", en: "Business" } as L10n,
    area: { da: "Areal", en: "Area" } as L10n,
    locations: { da: "Lokationer", en: "Locations" } as L10n,
    plan: { da: "Plan", en: "Plan" } as L10n,
    billing: { da: "Betaling", en: "Billing" } as L10n,
    perLocation: { da: "Pr. lokation", en: "Per location" } as L10n,
    volumeDiscount: { da: "Mængderabat", en: "Volume discount" } as L10n,
    annualDiscount: { da: "Årsrabat", en: "Annual discount" } as L10n,
    dueToday: { da: "Betales i dag", en: "Due today" } as L10n,
    freeTrial: { da: "0 kr. — 14 dage gratis", en: "0 kr. — 14 days free" } as L10n,
    thenPay: { da: "Derefter", en: "Then" } as L10n,
    incVat: { da: "inkl. moms", en: "incl. VAT" } as L10n,
    savingLine: { da: "Sparet mod Koda + Gramex", en: "Saved against Koda + Gramex" } as L10n,
  },

  fields: {
    name: { da: "Fulde navn", en: "Full name" } as L10n,
    company: { da: "Virksomhed", en: "Company" } as L10n,
    cvr: { da: "CVR-nummer", en: "Company reg. no." } as L10n,
    email: { da: "Arbejds-e-mail", en: "Work email" } as L10n,
    phone: { da: "Telefon", en: "Phone" } as L10n,
    address: { da: "Adresse på lokationen", en: "Address of the location" } as L10n,
    city: { da: "By", en: "City" } as L10n,
    zip: { da: "Postnr.", en: "Postcode" } as L10n,
  },

  errors: {
    required: { da: "Skal udfyldes", en: "Required" } as L10n,
    email: { da: "Ugyldig e-mail", en: "Invalid email" } as L10n,
    cvr: { da: "8 cifre", en: "8 digits" } as L10n,
    card: { da: "16 cifre", en: "16 digits" } as L10n,
    expiry: { da: "MM/ÅÅ", en: "MM/YY" } as L10n,
    cvc: { da: "3 cifre", en: "3 digits" } as L10n,
    terms: { da: "Du skal acceptere betingelserne", en: "You must accept the terms" } as L10n,
    ean: { da: "13 cifre", en: "13 digits" } as L10n,
  },
};
