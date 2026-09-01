import type { L10n } from "@/lib/i18n";

export const player = {
  eyebrow: { da: "Afspilleren", en: "The player" } as L10n,
  title: {
    da: "Tryk play.\nDet er rigtige\nmusikere.",
    en: "Press play.\nThose are real\nmusicians.",
  } as L10n,
  lede: {
    da: "Vælg stemning, genre, tempo og vokal — og hør, hvordan din forretning kommer til at lyde. Ingen konto, ingen kort, ingen betingelser.",
    en: "Pick a mood, a genre, a tempo and vocals — and hear how your business is going to sound. No account, no card, no strings.",
  } as L10n,

  nowPlaying: { da: "Spiller nu", en: "Now playing" } as L10n,
  upNext: { da: "Kø", en: "Up next" } as L10n,
  nothingMatches: {
    da: "Ingen numre matcher. Løsn et filter.",
    en: "Nothing matches. Loosen a filter.",
  } as L10n,
  reset: { da: "Nulstil filtre", en: "Reset filters" } as L10n,
  tracksInQueue: { da: "numre i kø", en: "tracks queued" } as L10n,
  trackInQueue: { da: "nummer i kø", en: "track queued" } as L10n,

  mood: { da: "Stemning", en: "Mood" } as L10n,
  genre: { da: "Genre", en: "Genre" } as L10n,
  tempo: { da: "Tempo", en: "Tempo" } as L10n,
  vocals: { da: "Vokal", en: "Vocals" } as L10n,
  voxAny: { da: "Begge", en: "Either" } as L10n,
  voxOn: { da: "Med vokal", en: "With vocals" } as L10n,
  voxOff: { da: "Instrumental", en: "Instrumental" } as L10n,
  volume: { da: "Lydstyrke", en: "Volume" } as L10n,
  shuffle: { da: "Bland", en: "Shuffle" } as L10n,
  allGenres: { da: "Alle genrer", en: "All genres" } as L10n,
  anyMood: { da: "Alle stemninger", en: "Any mood" } as L10n,
  bpm: { da: "BPM", en: "BPM" } as L10n,

  playHint: {
    da: "Mellemrum = play · Skift + piletast = næste",
    en: "Space = play · Shift + arrow = skip",
  } as L10n,
  blocked: {
    da: "Din browser blokerede lyden. Tryk play igen.",
    en: "Your browser blocked the audio. Press play again.",
  } as L10n,

  trialRunning: {
    da: "Gratis demo — {n} dage tilbage",
    en: "Free demo — {n} days left",
  } as L10n,
  trialLastDay: { da: "Gratis demo — sidste dag", en: "Free demo — last day" } as L10n,
  trialNotStarted: {
    da: "Gratis demo — starter når du trykker play",
    en: "Free demo — starts when you press play",
  } as L10n,
  trialReset: { da: "Nulstil demo", en: "Reset demo" } as L10n,

  expiredTitle: {
    da: "Demoen er slut.",
    en: "The demo is over.",
  } as L10n,
  expiredBody: {
    da: "Du har hørt {days} dage af biblioteket. Hele kataloget — over 4.000 numre — åbner i det øjeblik du starter en prøveperiode. 14 dage gratis, intet betalingskort.",
    en: "You have had {days} days of the library. The whole catalogue — over 4,000 tracks — opens the moment you start a trial. 14 days free, no card.",
  } as L10n,

  placeholderNote: {
    da: "Demobiblioteket her er syntetiserede eksempler, ikke Odatones rigtige katalog.",
    en: "This demo library is synthesised sample material, not Odatone's real catalogue.",
  } as L10n,

  spec: {
    da: [
      ["Bibliotek", "4.000+ numre"],
      ["Genrer", "8"],
      ["Tempo", "55–130 BPM"],
      ["Zoner", "Ubegrænset pr. lokation"],
      ["Offline", "Ja, ved netværkssvigt"],
      ["Platform", "Browser, iOS, Android"],
    ],
    en: [
      ["Library", "4,000+ tracks"],
      ["Genres", "8"],
      ["Tempo", "55–130 BPM"],
      ["Zones", "Unlimited per location"],
      ["Offline", "Yes, if the network drops"],
      ["Platform", "Browser, iOS, Android"],
    ],
  } as Record<"da" | "en", string[][]>,
};

export const dock = {
  idleTitle: {
    da: "Hør hvordan din forretning kommer til at lyde",
    en: "Hear how your business is going to sound",
  } as L10n,
  idleSub: {
    da: "Gratis i {n} dage. Ingen konto.",
    en: "Free for {n} days. No account.",
  } as L10n,
  trialShort: { da: "{n} dage tilbage", en: "{n} days left" } as L10n,
  trialShortLast: { da: "Sidste dag", en: "Last day" } as L10n,
  expand: { da: "Åbn afspilleren", en: "Open the player" } as L10n,
  collapse: { da: "Luk afspilleren", en: "Close the player" } as L10n,
  queueToggle: { da: "Kø", en: "Queue" } as L10n,
  library: { da: "Bibliotek", en: "Library" } as L10n,
  nowPlayingPanel: { da: "Spiller nu", en: "Now playing" } as L10n,
  lockedTitle: { da: "Demoen er slut", en: "The demo is over" } as L10n,
  lockedCta: { da: "Få 14 dage gratis", en: "Get 14 days free" } as L10n,
  bpmVox: { da: "BPM · med vokal", en: "BPM · with vocals" } as L10n,
  bpmInst: { da: "BPM · instrumental", en: "BPM · instrumental" } as L10n,
  dismissHint: {
    da: "Afspilleren følger med, mens du kigger rundt.",
    en: "The player follows you around the site.",
  } as L10n,
};
