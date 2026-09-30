import type { L10n } from "@/lib/i18n";

export const signup = {
/* "Intet betalingskort" was true while signup offered Faktura / EAN as an
   alternative to a card. It no longer does — the card is the only method and
   its fields are required — so every place that funnelled a visitor here on
   that promise now says "ingen binding" instead, which is what is actually
   on offer: a monthly term they can change or stop whenever they like.

   Deliberately NOT changed: the lines about trying the PLAYER without an
   account or a card (lib/content/player.ts's hero, lib/content/home.ts's
   player strip). Those are about listening, not subscribing, and they are
   still true. */
  eyebrow: { da: "Kom i gang", en: "Get started" } as L10n,
  /* "Tre trin" until the flow stopped being a wizard. There are still three
     numbered sections, so it was not exactly false — but "trin" describes
     stepping through screens, and there is now one screen to scroll. */
  title: { da: "Én side.\nSå spiller det.", en: "One page.\nThen it plays." } as L10n,

  /* Three sections on one page, in the order they are filled in — not steps
     any more. The flow was a wizard (Plan, then Konto, then Betaling) and is
     now a single scrolling form, so these label headings rather than tabs,
     and the order changed with it: the business comes first and the plan
     last, so nobody is asked to choose what to buy before they have told us
     who is buying.

     "Forretningen" was a fourth step once. It asked for a venue type, a
     floor area and an opening-hours band; none of those are collected now,
     and the only control left on it — the location count — sits in
     Abonnement. */
  sections: [
    { key: "company", label: { da: "Virksomhed", en: "Company" } as L10n },
    { key: "account", label: { da: "Konto", en: "Account" } as L10n },
    { key: "subscription", label: { da: "Abonnement", en: "Subscription" } as L10n },
  ],

  company: {
    heading: { da: "Din virksomhed", en: "Your company" } as L10n,
    body: {
      da: "Det er den her adresse og det her CVR-nummer, der står på fakturaen og på dokumentationen for dine rettigheder.",
      en: "This address and registration number are what appear on your invoice and on the documentation for your rights.",
    } as L10n,
  },

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
      da: "Alle planer starter med 14 dage gratis, og du kan skifte når som helst.",
      en: "Every plan starts with 14 days free and you can switch whenever.",
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
      da: "Hvem logger ind? Vi sender en invitation til den e-mail, du skriver her.",
      en: "Who signs in? We send an invitation to the email you put here.",
    } as L10n,
  },

  payment: {
    heading: { da: "Betaling", en: "Payment" } as L10n,
    /* The payment controls are no longer a step of their own — they sit at
       the foot of Abonnement — so they need a quieter in-section label than
       the section heading they used to be. */
    subheading: { da: "Sådan betaler du", en: "How you pay" } as L10n,
    body: {
      da: "Vi trækker ingenting nu. De første 14 dage er gratis, og du får en påmindelse tre dage før perioden slutter.",
      en: "Nothing is charged now. The first 14 days are free and you get a reminder three days before the period ends.",
    } as L10n,
    /* `card`, `invoice`, `ean` and `po` lived here for the payment-method
       toggle signup used to show. Signup takes a card and nothing else now,
       so the toggle and the EAN/requisition fields are gone and so is their
       copy. Staff choosing how an issued invoice is payable is unrelated and
       keeps its own strings in components/admin/InvoiceActions.tsx. */
    cardNumber: { da: "Kortnummer", en: "Card number" } as L10n,
    expiry: { da: "Udløb", en: "Expiry" } as L10n,
    cvc: { da: "CVC", en: "CVC" } as L10n,
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
    /** Shown instead of `body` when the account was created but the invite
        email itself could not be sent (a rate limit, a mail transport
        outage, ...) — `submitSignup` (app/actions.ts) returns
        `message: "no-invite"` for exactly this case. `body` promises an
        email that, here, was never sent; saying so plainly beats a
        cheerful confirmation the visitor will never receive. */
    bodyNoInvite: {
      da: "Din konto til {email} er oprettet, men vi kunne ikke sende invitationsmailen lige nu. Kontakt os, så sender vi den manuelt.",
      en: "Your account for {email} is set up, but we couldn't send the invite email just now. Contact us and we'll send it by hand.",
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
    /* No "valgfri" hint any more — this is required. See lib/signup.ts's
       parseCvr for why, and note the hint is what a visitor reads as
       permission to skip it. */
    cvr: { da: "CVR-nummer", en: "Company reg. no." } as L10n,
    email: { da: "Arbejds-e-mail", en: "Work email" } as L10n,
    phone: { da: "Telefon", en: "Phone" } as L10n,
    address: { da: "Adresse på lokationen", en: "Address of the location" } as L10n,
    city: { da: "By", en: "City" } as L10n,
    zip: { da: "Postnr.", en: "Postcode" } as L10n,
  },

  /* One page means a failed submit can produce a dozen errors at once, most
     of them scrolled out of sight — so the button says how many, and the
     first one is focused. Without that, pressing the button and staying put
     reads as nothing having happened at all. */
  incomplete: {
    one: { da: "1 felt mangler", en: "1 field needs attention" } as L10n,
    many: { da: "{n} felter mangler", en: "{n} fields need attention" } as L10n,
  },

  errors: {
    required: { da: "Skal udfyldes", en: "Required" } as L10n,
    email: { da: "Ugyldig e-mail", en: "Invalid email" } as L10n,
    long: { da: "For langt", en: "Too long" } as L10n,
    cvr: { da: "8 cifre", en: "8 digits" } as L10n,
    card: { da: "16 cifre", en: "16 digits" } as L10n,
    expiry: { da: "MM/ÅÅ", en: "MM/YY" } as L10n,
    cvc: { da: "3 cifre", en: "3 digits" } as L10n,
    terms: { da: "Du skal acceptere betingelserne", en: "You must accept the terms" } as L10n,
    /** A signup-only server-side error: the email already has a completed
        account (an owner profile exists), or the invite call turned out to
        target one mid-request. Never produced by client-side validation. */
    exists: {
      da: "Der findes allerede en konto med denne e-mail. Tjek din indbakke for invitationen, eller log ind.",
      en: "An account with this email already exists. Check your inbox for the invite, or log in.",
    } as L10n,
    /** Generic server-side/service failure — a database write or the
        service role itself was unavailable. Deliberately not the raw error
        code the server logs; the visitor gets copy they can act on. */
    server: {
      da: "Der opstod en fejl. Prøv igen om lidt, eller kontakt os hvis det gentager sig.",
      en: "Something went wrong. Please try again shortly, or contact us if it keeps happening.",
    } as L10n,
    /** plan/venueType/m2/locations have no text field of their own — they
        come from step one and two's buttons and sliders — so buildSignup
        rejecting one can only mean a raw field a real browser session
        couldn't produce. These say what's actually wrong instead of the
        generic "Skal udfyldes", which read as though a blank field had been
        left on a step where nothing looks blank at all. */
    /* "Gå tilbage til trin 2" until the flow became one page. There are no
       steps to go back to, and the plan cards are a few centimetres above
       wherever this is read — telling someone to navigate to a place that no
       longer exists is worse than saying nothing. */
    planInvalid: {
      da: "Vælg en plan ovenfor.",
      en: "Choose a plan above.",
    } as L10n,
    venueTypeInvalid: {
      da: "Den valgte virksomhedstype er ikke gyldig. Gå tilbage til trin 1 og vælg igen.",
      en: "The selected business type isn't valid. Go back to step 1 and choose again.",
    } as L10n,
    m2Invalid: {
      da: "Arealet er ikke gyldigt. Gå tilbage til trin 1 og justér det.",
      en: "The floor area isn't valid. Go back to step 1 and adjust it.",
    } as L10n,
    locationsInvalid: {
      da: "Antallet af lokationer er ikke gyldigt. Justér det ovenfor.",
      en: "The number of locations isn't valid. Adjust it above.",
    } as L10n,
  },
};
