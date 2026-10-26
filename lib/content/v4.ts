import type { L10n } from "@/lib/i18n";
import { PROOF } from "@/lib/site";

/* Copy for the product-first landing page. Separate from lib/content/home.ts
   because that file belongs to the marketing home this replaces — keeping
   both in one place would make it impossible to tell, during the
   changeover, which strings are still live. */
export const v4 = {
  search: {
    label: { da: "Søg i biblioteket", en: "Search the library" } as L10n,
    placeholder: {
      da: `Søg i ${PROOF.tracks.toLocaleString("da-DK")}+ numre, musikere og stemninger`,
      en: `Search ${PROOF.tracks.toLocaleString("en-GB")}+ tracks, musicians and moods`,
    } as L10n,
  },
  nav: {
    pricing: { da: "Priser", en: "Pricing" } as L10n,
    login: { da: "Log ind", en: "Log in" } as L10n,
    cta: { da: `Prøv ${PROOF.trialDays} dage gratis`, en: `Try ${PROOF.trialDays} days free` } as L10n,
  },
  rail: {
    home: { da: "Forside", en: "Home" } as L10n,
    search: { da: "Søg", en: "Search" } as L10n,
    build: { da: "Byg din liste", en: "Build your list" } as L10n,
    seasons: { da: "Sæsoner", en: "Seasons" } as L10n,
    moods: { da: "Stemninger", en: "Moods" } as L10n,
    /** "{price}" is the cheapest ACTIVE plan, read from the database and
        passed in — never written out here. The design shows 149 kr., which
        is Small Venue's price, and Small Venue is no longer sold. */
    priceFrom: { da: "Fra {price} / måned", en: "From {price} / month" } as L10n,
    priceNote: {
      da: "Hele biblioteket, pr. lokation. Ingen Koda, ingen Gramex, ingen binding.",
      en: "The whole library, per location. No Koda, no Gramex, no commitment.",
    } as L10n,
  },
  hero: {
    eyebrow: { da: "Lovlig baggrundsmusik til erhverv", en: "Licensed background music for business" } as L10n,
    title: {
      da: `${PROOF.tracks.toLocaleString("da-DK")}+ numre til rummet.\nTryk play.`,
      en: `${PROOF.tracks.toLocaleString("en-GB")}+ tracks for the room.\nPress play.`,
    } as L10n,
    lede: {
      da: "Har det hele, før du opretter dig: ingen Koda, ingen Gramex.",
      en: "Everything before you sign up: no Koda, no Gramex.",
    } as L10n,
    play: { da: "Afspil", en: "Play" } as L10n,
    build: { da: "Byg din egen liste", en: "Build your own list" } as L10n,
    stats: {
      tracks: { da: "numre", en: "tracks" } as L10n,
      genres: { da: "genrer", en: "genres" } as L10n,
      languages: { da: "vokal og instrumental", en: "vocal and instrumental" } as L10n,
      musicians: { da: "rigtige musikere", en: "real musicians" } as L10n,
    },
  },
  sections: {
    now: { da: "Til rummet lige nu", en: "For the room right now" } as L10n,
    lists: { da: "Kuraterede lister", en: "Curated lists" } as L10n,
    artists: { da: "Mød musikerne", en: "Meet the musicians" } as L10n,
    genres: { da: "Genrer", en: "Genres" } as L10n,
    seeAll: { da: "Se alle", en: "See all" } as L10n,
  },
  builder: {
    heading: { da: "Byg din egen liste", en: "Build your own list" } as L10n,
    genre: { da: "Genre", en: "Genre" } as L10n,
    vocal: { da: "Vokal", en: "Vocals" } as L10n,
    vocalAny: { da: "Begge", en: "Either" } as L10n,
    vocalYes: { da: "Med vokal", en: "With vocals" } as L10n,
    vocalNo: { da: "Instrumental", en: "Instrumental" } as L10n,
    tempo: { da: "Tempo", en: "Tempo" } as L10n,
    /** "{n}" is filterTracks' own count — the same function the player
        queues from, so the number cannot promise more than Afspil plays. */
    matches: { da: "{n} numre passer", en: "{n} tracks match" } as L10n,
    matchesOne: { da: "1 nummer passer", en: "1 track matches" } as L10n,
    none: { da: "Ingen numre passer endnu", en: "No tracks match yet" } as L10n,
    play: { da: "Afspil", en: "Play" } as L10n,
    save: { da: "Gem listen", en: "Save the list" } as L10n,
    saveNote: {
      da: "Gem kræver en gratis profil. Musikken spiller videre.",
      en: "Saving needs a free profile. The music keeps playing.",
    } as L10n,
    reset: { da: "Nulstil", en: "Reset" } as L10n,
  },
  nowPlaying: {
    heading: { da: "Spiller nu", en: "Playing now" } as L10n,
    nothing: { da: "Intet spiller endnu", en: "Nothing playing yet" } as L10n,
    nothingNote: {
      da: "Vælg en stemning, så kører det.",
      en: "Pick a mood and it runs.",
    } as L10n,
  },
  seasons: {
    heading: { da: "Sæsoner", en: "Seasons" } as L10n,
    lede: {
      da: "Tryk på en sæson, så skifter rummet. Hver sæson er en måde at spille på, ikke en fast liste.",
      en: "Tap a season and the room changes. Each one is a way of playing, not a fixed list.",
    } as L10n,
    inSeason: { da: "Lige nu", en: "Right now" } as L10n,
    play: { da: "Afspil", en: "Play" } as L10n,
    count: { da: "{n} numre", en: "{n} tracks" } as L10n,
    /* Said rather than hidden: with a placeholder catalogue most seasons
       match nothing, and a play button that does nothing is worse than an
       empty state that admits it. */
    empty: { da: "Ingen numre endnu", en: "No tracks yet" } as L10n,
    note: {
      da: "Sæsonerne her er Odatones egne. Hver genre hos 1000TRAX har allerede seasonStart og seasonEnd — udfylder de dem, kommer sæsonerne fra kataloget i stedet.",
      en: "These seasons are Odatone's own. Every 1000TRAX genre already carries seasonStart and seasonEnd — if they fill those in, seasons come from the catalogue instead.",
    } as L10n,
  },

  footer: {
    copyright: { da: "© 2026 Odatone", en: "© 2026 Odatone" } as L10n,
    about: { da: "Om os", en: "About" } as L10n,
    terms: { da: "Vilkår", en: "Terms" } as L10n,
    privacy: { da: "Privatliv", en: "Privacy" } as L10n,
    contact: { da: "Kontakt", en: "Contact" } as L10n,
  },
} as const;
