import type { L10n } from "@/lib/i18n";

export const contact = {
  eyebrow: { da: "Kontakt salg", en: "Talk to sales" } as L10n,
  title: {
    da: "Flere lokationer?\nRing os op —\neller omvendt.",
    en: "Several locations?\nCall us —\nor the other way round.",
  } as L10n,
  lede: {
    da: "Kæder, hoteller og alt med mere end en håndfuld adresser får en pris og en opsætning, der passer. Vi vender tilbage inden for én arbejdsdag.",
    en: "Chains, hotels and anything with more than a handful of addresses get a price and a setup that fits. We come back within one working day.",
  } as L10n,

  formHeading: { da: "Bliv ringet op", en: "Get a call back" } as L10n,
  fields: {
    name: { da: "Navn", en: "Name" } as L10n,
    company: { da: "Virksomhed", en: "Company" } as L10n,
    email: { da: "E-mail", en: "Email" } as L10n,
    phone: { da: "Telefon", en: "Phone" } as L10n,
    locations: { da: "Antal lokationer", en: "Number of locations" } as L10n,
    message: { da: "Hvad drejer det sig om?", en: "What is it about?" } as L10n,
  },
  optional: { da: "valgfri", en: "optional" } as L10n,
  submit: { da: "Send og bliv ringet op", en: "Send and get a call" } as L10n,
  sending: { da: "Sender…", en: "Sending…" } as L10n,
  successTitle: { da: "Tak — vi har den.", en: "Thanks — we have it." } as L10n,
  successBody: {
    da: "Vi ringer inden for én arbejdsdag. Har du travlt, så skriv direkte til {email}.",
    en: "We call within one working day. In a hurry? Write straight to {email}.",
  } as L10n,
  errorRequired: { da: "Feltet skal udfyldes", en: "This field is required" } as L10n,
  errorEmail: { da: "Skriv en gyldig e-mail", en: "Enter a valid email" } as L10n,

  demoNote: {
    da: "Formularen validerer og logger på serveren i denne prototype — den sender endnu ikke en mail.",
    en: "In this prototype the form validates and logs on the server — it does not send mail yet.",
  } as L10n,

  asideHeading: { da: "Eller bare skriv", en: "Or just write" } as L10n,
  quickFacts: {
    da: [
      ["Svartid", "Én arbejdsdag"],
      ["Prøveperiode", "14 dage, intet kort"],
      ["Opsætning", "Fem minutter pr. lokation"],
      ["Sprog", "Dansk og engelsk"],
    ],
    en: [
      ["Response time", "One working day"],
      ["Trial", "14 days, no commitment"],
      ["Setup", "Five minutes per location"],
      ["Languages", "Danish and English"],
    ],
  } as Record<"da" | "en", string[][]>,
};
