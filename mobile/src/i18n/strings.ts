import type { L10n } from "../types";

/* Every string in the app lives here, in both languages. Components hold
   no copy of their own — same rule as the website's lib/content. */
export const STRINGS = {
  "tab.home": { da: "Hjem", en: "Home" },
  "tab.playlists": { da: "Lister", en: "Playlists" },
  "tab.search": { da: "Søg", en: "Search" },
  "tab.account": { da: "Konto", en: "Account" },

  "home.morning": { da: "Godmorgen", en: "Good morning" },
  "home.afternoon": { da: "God eftermiddag", en: "Good afternoon" },
  "home.evening": { da: "God aften", en: "Good evening" },
  "home.sub": {
    da: "Sæt musik på rummet. Ingen Koda, ingen Gramex, ingen efterregning.",
    en: "Put music in the room. No Koda, no Gramex, no invoice after the fact.",
  },
  "home.resume": { da: "Fortsæt hvor du slap", en: "Pick up where you left off" },
  "home.moods": { da: "Til rummet lige nu", en: "For the room right now" },
  "home.lists": { da: "Kuraterede lister", en: "Curated lists" },
  "home.fresh": { da: "Nyt i biblioteket", en: "New in the library" },
  "home.seeAll": { da: "Se alle", en: "See all" },

  "player.nowPlaying": { da: "Spiller nu", en: "Now playing" },
  "player.upNext": { da: "Næste", en: "Up next" },
  "player.queue": { da: "Kø", en: "Queue" },
  "player.empty": { da: "Ingenting spiller", en: "Nothing playing" },
  "player.emptyBody": {
    da: "Vælg en stemning, så finder afspilleren resten.",
    en: "Pick a mood and the player will do the rest.",
  },
  "player.from": { da: "Fra", en: "From" },
  "player.shuffleOn": { da: "Bland slået til", en: "Shuffle on" },
  "player.shuffleOff": { da: "Bland slået fra", en: "Shuffle off" },
  "player.repeatOne": { da: "Gentag nummer", en: "Repeat track" },
  "player.repeatAll": { da: "Gentag liste", en: "Repeat list" },
  "player.repeatOff": { da: "Gentag fra", en: "Repeat off" },
  "player.invite": { da: "Tryk play — 7 dage gratis", en: "Hit play — 7 days free" },

  "playlists.title": { da: "Lister", en: "Playlists" },
  "playlists.sub": {
    da: "Bygget til bestemte timer i butikken, ikke til bestemte genrer.",
    en: "Built for particular hours in the room, not for particular genres.",
  },
  "playlists.moods": { da: "Stemninger", en: "Moods" },
  "playlists.curated": { da: "Kuraterede", en: "Curated" },
  "playlists.play": { da: "Afspil", en: "Play" },
  "playlists.shuffle": { da: "Bland", en: "Shuffle" },
  "playlists.queued": { da: "Lagt i kø", en: "Queued" },

  "search.title": { da: "Søg", en: "Search" },
  "search.placeholder": { da: "Nummer, artist eller stemning", en: "Track, artist or mood" },
  "search.recent": { da: "Seneste søgninger", en: "Recent searches" },
  "search.clear": { da: "Ryd", en: "Clear" },
  "search.filters": { da: "Filtre", en: "Filters" },
  "search.genre": { da: "Genre", en: "Genre" },
  "search.mood": { da: "Stemning", en: "Mood" },
  "search.vocals": { da: "Vokal", en: "Vocals" },
  "search.vocalsAny": { da: "Alle", en: "Any" },
  "search.vocalsWith": { da: "Med vokal", en: "With vocals" },
  "search.vocalsWithout": { da: "Instrumental", en: "Instrumental" },
  "search.energy": { da: "Energi", en: "Energy" },
  "search.reset": { da: "Nulstil", en: "Reset" },
  "search.noResults": { da: "Ingen numre matcher", en: "Nothing matches" },
  "search.noResultsBody": {
    da: "Prøv en bredere stemning, eller ryd filtrene.",
    en: "Try a broader mood, or clear the filters.",
  },
  "search.browse": { da: "Eller bare bladr", en: "Or just browse" },

  "account.title": { da: "Konto", en: "Account" },
  "account.plan": { da: "Plan", en: "Plan" },
  "account.planName": { da: "Small Venue", en: "Small Venue" },
  "account.planPrice": { da: "149 kr. pr. lokation / måned", en: "DKK 149 per location / month" },
  "account.preferences": { da: "Indstillinger", en: "Preferences" },
  "account.language": { da: "Sprog", en: "Language" },
  "account.appearance": { da: "Udseende", en: "Appearance" },
  "account.system": { da: "System", en: "System" },
  "account.light": { da: "Lys", en: "Light" },
  "account.dark": { da: "Mørk", en: "Dark" },
  "account.about": { da: "Om", en: "About" },
  "account.prototype": { da: "Prototype", en: "Prototype" },
  "account.prototypeBody": {
    da: "Musikken i denne app er syntetiseret pladsholdermateriale, og artistnavnene er opdigtede. Intet af det er Odatones katalog.",
    en: "The music in this app is synthesised placeholder material and the artist names are invented. None of it is Odatone's catalogue.",
  },
  "account.web": { da: "odatone.com", en: "odatone.com" },

  "common.tracks": { da: "numre", en: "tracks" },
  "common.track": { da: "nummer", en: "track" },
  "common.min": { da: "min", en: "min" },
  "common.bpm": { da: "BPM", en: "BPM" },
  "common.instrumental": { da: "Instrumental", en: "Instrumental" },
  "common.vocals": { da: "Vokal", en: "Vocals" },
  "common.playAll": { da: "Afspil alle", en: "Play all" },
} satisfies Record<string, L10n>;

export type StringKey = keyof typeof STRINGS;
