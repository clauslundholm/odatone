import type { Genre, L10n, Mood } from "../types";
import { TRACKS, type Track } from "./tracks";

export const GENRES: { id: Genre; label: L10n }[] = [
  { id: "ambient", label: { da: "Ambient", en: "Ambient" } },
  { id: "electronic", label: { da: "Elektronisk", en: "Electronic" } },
  { id: "jazz", label: { da: "Jazz", en: "Jazz" } },
  { id: "acoustic", label: { da: "Akustisk", en: "Acoustic" } },
  { id: "hiphop", label: { da: "Hip-hop", en: "Hip-hop" } },
  { id: "rnb", label: { da: "R&B", en: "R&B" } },
  { id: "pop", label: { da: "Pop", en: "Pop" } },
  { id: "classical", label: { da: "Klassisk", en: "Classical" } },
];

export const MOODS: { id: Mood; label: L10n; blurb: L10n }[] = [
  {
    id: "calm",
    label: { da: "Rolig", en: "Calm" },
    blurb: { da: "Morgenåbning, venteværelse, spa", en: "Opening hours, waiting rooms, spa" },
  },
  {
    id: "focus",
    label: { da: "Fokus", en: "Focus" },
    blurb: { da: "Kontor, showroom, klinik", en: "Office, showroom, clinic" },
  },
  {
    id: "warm",
    label: { da: "Varm", en: "Warm" },
    blurb: { da: "Frokost, butik, salon", en: "Lunch, retail, salon" },
  },
  {
    id: "evening",
    label: { da: "Aften", en: "Evening" },
    blurb: { da: "Middag, bar, hotel-lobby", en: "Dinner, bar, hotel lobby" },
  },
  {
    id: "energy",
    label: { da: "Energi", en: "Energy" },
    blurb: { da: "Weekendtravlhed, fitness, natklub", en: "Weekend rush, gyms, nightlife" },
  },
];

export const moodById = (id: Mood) => MOODS.find((m) => m.id === id)!;
export const genreLabel = (id: Genre) => GENRES.find((g) => g.id === id)?.label ?? { da: id, en: id };

/**
 * What a list is made of. Kept declarative rather than a stored array of
 * ids so that importing a bigger catalogue fills the lists out by itself.
 */
export type Rule = {
  mood?: Mood;
  genres?: Genre[];
  vox?: boolean;
  energy?: [number, number];
  bpm?: [number, number];
};

export type Playlist = {
  id: string;
  title: L10n;
  blurb: L10n;
  rule: Rule;
};

export const PLAYLISTS: Playlist[] = [
  {
    id: "opening",
    title: { da: "Morgenåbning", en: "Doors open" },
    blurb: { da: "Lavmælt nok til at man kan høre kaffemaskinen", en: "Quiet enough to hear the coffee machine" },
    rule: { mood: "calm", energy: [1, 2] },
  },
  {
    id: "lunch",
    title: { da: "Frokostpuls", en: "Lunch rush" },
    blurb: { da: "Holder tempoet oppe uden at skubbe", en: "Keeps the pace up without pushing" },
    rule: { mood: "warm", energy: [2, 4] },
  },
  {
    id: "deep-work",
    title: { da: "Fokus & flow", en: "Focus & flow" },
    blurb: { da: "Ingen vokal, ingen afbrydelser", en: "No vocals, no interruptions" },
    rule: { mood: "focus", vox: false },
  },
  {
    id: "late",
    title: { da: "Sen aften", en: "Late evening" },
    blurb: { da: "Til de sidste to timer af vagten", en: "For the last two hours of the shift" },
    rule: { mood: "evening" },
  },
  {
    id: "friday",
    title: { da: "Fredag kl. 17", en: "Friday at five" },
    blurb: { da: "Når rummet fyldes og alle taler højere", en: "When the room fills and everyone talks louder" },
    rule: { mood: "energy", energy: [3, 5] },
  },
  {
    id: "instrumental",
    title: { da: "Kun instrumental", en: "Instrumental only" },
    blurb: { da: "Ingen tekst der konkurrerer med samtalen", en: "No lyrics competing with the conversation" },
    rule: { vox: false },
  },
  {
    id: "slow",
    title: { da: "Under 90 BPM", en: "Under 90 BPM" },
    blurb: { da: "Langsomt tempo, uanset genre", en: "Slow tempo, whatever the genre" },
    rule: { bpm: [0, 90] },
  },
];

export const playlistById = (id: string) => PLAYLISTS.find((p) => p.id === id);

export function tracksFor(rule: Rule, source: Track[] = TRACKS): Track[] {
  return source.filter((t) => {
    if (rule.mood && t.mood !== rule.mood) return false;
    if (rule.genres?.length && !rule.genres.includes(t.genre)) return false;
    if (rule.vox !== undefined && t.vox !== rule.vox) return false;
    if (rule.energy && (t.energy < rule.energy[0] || t.energy > rule.energy[1])) return false;
    if (rule.bpm && (t.bpm < rule.bpm[0] || t.bpm > rule.bpm[1])) return false;
    return true;
  });
}

export const tracksInMood = (mood: Mood) => TRACKS.filter((t) => t.mood === mood);

/** Newest first is meaningless for a placeholder catalogue, so "fresh"
 *  is simply the tail of the manifest — swap for a real date field. */
export const FRESH = TRACKS.slice(-6);

export const runTime = (tracks: Track[]) => tracks.reduce((sum, t) => sum + t.duration, 0);
