import type { L10n } from "@/lib/i18n";

export const home = {
  hero: {
    eyebrow: {
      da: "Lovlig baggrundsmusik til erhverv skal ikke tynge jeres budget",
      en: "Legal background music for business",
    } as L10n,
    /* "op til" is not padding: the calculator only reaches 90 % for the
       larger venues, and the current site makes the same qualified claim. */
    line1: { da: "Spar op til 90 %", en: "Save up to 90%" } as L10n,
    line2: { da: "på musikregningen.", en: "on your music bill." } as L10n,
    /* "op til" is set small in front of line3 — the current site claims
       "spar op til 90 %", and the calculator reaches 90 % only for the
       larger venues, so the qualifier has to be there. */
    kicker: { da: "Op til", en: "Up to" } as L10n,
    line3: { da: "90 % billigere.", en: "90% cheaper." } as L10n,
    lede: {
      da: "Slip for Koda, Gramex og streamingtjenester allerede idag! Få adgang til over 4.000 numre, indspillet af professionelle musikere  -alle rettigheder er betalt, før du trykker play.",
      en: "Koda, Gramex and the streaming service become one subscription from 149 kr. a month. Over 4,000 tracks recorded by professional musicians — every right paid for before you press play.",
    } as L10n,
    pickPrompt: { da: "Hvad driver du?", en: "What do you run?" } as L10n,
    savingsLabel: { da: "Du sparer", en: "You save" } as L10n,
    perYear: { da: "om året", en: "a year" } as L10n,
    todayLine: {
      da: "{today} i dag · {ours} med Odatone",
      en: "{today} today · {ours} with Odatone",
    } as L10n,
    calcLink: {
      da: "Regn på din egen forretning",
      en: "Work it out for your own business",
    } as L10n,
    tiles: {
      da: [
        ["4.000+", "numre, skrevet og indspillet til erhvervsbrug"],
        ["0 kr.", "til Koda og Gramex — rettighederne er afregnet"],
        ["5 min.", "fra tilmelding til musik i højttalerne"],
        ["1.100+", "danske forretninger spiller Odatone i dag"],
      ],
      en: [
        ["4,000+", "tracks, written and recorded for commercial use"],
        ["0 kr.", "to Koda and Gramex — the rights are settled"],
        ["5 min", "from signup to music in the speakers"],
        ["1,100+", "Danish businesses play Odatone today"],
      ],
    } as Record<"da" | "en", string[][]>,
    stats: {
      da: [
        ["4.000+", "numre i biblioteket"],
        ["1.100+", "danske forretninger"],
        ["5 min.", "fra tilmelding til lyd"],
      ],
      en: [
        ["4,000+", "tracks in the library"],
        ["1,100+", "Danish businesses"],
        ["5 min", "from signup to sound"],
      ],
    } as Record<"da" | "en", string[][]>,
  },

  ticker: {
    da: [
      "Ingen Koda",
      "Ingen Gramex",
      "Ingen efterregning",
      "Ingen binding",
      "4.000+ numre",
      "8 genrer",
      "Musikere får ordentlig betaling",
      "Fra 149 kr./md.",
      "14 dage gratis",
    ],
    en: [
      "No Koda",
      "No Gramex",
      "No surprise bill",
      "No lock-in",
      "4,000+ tracks",
      "8 genres",
      "Musicians paid properly",
      "From 149 kr./mo",
      "14 days free",
    ],
  } as Record<"da" | "en", string[]>,

  strip: {
    heading: { da: "Tre regninger bliver til én.", en: "Three bills become one." } as L10n,
    lede: {
      da: "Koda, Gramex og streamingtjenesten bliver til ét abonnement. Her er regnestykket for en café på 90 m².",
      en: "Koda, Gramex and the streaming service become one subscription. Here is the arithmetic for a 90 m² café.",
    } as L10n,
    before: { da: "Sådan ser det ud i dag", en: "How it looks today" } as L10n,
    after: { da: "Sådan ser det ud med Odatone", en: "How it looks with Odatone" } as L10n,
  },

  player: {
    eyebrow: { da: "Hør det selv", en: "Hear it yourself" } as L10n,
    title: {
      da: "Musik du faktisk\ngider have kørende\nhele dagen.",
      en: "Music you can\nactually stand\nall day.",
    } as L10n,
    lede: {
      da: "Vælg en stemning, og afspilleren følger med resten af vejen rundt på sitet. Ingen konto, ingen kort.",
      en: "Pick a mood and the player follows you around the rest of the site. No account, no card.",
    } as L10n,
    cta: { da: "Åbn hele biblioteket", en: "Open the full library" } as L10n,
  },

  how: {
    eyebrow: { da: "Sådan virker det", en: "How it works" } as L10n,
    title: { da: "Fem minutter,\nså kører det.", en: "Five minutes,\nthen it runs." } as L10n,
    steps: {
      da: [
        [
          "Fortæl os om rummet",
          "Type forretning, areal og åbningstid. Vi foreslår en plan og en stemning, der passer til den slags gæster, du har.",
        ],
        [
          "Tryk play",
          "I browseren, på iPad'en bag disken eller i app'en. Sæt tidsplaner op, så morgenen lyder anderledes end fredag aften.",
        ],
        [
          "Glem det igen",
          "Vi betaler musikerne, håndterer rettighederne og opdaterer biblioteket. Du får én faktura og ingen breve fra nogen.",
        ],
      ],
      en: [
        [
          "Tell us about the room",
          "Type of business, floor area and opening hours. We suggest a plan and a mood that suits the guests you actually get.",
        ],
        [
          "Press play",
          "In the browser, on the iPad behind the counter or in the app. Set schedules so the morning sounds different from Friday night.",
        ],
        [
          "Forget about it",
          "We pay the musicians, handle the rights and keep the library growing. You get one invoice and no letters from anyone.",
        ],
      ],
    } as Record<"da" | "en", string[][]>,
  },

  legal: {
    eyebrow: { da: "Det juridiske", en: "The legal bit" } as L10n,
    title: { da: "Lovligt.\nPunktum.", en: "Legal.\nFull stop." } as L10n,
    lede: {
      da: "Musikken er skrevet og indspillet til erhvervsbrug, og rettighederne er afregnet direkte med musikerne. Der er ingen tredjepart tilbage at betale — og du får dokumentationen på skrift.",
      en: "The music is written and recorded for commercial use, and the rights are settled directly with the musicians. There is no third party left to pay — and you get the documentation in writing.",
    } as L10n,
    table: {
      head: {
        da: ["", "Almindelig streaming", "Odatone"],
        en: ["", "Ordinary streaming", "Odatone"],
      },
      rows: {
        da: [
          ["Abonnement", "Ja", "Ja"],
          ["Koda-licens", "Skal betales oveni", "Indeholdt"],
          ["Gramex-vederlag", "Skal betales oveni", "Indeholdt"],
          ["Efterregning ved kontrol", "Mulig", "Nej"],
          ["Dokumentation til myndigheder", "Du skaffer den selv", "Følger med abonnementet"],
          ["Musikerne får betaling", "Brøkdele af en øre pr. stream", "Studiehonorar aftalt på forhånd"],
        ],
        en: [
          ["Subscription", "Yes", "Yes"],
          ["Koda licence", "Payable on top", "Included"],
          ["Gramex remuneration", "Payable on top", "Included"],
          ["Back-bill after an audit", "Possible", "No"],
          ["Documentation for the authorities", "You obtain it yourself", "Comes with the subscription"],
          ["Musicians get paid", "Fractions of a penny per stream", "A studio fee agreed up front"],
        ],
      } as Record<"da" | "en", string[][]>,
    },
  },

  artists: {
    eyebrow: { da: "Musikerne", en: "The musicians" } as L10n,
    title: {
      da: "To dage i studiet\nslår en million\nstreams.",
      en: "Two days in the studio\nbeats a million\nstreams.",
    } as L10n,
    lede: {
      da: "Odatones musik bliver ikke genereret. Den bliver skrevet, spillet og indspillet af navngivne musikere, der får et honorar aftalt på forhånd — mere for to dage i studiet end for en million streams på en almindelig tjeneste.",
      en: "Odatone's music is not generated. It is written, played and recorded by named musicians on a fee agreed up front — more for two days in the studio than for a million streams on an ordinary service.",
    } as L10n,
    cta: { da: "Mød musikerne", en: "Meet the musicians" } as L10n,
  },

  proof: {
    eyebrow: { da: "Kunder", en: "Customers" } as L10n,
    title: {
      da: "1.100+ danske\nforretninger har\nskiftet regning ud.",
      en: "1,100+ Danish\nbusinesses have\nswapped their bill.",
    } as L10n,
    /* Only names that actually appear on the current odatone.com. Do not
       add a business here without a signed reference. */
    logos: ["Radisson", "Café Vivaldi", "IkiSushi", "Holy Cow"],
    logosLead: {
      da: "Blandt dem der spiller Odatone",
      en: "Among the businesses playing Odatone",
    } as L10n,
    logosNote: {
      da: "Kundenavne hentet fra det nuværende odatone.com. Bekræft listen — og indsæt rigtige logofiler — inden lancering.",
      en: "Customer names taken from the current odatone.com. Confirm the list — and drop in real logo files — before launch.",
    } as L10n,
    quote: {
      da: "At skifte til Odatone var den nemmeste besparelse, vi nogensinde har fundet. Gæsterne roser musikken, og vi sparer tusindvis hver måned.",
      en: "Switching to Odatone was the easiest saving we ever found. Guests compliment the music and we save thousands every month.",
    } as L10n,
    quoteBy: { da: "Morten Tersby, Holy Cow", en: "Morten Tersby, Holy Cow" } as L10n,
    behaviour: {
      da: [
        ["32 %", "længere ophold når tempoet passer til rummet"],
        ["92 %", "af forretninger oplever længere besøg og højere forbrug"],
        ["90 %", "af gæster vender hellere tilbage til et sted med god musik"],
      ],
      en: [
        ["32%", "longer dwell time when the tempo suits the room"],
        ["92%", "of businesses report longer visits and higher spend"],
        ["90%", "of guests would rather return to a place with good music"],
      ],
    } as Record<"da" | "en", string[][]>,
    behaviourNote: {
      da: "Tal fra det nuværende odatone.com. Kilderne bør angives inden lancering.",
      en: "Figures from the current odatone.com. Sources should be cited before launch.",
    } as L10n,
  },

  faq: {
    eyebrow: { da: "Spørgsmål", en: "Questions" } as L10n,
    title: { da: "Det plejer folk\nat spørge om.", en: "What people\nusually ask." } as L10n,
    items: {
      da: [
        [
          "Hvor hurtigt er jeg i gang?",
          "Fem minutter. Du opretter dig, vælger en stemning og trykker play i browseren. App'en til iOS og Android er der, hvis du hellere vil styre det fra en telefon bag disken.",
        ],
        [
          "Kan jeg have flere zoner i samme lokale?",
          "Ja, fra Medium Stage og op. Restauranten kan køre én stemning, mens baren kører en anden.",
        ],
        [
          "Hvad sker der, hvis nettet går ned?",
          "Afspilleren cacher en buffer lokalt og kører videre. Du opdager det først, når nettet er tilbage.",
        ],
        [
          "Er der binding?",
          "Nej. Månedsabonnementet kan opsiges til udgangen af en måned. Årsabonnementet løber året ud.",
        ],
        [
          "Kan jeg få EAN-faktura?",
          "Ja, på Main Stage — og på de andre planer efter aftale.",
        ],
        [
          "Hvad koster det for flere lokationer?",
          "Prisen er pr. lokation, med rabat fra to og opefter. Regn det ud i beregneren eller ring til os.",
        ],
      ],
      en: [
        [
          "How fast am I up and running?",
          "Five minutes. You sign up, pick a mood and press play in the browser. The iOS and Android app is there if you would rather run it from a phone behind the counter.",
        ],
        [
          "Can I have several zones in one venue?",
          "Yes, from Medium Stage up. The restaurant can run one mood while the bar runs another.",
        ],
        [
          "What happens if the network drops?",
          "The player caches a buffer locally and keeps going. You notice only when the connection is back.",
        ],
        [
          "Is there a lock-in?",
          "No. The monthly subscription can be cancelled to the end of a month. The annual one runs to the end of the year.",
        ],
        [
          "Can I get an EAN invoice?",
          "Yes, on Main Stage — and on the other plans by arrangement.",
        ],
        [
          "What does it cost for several locations?",
          "The price is per location, with a discount from two upwards. Work it out in the calculator or call us.",
        ],
      ],
    } as Record<"da" | "en", string[][]>,
  },

  finalCta: {
    title: {
      da: "Sæt tonen.\nBehold pengene.",
      en: "Set the tone.\nKeep the money.",
    } as L10n,
    lede: {
      da: "14 dage gratis. Intet betalingskort. Fem minutter til musik i højttalerne.",
      en: "14 days free. No card. Five minutes to music in the speakers.",
    } as L10n,
  },
};
