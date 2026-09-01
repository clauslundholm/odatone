import type { L10n } from "@/lib/i18n";

export const artists = {
  eyebrow: { da: "Musikerne", en: "The musicians" } as L10n,
  title: {
    da: "Bag hver tone\nsidder et menneske.",
    en: "Behind every tone\nsits a person.",
  } as L10n,
  lede: {
    da: "Odatones bibliotek bliver ikke genereret og ikke skrabet sammen. Det bliver skrevet, spillet og indspillet af musikere, vi har ringet til, i studier vi har booket, mod et honorar aftalt på forhånd.",
    en: "Odatone's library is not generated and not scraped together. It is written, played and recorded by musicians we phoned, in studios we booked, for a fee agreed up front.",
  } as L10n,

  dealHeading: { da: "Aftalen", en: "The deal" } as L10n,
  deal: {
    da: [
      [
        "Honorar op front",
        "Du får betaling for dagen i studiet — ikke en andel af noget, der måske bliver spillet om tre år. Beløbet er aftalt, før du møder op.",
      ],
      [
        "To dage slår en million streams",
        "En musiker tjener mere på to dage hos os end på en million streams på en almindelig streamingtjeneste. Det er ikke en reklame, det er bare hvad regnestykket giver.",
      ],
      [
        "Dit navn står på det",
        "Hvert nummer krediteres komponist, musikere og producer. Erhvervsmusik behøver ikke være anonym.",
      ],
      [
        "Ingen eksklusivitet på dig",
        "Vi køber retten til numrene, ikke til dig. Du kan udgive, turnere og skrive for hvem du vil ved siden af.",
      ],
    ],
    en: [
      [
        "A fee up front",
        "You are paid for the day in the studio — not a share of something that may or may not get played in three years. The amount is agreed before you turn up.",
      ],
      [
        "Two days beats a million streams",
        "A musician earns more from two days with us than from a million streams on an ordinary streaming service. That is not a slogan, it is just what the arithmetic gives.",
      ],
      [
        "Your name is on it",
        "Every track credits the composer, the players and the producer. Commercial music does not have to be anonymous.",
      ],
      [
        "No exclusivity on you",
        "We buy the rights to the tracks, not to you. You can release, tour and write for anyone else alongside.",
      ],
    ],
  } as Record<"da" | "en", string[][]>,

  applyTitle: { da: "Spiller du?", en: "Do you play?" } as L10n,
  applyBody: {
    da: "Vi optager løbende musikere, sangere og producere til biblioteket. Skriv med et par links til noget, du har lavet — vi hører det hele.",
    en: "We take on musicians, singers and producers for the library on a rolling basis. Write with a couple of links to something you have made — we listen to all of it.",
  } as L10n,
  applyCta: { da: "Skriv til musikredaktionen", en: "Write to the music desk" } as L10n,

  rosterHeading: { da: "I biblioteket lige nu", en: "In the library right now" } as L10n,
  rosterNote: {
    da: "Navnene herunder hører til demobiblioteket i denne prototype og er opdigtede. Erstat dem med den rigtige besætning inden lancering.",
    en: "The names below belong to the demo library in this prototype and are invented. Replace them with the real roster before launch.",
  } as L10n,
};
