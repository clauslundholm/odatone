import type { L10n } from "@/lib/i18n";

export const legal = {
  note: {
    da: "Prototype-tekst. Få dokumentet gennemgået af en jurist, og indsæt de rigtige selskabsoplysninger, inden sitet går i luften.",
    en: "Prototype text. Have this reviewed by a lawyer and insert the real company details before the site goes live.",
  } as L10n,

  privacy: {
    title: { da: "Privatlivspolitik", en: "Privacy policy" } as L10n,
    updated: { da: "Senest opdateret 31. august 2026", en: "Last updated 31 August 2026" } as L10n,
    sections: {
      da: [
        [
          "Hvem er dataansvarlig",
          "Odatone er dataansvarlig for de personoplysninger, du giver os, når du opretter et abonnement, kontakter salg eller bruger afspilleren. Kontakt os på info@odatone.com.",
        ],
        [
          "Hvilke oplysninger vi behandler",
          "Ved oprettelse: navn, virksomhed, CVR-nummer, adresse, e-mail og telefonnummer. Ved betaling: de oplysninger vores betalingsudbyder har brug for — vi opbevarer ikke selv kortnumre. Ved brug af afspilleren: hvilke numre der afspilles hvor, så vi kan afregne med musikerne.",
        ],
        [
          "Hvorfor vi behandler dem",
          "For at levere abonnementet (aftalens opfyldelse), for at overholde bogføringsloven (retlig forpligtelse) og for at forbedre biblioteket (legitim interesse).",
        ],
        [
          "Hvor længe vi gemmer dem",
          "Kundeoplysninger gemmes, så længe abonnementet løber, og derefter i fem år, som bogføringsloven kræver. Afspilningsdata aggregeres efter tolv måneder.",
        ],
        [
          "Cookies",
          "Sitet bruger de cookies, der er nødvendige for at holde dig logget ind og huske sprog og tema. Vi sætter ikke markedsføringscookies uden dit samtykke.",
        ],
        [
          "Dine rettigheder",
          "Du kan bede om indsigt, rettelse, sletning eller begrænsning, og du kan gøre indsigelse mod behandlingen. Skriv til info@odatone.com. Du kan klage til Datatilsynet.",
        ],
      ],
      en: [
        [
          "Who is the data controller",
          "Odatone is the controller for the personal data you give us when you set up a subscription, contact sales or use the player. Contact us at info@odatone.com.",
        ],
        [
          "What we process",
          "At signup: name, company, company registration number, address, email and phone. At payment: whatever our payment provider needs — we do not store card numbers ourselves. In the player: which tracks are played where, so we can settle with the musicians.",
        ],
        [
          "Why we process it",
          "To deliver the subscription (performance of a contract), to comply with Danish bookkeeping law (legal obligation) and to improve the library (legitimate interest).",
        ],
        [
          "How long we keep it",
          "Customer data is kept for as long as the subscription runs and then for five years, as bookkeeping law requires. Playback data is aggregated after twelve months.",
        ],
        [
          "Cookies",
          "The site uses the cookies needed to keep you signed in and to remember your language and theme. We set no marketing cookies without your consent.",
        ],
        [
          "Your rights",
          "You can request access, correction, erasure or restriction, and you can object to the processing. Write to info@odatone.com. You may complain to the Danish Data Protection Agency.",
        ],
      ],
    } as Record<"da" | "en", string[][]>,
  },

  terms: {
    title: { da: "Handelsbetingelser", en: "Terms of business" } as L10n,
    updated: { da: "Senest opdateret 31. august 2026", en: "Last updated 31 August 2026" } as L10n,
    sections: {
      da: [
        [
          "Abonnementet",
          "Et abonnement giver ret til at afspille Odatones musik offentligt på den registrerede lokation, i det omfang planen dækker. Prisen er pr. lokation pr. måned og angives ekskl. moms.",
        ],
        [
          "Hvad rettighederne dækker",
          "Odatone har erhvervet de nødvendige rettigheder til musikken i biblioteket, og afspilning gennem Odatone udløser derfor ikke særskilt betaling til Koda eller Gramex. Rettighederne dækker baggrundsmusik i erhvervslokaler. Livemusik, arrangementer med entré, udsendelse og videreformidling er ikke omfattet.",
        ],
        [
          "Prøveperiode",
          "De første 14 dage er gratis. Opsiger du inden periodens udløb, opkræves der ingenting.",
        ],
        [
          "Betaling og opsigelse",
          "Månedsabonnement faktureres forud og kan opsiges til udgangen af en måned. Årsabonnement faktureres forud for tolv måneder og løber perioden ud. Ved manglende betaling kan adgangen lukkes efter rykker.",
        ],
        [
          "Driftssikkerhed",
          "Vi tilstræber en oppetid på 99,5 % pr. måned. Planlagt vedligehold varsles. Main Stage-kunder kan aftale en SLA.",
        ],
        [
          "Ansvar",
          "Odatone er ikke ansvarlig for indirekte tab. Erstatningsansvaret kan ikke overstige det beløb, kunden har betalt de seneste tolv måneder.",
        ],
        [
          "Ændringer",
          "Prisændringer varsles med 30 dages skriftligt varsel. Er du uenig, kan du opsige inden ændringen træder i kraft.",
        ],
      ],
      en: [
        [
          "The subscription",
          "A subscription gives the right to play Odatone's music publicly at the registered location, to the extent the plan covers. The price is per location per month and is quoted excluding VAT.",
        ],
        [
          "What the rights cover",
          "Odatone has acquired the necessary rights to the music in the library, so playback through Odatone does not trigger separate payment to Koda or Gramex. The rights cover background music in commercial premises. Live music, ticketed events, broadcast and redistribution are not included.",
        ],
        [
          "Trial",
          "The first 14 days are free. Cancel before the period ends and nothing is charged.",
        ],
        [
          "Payment and cancellation",
          "Monthly subscriptions are invoiced in advance and can be cancelled to the end of a month. Annual subscriptions are invoiced twelve months in advance and run to the end of the period. Access may be suspended after a reminder if payment fails.",
        ],
        [
          "Availability",
          "We aim for 99.5% uptime per month. Planned maintenance is announced. Main Stage customers can agree an SLA.",
        ],
        [
          "Liability",
          "Odatone is not liable for indirect losses. Liability cannot exceed what the customer has paid over the past twelve months.",
        ],
        [
          "Changes",
          "Price changes are given 30 days' written notice. If you disagree, you can cancel before the change takes effect.",
        ],
      ],
    } as Record<"da" | "en", string[][]>,
  },
};
