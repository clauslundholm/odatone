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
    /** The same offer, short enough that the phone header is two rows
        rather than three. The day count is the first thing to go: it is
        on the page they land on anyway. */
    ctaShort: { da: "Prøv gratis", en: "Try it free" } as L10n,
  },
  rail: {
    home: { da: "Forside", en: "Home" } as L10n,
    build: { da: "Byg din liste", en: "Build your list" } as L10n,
    seasons: { da: "Sæsoner", en: "Seasons" } as L10n,
    moods: { da: "Stemninger", en: "Moods" } as L10n,
    yourLists: { da: "Dine lister", en: "Your lists" } as L10n,
    menu: { da: "Menu", en: "Menu" } as L10n,
    closeMenu: { da: "Luk menuen", en: "Close the menu" } as L10n,
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
      da: "Hør det hele, før du opretter dig. Ingen Koda, ingen Gramex.",
      en: "Hear it all before you sign up. No Koda, no Gramex.",
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
    /* Its own row under Vokal rather than a third vocal option: "Dansk
       vokal" as a sibling of "Instrumental" conflated two questions —
       whether there is singing, and what it is sung in — and left no way
       to ask for English at all. */
    language: { da: "Sprog", en: "Language" } as L10n,
    /** Shown in place of the choice when the filter is set to
        instrumental, where a language cannot apply. */
    languageNone: { da: "Instrumental har intet sprog", en: "An instrumental has no language" } as L10n,
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
    statSpots: { da: "{n} aktive lydindslag", en: "{n} active audio spots" } as L10n,
    statPerWeek: { da: "≈ {n} indslag om ugen", en: "≈ {n} spots a week" } as L10n,
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

  /* Rediger liste — the editor behind a customer's own saved list.
     The table has been there since 0015_playlists_and_schedule.sql,
     whose own header names this screen as the thing it was written for;
     this is the screen. */
  list: {
    /** A new list copied out of a curated one keeps its parentage in the
        name, because that is what the customer will look for in the rail
        an hour later. */
    copyOf: { da: "Kopi af {name}", en: "Copy of {name}" } as L10n,
    untitled: { da: "Min liste", en: "My list" } as L10n,
    ledeCopy: {
      da: "Din egen version. Den kuraterede original ændres ikke.",
      en: "Your own version. The curated original is left alone.",
    } as L10n,
    ledeOwn: {
      da: "Din egen liste. Reglerne bestemmer, hvad der spiller.",
      en: "Your own list. The rules decide what plays.",
    } as L10n,

    play: { da: "Afspil", en: "Play" } as L10n,
    save: { da: "Gem listen", en: "Save the list" } as L10n,
    saving: { da: "Gemmer …", en: "Saving …" } as L10n,
    saved: { da: "Gemt", en: "Saved" } as L10n,

    details: { da: "Detaljer", en: "Details" } as L10n,
    name: { da: "Navn", en: "Name" } as L10n,
    basedOn: { da: "Baseret på", en: "Based on" } as L10n,
    basedOnNone: { da: "Bygget fra bunden", en: "Built from scratch" } as L10n,

    /* The design puts Starter / Slutter / Dage here. They are not fields
       any more: 0016 moved the schedule onto the location, to the
       quarter hour, with a drag grid and a copy-to-locations action —
       so a second, weaker editor on this page could not even say WHICH
       room it meant. What the panel shows instead is where this list
       actually plays, and a way to the screen that sets it. */
    whenPlays: { da: "Hvornår spiller den", en: "When it plays" } as L10n,
    whenNone: {
      da: "Ikke sat på ugeplanen endnu",
      en: "Not on the weekly plan yet",
    } as L10n,
    whenSet: { da: "Sæt på ugeplanen", en: "Put it on the week" } as L10n,
    /** "{n}" blocks across "{m}" locations. */
    whenCount: {
      da: "{n} blokke på {m} lokationer",
      en: "{n} blocks across {m} locations",
    } as L10n,
    whenCountOne: { da: "{n} blokke på én lokation", en: "{n} blocks at one location" } as L10n,

    music: { da: "Musikken", en: "The music" } as L10n,
    musicLede: {
      da: "Reglerne, ikke numrene. Justér dem, og listen følger med — også når biblioteket vokser.",
      en: "The rules, not the tracks. Adjust them and the list follows — including as the library grows.",
    } as L10n,

    matchesHeading: { da: "Det passer lige nu", en: "Matching right now" } as L10n,
    matchesNote: {
      da: "Opdaterer sig selv, når reglerne ændres.",
      en: "Keeps itself current as the rules change.",
    } as L10n,
    matchesMore: { da: "… og {n} mere", en: "… and {n} more" } as L10n,

    delete: { da: "Slet denne liste", en: "Delete this list" } as L10n,
    deleteNote: {
      da: "Den forsvinder også fra ugeplanen, hvor den er lagt ind.",
      en: "It also leaves the weekly plan wherever it was placed.",
    } as L10n,

    notFound: {
      da: "Listen findes ikke — eller den er ikke jeres.",
      en: "That list does not exist, or it is not yours.",
    } as L10n,
    signedOut: {
      da: "Log ind for at redigere jeres lister.",
      en: "Sign in to edit your lists.",
    } as L10n,
  },

  /* The signed-in account area — the four Konto tabs and the chrome that
     only exists once somebody is logged in (the header chip, the rail's
     plan card). Kept here rather than in lib/content/portal.ts, which
     belongs to the /my-odatone chrome this replaces: that file's strings
     are written for a sidebar-and-breadcrumb console, these for the
     product shell, and a shared table would quietly tie the two together
     again. The status, role and invoice-status tables ARE shared from
     there, because a status word does not change with its surroundings. */
  account: {
    heading: { da: "Konto", en: "Account" } as L10n,
    /** "{company}" is the customer's own name, "{date}" their start. */
    subheading: {
      da: "{company} · Kunde siden {date}",
      en: "{company} · Customer since {date}",
    } as L10n,
    /** The header chip's accessible name — the visible part is the
        company name beside a monogram. */
    chipLabel: { da: "Din konto", en: "Your account" } as L10n,
    signOut: { da: "Log ud", en: "Sign out" } as L10n,

    /* The signed-in front page's own hero, in place of the marketing
       one. A customer who is already paying does not need to be sold
       the library again — they need to know what is playing in the shop
       and how to change it. */
    home: {
      /** "{location}" is the room the week is answering for. */
      eyebrow: { da: "Spiller nu i {location}", en: "Playing now in {location}" } as L10n,
      eyebrowIdle: { da: "Din ugeplan", en: "Your weekly plan" } as L10n,
      /** "{list}" is whichever list the week has on at this moment. */
      title: {
        da: "{list} spiller.\nResten passer sig selv.",
        en: "{list} is on.\nThe rest looks after itself.",
      } as L10n,
      titleIdle: {
        da: "Ugen er tom.\nLæg den første blok ind.",
        en: "The week is empty.\nPut the first block in.",
      } as L10n,
      lede: {
        da: "Ugeplanen kører på {n} lokationer. Skift når du vil.",
        en: "The week runs across {n} locations. Change it whenever.",
      } as L10n,
      ledeOne: {
        da: "Ugeplanen kører i {name}. Skift når du vil.",
        en: "The week runs in {name}. Change it whenever.",
      } as L10n,
      ledeIdle: {
        da: "Træk en liste ind på ugen, så kører resten af sig selv.",
        en: "Drop a list onto the week and the rest looks after itself.",
      } as L10n,
      play: { da: "Afspil {list}", en: "Play {list}" } as L10n,
      openWeek: { da: "Åbn ugeplanen", en: "Open the week" } as L10n,

      statLocations: { da: "lokationer", en: "locations" } as L10n,
      statLocationsOne: { da: "lokation", en: "location" } as L10n,
      statBlocks: { da: "blokke på ugen", en: "blocks in the week" } as L10n,
      /* The design reads "38 t spillet i oktober". Nothing records what
         has been played — there is no playback log — so this states what
         the week has planned, which is a fact this app owns. */
      statPlanned: { da: "planlagt om ugen", en: "planned each week" } as L10n,
      statRights: { da: "i Koda og Gramex", en: "in Koda and Gramex" } as L10n,
      /** "{n}" whole hours. */
      hours: { da: "{n} t", en: "{n} h" } as L10n,
    },

    tabs: {
      summary: { da: "Oversigt", en: "Overview" } as L10n,
      billing: { da: "Fakturering", en: "Billing" } as L10n,
      locations: { da: "Lokationer", en: "Locations" } as L10n,
      settings: { da: "Indstillinger", en: "Settings" } as L10n,
    },
    tabsLabel: { da: "Kontoens sider", en: "Account pages" } as L10n,

    /* The rail's foot once signed in, where the price pitch stands for a
       visitor. "{n}" locations, "{price}" per month, "{date}" renewal. */
    rail: {
      yourPlan: { da: "Din plan", en: "Your plan" } as L10n,
      locations: { da: "{n} lokationer · {price}/md.", en: "{n} locations · {price}/mo." } as L10n,
      locationsOne: { da: "1 lokation · {price}/md.", en: "1 location · {price}/mo." } as L10n,
      renews: { da: "Fornyes {date}", en: "Renews {date}" } as L10n,
      noPlan: { da: "Ingen plan endnu", en: "No plan yet" } as L10n,
      /** The "Ny liste" subtitle changes once there is an account to save
          a list to — signed out it advertises the profile, signed in it
          simply says where the list goes. */
      newListNote: { da: "Gemmes på din konto", en: "Saved to your account" } as L10n,
    },

    /* Shown in the main column where a page needs a session and there is
       none — the same posture components/v4/schedule/DemoPlanner takes on
       the Ugeplan rather than bouncing anyone to a login. */
    signedOutHeading: { da: "Log ind for at se din konto", en: "Sign in to see your account" } as L10n,
    signedOutLede: {
      da: "Abonnement, fakturaer og lokationer ligger bag login. Musikken spiller videre imens.",
      en: "Subscription, invoices and locations sit behind a login. The music keeps playing meanwhile.",
    } as L10n,
    signIn: { da: "Log ind", en: "Sign in" } as L10n,

    stats: {
      subscription: { da: "Abonnement", en: "Subscription" } as L10n,
      locations: { da: "Lokationer", en: "Locations" } as L10n,
      nextInvoice: { da: "Næste faktura", en: "Next invoice" } as L10n,
      planLimit: { da: "Planens grænse", en: "The plan's limit" } as L10n,
      /** "{price}" is this plan's monthly charge, ex. VAT. */
      perMonthExVat: { da: "{price}/md. ekskl. moms", en: "{price}/mo. ex. VAT" } as L10n,
      perYearExVat: { da: "{price}/år ekskl. moms", en: "{price}/yr ex. VAT" } as L10n,
      incVat: { da: "{price} inkl. moms", en: "{price} incl. VAT" } as L10n,
      active: { da: "{n} aktive", en: "{n} active" } as L10n,
      activeOne: { da: "1 aktiv", en: "1 active" } as L10n,
      /** "{n}" locations are larger than "{m2}", the plan's own bound. */
      over: { da: "{n} over planens {m2}", en: "{n} over the plan's {m2}" } as L10n,
      allWithin: { da: "Alle inden for planen", en: "All within the plan" } as L10n,
      perLocation: { da: "{m2} pr. lokation", en: "{m2} per location" } as L10n,
      noLimit: { da: "Ingen grænse", en: "No limit" } as L10n,
      none: { da: "—", en: "—" } as L10n,
      ownWeek: {
        da: "Hver lokation spiller efter sin egen ugeplan",
        en: "Each location plays to its own weekly plan",
      } as L10n,
    },

    company: {
      panel: { da: "Virksomhed", en: "Company" } as L10n,
      edit: { da: "Redigér", en: "Edit" } as L10n,
      name: { da: "Firma", en: "Company" } as L10n,
      cvr: { da: "CVR", en: "VAT no." } as L10n,
      contact: { da: "Kontakt", en: "Contact" } as L10n,
      email: { da: "E-mail", en: "Email" } as L10n,
      since: { da: "Kunde siden", en: "Customer since" } as L10n,
      status: { da: "Status", en: "Status" } as L10n,
    },

    plan: {
      panel: { da: "Abonnement", en: "Subscription" } as L10n,
      /* No self-service plan change exists — there is no payment provider
         wired up at all — so this is a conversation, and the link says
         where that conversation happens rather than opening a flow that
         is not there. */
      change: { da: "Skift plan", en: "Change plan" } as L10n,
      plan: { da: "Plan", en: "Plan" } as L10n,
      billing: { da: "Betaling", en: "Billing" } as L10n,
      monthly: { da: "Månedlig", en: "Monthly" } as L10n,
      annual: { da: "Årlig", en: "Annual" } as L10n,
      price: { da: "Pris", en: "Price" } as L10n,
      renews: { da: "Fornyes", en: "Renews" } as L10n,
      status: { da: "Status", en: "Status" } as L10n,
      vat: { da: "Moms", en: "VAT" } as L10n,
      /** "{pct}" is the rate, "{amount}" what it comes to on this term. */
      vatValue: { da: "{pct} · {amount}", en: "{pct} · {amount}" } as L10n,
      includes: { da: "Indeholder", en: "Includes" } as L10n,
      none: {
        da: "I har ingen aktiv plan endnu. Skriv til os, så sætter vi den op.",
        en: "You have no active plan yet. Write to us and we will set one up.",
      } as L10n,
    },

    payment: {
      panel: { da: "Betalingsmetode", en: "Payment method" } as L10n,
      /* The design draws a stored card. There is none: no payment
         provider is connected (see components/signup/SignupFlow.tsx's own
         note on the card it collects and never charges), so this says
         what actually happens — an invoice by email — rather than
         inventing four digits. */
      none: { da: "Ingen kort gemt", en: "No card on file" } as L10n,
      noneNote: {
        da: "Fakturaen sendes på e-mail og betales ved bankoverførsel.",
        en: "The invoice is emailed and paid by bank transfer.",
      } as L10n,
      sentTo: { da: "Sendes til {email}", en: "Sent to {email}" } as L10n,
    },

    invoices: {
      panel: { da: "Fakturaer", en: "Invoices" } as L10n,
      number: { da: "Nummer", en: "Number" } as L10n,
      period: { da: "Periode", en: "Period" } as L10n,
      due: { da: "Forfald", en: "Due" } as L10n,
      amount: { da: "Beløb", en: "Amount" } as L10n,
      status: { da: "Status", en: "Status" } as L10n,
      download: { da: "Hent PDF", en: "Get PDF" } as L10n,
      notReady: { da: "Ikke klar", en: "Not ready" } as L10n,
      emptyHeading: { da: "Ingen fakturaer endnu", en: "No invoices yet" } as L10n,
      emptyBody: {
        da: "Den første kommer, når perioden er gået.",
        en: "The first one arrives when the period is up.",
      } as L10n,
      /** "{email}" is the billing address invoices are sent to. */
      note: {
        da: "Fakturaer sendes også til {email}. Mangler der et CVR-nummer, kan fakturaen ikke udstedes — det rettes under Indstillinger.",
        en: "Invoices also go to {email}. Without a VAT number no invoice can be issued — that is fixed under Settings.",
      } as L10n,
    },

    locations: {
      panel: { da: "Dine lokationer", en: "Your locations" } as L10n,
      seeAll: { da: "Se alle", en: "See all" } as L10n,
      name: { da: "Lokation", en: "Location" } as L10n,
      type: { da: "Type", en: "Type" } as L10n,
      city: { da: "By", en: "City" } as L10n,
      fit: { da: "Plads på planen", en: "Room on the plan" } as L10n,
      within: { da: "Inden for", en: "Within" } as L10n,
      over: { da: "Over planen", en: "Over the plan" } as L10n,
      emptyHeading: { da: "Ingen lokationer endnu", en: "No locations yet" } as L10n,
      emptyBody: {
        da: "Lokationer oprettes sammen med aftalen. Skriv til os, så sætter vi dem op.",
        en: "Locations are set up with the agreement. Write to us and we will add them.",
      } as L10n,
      note: {
        da: "Lokationer oprettes sammen med din aftale. Skriv til support, hvis du åbner et nyt sted — så flytter vi din ugeplan med over.",
        en: "Locations are set up with your agreement. Write to support if you open a new place and we will bring your weekly plan with it.",
      } as L10n,
      /* 0016_schedule_per_location.sql's `fallback` column, said in the
         customer's own words rather than the enum's. */
      offPlan: { da: "Uden for planen", en: "Outside the plan" } as L10n,
      offPlanLink: { da: "Sættes på ugeplanen", en: "Set on the weekly plan" } as L10n,
      whenNothing: { da: "Når intet er planlagt", en: "When nothing is planned" } as L10n,
      fallbackNote: {
        silence: { da: "Anlægget er tavst uden for planen", en: "The system is silent outside the plan" } as L10n,
        calm: { da: "Spiller videre i samme stemning", en: "Keeps playing in the same mood" } as L10n,
        continue: { da: "Fortsætter med den sidste liste", en: "Carries on with the last list" } as L10n,
      },
    },

    settings: {
      companyPanel: { da: "Virksomhed", en: "Company" } as L10n,
      companyName: { da: "Firmanavn", en: "Company name" } as L10n,
      billingPanel: { da: "Fakturering", en: "Billing" } as L10n,
      prefsPanel: { da: "Præferencer", en: "Preferences" } as L10n,
      languageGroup: { da: "Sprog", en: "Language" } as L10n,
      themeGroup: { da: "Tema", en: "Theme" } as L10n,
      themeLight: { da: "Lys", en: "Light" } as L10n,
      themeSystem: { da: "System", en: "System" } as L10n,
      themeDark: { da: "Mørk", en: "Dark" } as L10n,
      securityPanel: { da: "Konto og sikkerhed", en: "Account and security" } as L10n,
      email: { da: "E-mail", en: "Email" } as L10n,
      password: { da: "Adgangskode", en: "Password" } as L10n,
      changePassword: { da: "Skift adgangskode", en: "Change password" } as L10n,
      passwordNote: {
        da: "Vi sender et link til din e-mail.",
        en: "We email you a link.",
      } as L10n,
    },
  },

  footer: {
    copyright: { da: "© 2026 Odatone", en: "© 2026 Odatone" } as L10n,
    getStarted: { da: "Kom i gang", en: "Get started" } as L10n,
    terms: { da: "Vilkår", en: "Terms" } as L10n,
    privacy: { da: "Privatliv", en: "Privacy" } as L10n,
    contact: { da: "Kontakt", en: "Contact" } as L10n,
  },
} as const;
