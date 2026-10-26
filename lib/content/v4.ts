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
    login: { da: "Log ind", en: "Log in" } as L10n,
    cta: { da: `Prøv ${PROOF.trialDays} dage gratis`, en: `Try ${PROOF.trialDays} days free` } as L10n,
  },
  rail: {
    home: { da: "Forside", en: "Home" } as L10n,
    search: { da: "Søg", en: "Search" } as L10n,
    build: { da: "Byg din liste", en: "Build your list" } as L10n,
    seasons: { da: "Sæsoner", en: "Seasons" } as L10n,
    moods: { da: "Stemninger", en: "Moods" } as L10n,
    yourLists: { da: "Dine lister", en: "Your lists" } as L10n,
    newList: { da: "Ny liste", en: "New list" } as L10n,
    newListNote: {
      da: "Gemmes med en gratis profil",
      en: "Saved with a free profile",
    } as L10n,
    dragHint: {
      da: "Træk ind i ugeplanen",
      en: "Drag into the week",
    } as L10n,
    /** "{n}" is filterTracks' own count for that mood. */
    trackCount: { da: "{n} numre", en: "{n} tracks" } as L10n,
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
    /** "{list}" is the curated list the hero's play button actually
        queues, so the button names what it is about to play. */
    playList: { da: "Afspil {list}", en: "Play {list}" } as L10n,
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
  },
  builder: {
    heading: { da: "Byg din egen liste", en: "Build your own list" } as L10n,
    /** The badge on the builder card: the count below it moves as the
        filters move, rather than after a submit. */
    live: { da: "Live", en: "Live" } as L10n,
    /** "{min}" is the summed duration of the matching tracks. */
    runtime: {
      da: "{min} min · opdaterer sig selv",
      en: "{min} min · keeps itself current",
    } as L10n,
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
    /** Shown instead of the heading when the current filters are exactly
        one of the curated lists — so the card says where the music came
        from rather than only what is playing. */
    from: { da: "Spiller fra {list}", en: "Playing from {list}" } as L10n,
    nothing: { da: "Intet spiller endnu", en: "Nothing playing yet" } as L10n,
    nothingNote: {
      da: "Vælg en stemning, så kører det.",
      en: "Pick a mood and it runs.",
    } as L10n,
  },
  schedule: {
    heading: { da: "Spilleplan", en: "Schedule" } as L10n,
    lede: {
      da: "Træk en liste ind på ugen. Musikken skifter af sig selv.",
      en: "Drop a list onto the week. The music changes by itself.",
    } as L10n,
    add: { da: "Tilføj blok", en: "Add block" } as L10n,
    save: { da: "Gem ugen", en: "Save the week" } as L10n,
    empty: {
      da: "Ingen blokke endnu. Tilføj én, så kører ugen af sig selv.",
      en: "No blocks yet. Add one and the week runs itself.",
    } as L10n,
    signedOut: {
      da: "Log ind for at se og redigere jeres spilleplan.",
      en: "Sign in to see and edit your schedule.",
    } as L10n,
    signIn: { da: "Log ind", en: "Sign in" } as L10n,
  },

  /* The Ugeplan editor. Separate from `schedule` above, which is the
     read-only copy the page used before it could be edited. */
  planner: {
    heading: { da: "Ugeplan", en: "Weekly plan" } as L10n,
    lede: {
      da: "Design hvad der spiller i højttalerne – time for time, hele ugen.",
      en: "Design what plays in the speakers — hour by hour, all week.",
    } as L10n,
    location: { da: "Lokation", en: "Location" } as L10n,
    copyToLocations: { da: "Kopiér til lokationer", en: "Copy to locations" } as L10n,
    showSpots: { da: "Vis lydindslag", en: "Show audio spots" } as L10n,
    offPlan: { da: "Uden for planen", en: "Outside the plan" } as L10n,
    fallback: {
      silence: { da: "Stilhed", en: "Silence" } as L10n,
      calm: { da: "Spil “Rolig”", en: "Play “Calm”" } as L10n,
      continue: { da: "Fortsæt sidste liste", en: "Keep the last list" } as L10n,
    },
    /** "{hours}" is the week's planned music, summed from the blocks. */
    statMusic: { da: "{hours} musik planlagt", en: "{hours} of music planned" } as L10n,
    statLists: { da: "{n} lister i brug", en: "{n} lists in use" } as L10n,
    plannedTotal: { da: "{hours} i alt", en: "{hours} in total" } as L10n,

    list: { da: "Playliste", en: "Playlist" } as L10n,
    day: { da: "Dag", en: "Day" } as L10n,
    from: { da: "Fra", en: "From" } as L10n,
    to: { da: "Til", en: "To" } as L10n,
    copyTo: { da: "Kopiér blokken til", en: "Copy the block to" } as L10n,
    copyGo: { da: "Kopiér til valgte dage", en: "Copy to the chosen days" } as L10n,
    deleteBlock: { da: "Slet blok", en: "Delete block" } as L10n,
    distribution: { da: "Ugens fordeling", en: "The week's spread" } as L10n,

    emptyHeading: { da: "Design jeres uge", en: "Design your week" } as L10n,
    emptyLede: {
      da: "Vælg en blok for at redigere den, eller opret en ny.",
      en: "Pick a block to edit it, or make a new one.",
    } as L10n,
    tips: {
      create: {
        da: "Træk i en tom dag for at oprette en blok.",
        en: "Drag on an empty day to make a block.",
      } as L10n,
      drag: {
        da: "Træk en liste fra menuen til venstre ind på en dag.",
        en: "Drag a list from the rail onto a day.",
      } as L10n,
      move: {
        da: "Flyt og forlæng ved at trække i blokken eller i dens bund.",
        en: "Move and stretch by dragging the block, or its foot.",
      } as L10n,
      keys: {
        da: "Delete sletter den valgte blok. Esc fravælger.",
        en: "Delete removes the chosen block. Esc deselects.",
      } as L10n,
    },

    /* Says what is true and no more. The week is kept, but it is kept
       HERE — it does not follow anyone to an account yet, and a banner
       that implied it did would be found out the first time someone
       signed up expecting their Friday back. */
    demoNote: {
      da: "Du prøver ugeplanen. Alt virker, og ugen huskes i denne browser — men den følger ikke med over i en konto endnu.",
      en: "You are trying the weekly plan. Everything works and the week is remembered in this browser — but it does not follow you to an account yet.",
    } as L10n,
    demoReset: { da: "Nulstil ugen", en: "Reset the week" } as L10n,
    demoSave: { da: "Opret gratis profil", en: "Create a free profile" } as L10n,

    noLocations: {
      da: "Opret en lokation i Mit Odatone, før I lægger en ugeplan.",
      en: "Add a location in My Odatone before planning a week.",
    } as L10n,
    noLists: {
      da: "I har ingen gemte lister endnu. Byg en på forsiden, så kan den lægges ind i ugen.",
      en: "You have no saved lists yet. Build one on the front page and it can go into the week.",
    } as L10n,

    /* Said rather than swallowed: every one of these is a write that did
       not happen, and a grid that silently snapped back would be read as
       a bug in the dragging. */
    savedNothing: { da: "Der er ikke plads til en blok her", en: "No room for a block here" } as L10n,
    overlap: { da: "Der spiller allerede musik på det tidspunkt", en: "Music is already playing then" } as L10n,
    denied: { da: "Ændringen blev ikke gemt", en: "That change was not saved" } as L10n,
    copied: {
      da: "Kopieret til {n} dage",
      en: "Copied to {n} days",
    } as L10n,
    copiedReplaced: {
      da: "Kopieret til {n} dage · {r} blokke erstattet",
      en: "Copied to {n} days · {r} blocks replaced",
    } as L10n,
    copiedLocations: {
      da: "Ugeplanen er kopieret til {n} lokationer",
      en: "The week was copied to {n} locations",
    } as L10n,
    copyLocHeading: { da: "Kopiér til andre lokationer", en: "Copy to other locations" } as L10n,
    copyLocLede: {
      da: "Kopiér ugeplanen fra {name} til jeres andre lokationer.",
      en: "Copy the week from {name} to your other locations.",
    } as L10n,
    copyLocWarning: {
      da: "Den eksisterende plan på de valgte lokationer bliver erstattet.",
      en: "The existing plan on the chosen locations is replaced.",
    } as L10n,
    copyLocOnly: {
      da: "I har kun én lokation.",
      en: "You only have one location.",
    } as L10n,
    cancel: { da: "Annullér", en: "Cancel" } as L10n,
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
    getStarted: { da: "Kom i gang", en: "Get started" } as L10n,
    terms: { da: "Vilkår", en: "Terms" } as L10n,
    privacy: { da: "Privatliv", en: "Privacy" } as L10n,
    contact: { da: "Kontakt", en: "Contact" } as L10n,
  },
} as const;
