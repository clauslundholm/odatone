import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MOOD_POOL,
  TRAX_GENRE,
  GENRES_WITHOUT_SOURCE,
  TRAX_DEMO_AUDIO_BASE,
  audioUrl,
  energyFromBpm,
  poolQuery,
  toTrack,
  toTracks,
  type TraxComposition,
} from "../lib/catalogue/trax.ts";
import { GENRES, MOODS, type Mood } from "../lib/tracks.ts";

/* A real row, copied verbatim from
   GET /services/playlist?def=lounge&history=&low=0&high=300&lang=da
   so these tests fail if their wire format moves rather than if our
   imagination of it does. */
const ROW: TraxComposition = {
  iCompositionID: 11142,
  vcTitle: "Sometimes Its Like So Nice",
  vcFolder: "MusicShort/",
  iDuration: 262,
  vcFile: "250219.002@v10.mp3",
  dBpm: 97,
  hasShortVersion: true,
  filters: "",
  ageDays: 594,
  randomizedSortVal: 0.317,
};

test("audioUrl joins folder and file the way their own player does", () => {
  assert.equal(
    audioUrl(ROW),
    "https://demo.1000trax.com/MusicShort/250219.002@v10.mp3",
  );
});

test("audioUrl adds the missing trailing slash rather than assuming one", () => {
  /* Their player does exactly this before building the URL — a folder
     without its slash would otherwise produce ".../MusicShort250219...". */
  const noSlash = { ...ROW, vcFolder: "MusicShort" };
  assert.equal(audioUrl(noSlash), audioUrl(ROW));
});

test("audioUrl takes a base, so the demo host is never hardcoded at a call site", () => {
  assert.equal(
    audioUrl(ROW, "https://cdn.odatone.com/"),
    "https://cdn.odatone.com/MusicShort/250219.002@v10.mp3",
  );
  // And the default really is the demo tier, which is worth failing on
  // the day someone quietly points it at production.
  assert.equal(TRAX_DEMO_AUDIO_BASE, "https://demo.1000trax.com/");
});

test("energyFromBpm spans 1..5 and never returns NaN for junk", () => {
  assert.equal(energyFromBpm(60), 1);
  assert.equal(energyFromBpm(82), 2);
  assert.equal(energyFromBpm(97), 3);
  assert.equal(energyFromBpm(115), 4);
  assert.equal(energyFromBpm(128), 5);
  for (const bad of [0, -1, NaN, Infinity]) {
    const e = energyFromBpm(bad);
    assert.ok(e >= 1 && e <= 5, `expected 1..5 for ${bad}, got ${e}`);
  }
});

test("toTrack maps a real row onto our Track shape", () => {
  const t = toTrack(ROW, { mood: "focus", genre: "lounge" });
  assert.equal(t.id, "trax-11142");
  assert.deepEqual(t.title, { da: ROW.vcTitle, en: ROW.vcTitle });
  assert.equal(t.genre, "ambient");
  assert.equal(t.mood, "focus");
  assert.equal(t.bpm, 97);
  assert.equal(t.duration, 262);
  assert.equal(t.src, "https://demo.1000trax.com/MusicShort/250219.002@v10.mp3");
});

test("toTrack leaves the unknowable visibly unknown, not invented", () => {
  const t = toTrack(ROW, { mood: "focus", genre: "lounge" });
  /* Their player credits every track to the brand because no artist name
     is on offer. An empty peaks array lets a caller tell "no waveform"
     from a flat one. Both are gaps for the API, not defaults to settle
     into — see TRAX_GAPS. */
  assert.equal(t.artist, "Odatone");
  assert.deepEqual(t.peaks, []);
});

test("toTracks preserves the order the pool arrived in", () => {
  /* The pool is pre-shuffled server-side via randomizedSortVal; sorting
     it here would discard the only sequencing they give us. */
  const rows = [1, 2, 3].map((n) => ({ ...ROW, iCompositionID: n }));
  const out = toTracks({ resultCompositions: rows }, { mood: "calm", genre: "chillout" });
  assert.deepEqual(out.map((t) => t.id), ["trax-1", "trax-2", "trax-3"]);
});

test("toTracks survives an empty or absent composition list", () => {
  assert.deepEqual(toTracks({ resultCompositions: [] }, { mood: "calm", genre: "chillout" }), []);
  assert.deepEqual(
    toTracks({} as { resultCompositions: TraxComposition[] }, { mood: "calm", genre: "chillout" }),
    [],
  );
});

test("every mood has a pool, and every pool is a legal combination", () => {
  /* `combinableWith`, read off the genre config inlined into their player
     page. A `def` joining two genres that do not declare each other is
     not a pool they will build. */
  const COMBINABLE: Record<string, string[]> = {
    pop: ["jazz", "lounge"],
    lounge: ["jazz", "pop"],
    bossa: ["rnb"],
    jazz: ["lounge", "pop", "rnb", "slowjazz"],
    slowjazz: ["jazz", "chillout"],
    rnb: ["jazz", "bossa"],
    funk: [],
    chillout: ["slowjazz"],
  };

  for (const mood of MOODS.map((m) => m.id)) {
    const pool = MOOD_POOL[mood as Mood];
    assert.ok(pool, `no pool for mood "${mood}"`);
    const parts = pool.def.split("_");
    for (const p of parts) {
      assert.ok(COMBINABLE[p], `"${p}" is not one of their genre codenames`);
    }
    if (parts.length === 2) {
      assert.ok(
        COMBINABLE[parts[0]].includes(parts[1]),
        `"${pool.def}" is not a legal pair: ${parts[0]} combines only with ${COMBINABLE[parts[0]].join(", ")}`,
      );
    }
    assert.ok(parts.length <= 2, `"${pool.def}" joins more than two genres`);
    assert.ok(pool.low >= 0 && pool.high > pool.low, `"${mood}" has a nonsense BPM window`);
  }
});

test("poolQuery produces the parameters their playlist service reads", () => {
  const q = poolQuery("evening");
  assert.deepEqual(q, { def: "jazz_slowjazz", history: "", low: "70", high: "105", lang: "da" });

  /* history is how the pool avoids repeats — ids comma-joined, handed
     back on the next request, exactly as their player does it. */
  const next = poolQuery("evening", { lang: "en", history: [11142, 11143] });
  assert.equal(next.history, "11142,11143");
  assert.equal(next.lang, "en");
});

test("the genre map covers all eight of their genres and lands on real ones of ours", () => {
  const ours = new Set(GENRES.map((g) => g.id));
  const theirs = ["pop", "lounge", "bossa", "jazz", "slowjazz", "rnb", "funk", "chillout"];
  for (const g of theirs) {
    const mapped = TRAX_GENRE[g as keyof typeof TRAX_GENRE];
    assert.ok(mapped, `no mapping for their genre "${g}"`);
    assert.ok(ours.has(mapped), `"${g}" maps to "${mapped}", which is not one of our genres`);
  }
});

/* Not a defect to fix in code — a catalogue fact to settle with 1000trax,
   pinned here so it cannot drift quietly. The Small Venue plan's feature
   list promises "8 genrer"; this catalogue can fill five of them. */
test("three of our genres have nothing behind them in this catalogue", () => {
  const covered = new Set(Object.values(TRAX_GENRE));
  const uncovered = GENRES.map((g) => g.id).filter((g) => !covered.has(g));
  assert.deepEqual(uncovered.sort(), [...GENRES_WITHOUT_SOURCE].sort());
  assert.equal(covered.size, 5);
});
