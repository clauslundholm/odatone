import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LANG_WORD,
  TRAX_GENRE,
  isAdvertisement,
  musicOnly,
  parsePoolName,
  poolTrackCount,
  proxiedAudioUrl,
  sourceFor,
  usablePools,
  type TraxMetricSet,
  type TraxMetrics,
  type TraxRow,
} from "../lib/catalogue/trax.ts";
import { GENRES, isLang } from "../lib/tracks.ts";

/* Rows copied verbatim out of
   GET /services/playlist?def=vox&history=&low=80&high=120&lang=da
   so these fail when their wire format moves, not when our imagination
   of it does. The second one is the thing that makes this file exist:
   one call returned 9,952 rows of which 3,317 were this. */
const MUSIC: TraxRow = {
  iCompositionID: 14290,
  vcTitle: "Now That You Love Me Anymore",
  vcFolder: "MusicShort/",
  iDuration: 243,
  vcFile: "241030.004@v01.mp3",
  dBpm: 110,
  hasShortVersion: true,
  filters: "",
  ageDays: 133,
  randomizedSortVal: 699.2531825781364,
};

const ADVERT: TraxRow = {
  iCompositionID: -1,
  vcFolder: "Effects/",
  vcTitle: "1000TRAX Advertising",
  vcFile: "1000trax.com.voiceover.only-20250804-da.mp3",
  iDuration: 20,
  dBpm: 0,
};

/* -------------------------------------------------------------------- *
 *  Advertising
 * -------------------------------------------------------------------- */

test("an Effects row is advertising", () => {
  assert.equal(isAdvertisement(ADVERT), true);
});

test("a MusicShort row is not", () => {
  assert.equal(isAdvertisement(MUSIC), false);
});

test("a row is advertising on its folder alone, whatever its id", () => {
  // Defence in depth: the id was -1 on every sampled jingle, but the
  // folder is the thing their own player keys the ad slot off.
  assert.equal(isAdvertisement({ ...ADVERT, iCompositionID: 4242 }), true);
  assert.equal(isAdvertisement({ ...MUSIC, iCompositionID: -1 }), true);
});

test("musicOnly drops every jingle and keeps the order of the rest", () => {
  const rows = [MUSIC, ADVERT, { ...MUSIC, iCompositionID: 2 }, ADVERT];
  const out = musicOnly(rows);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((c) => c.iCompositionID), [14290, 2]);
});

test("musicOnly survives a response with no rows", () => {
  assert.deepEqual(musicOnly([]), []);
  assert.deepEqual(musicOnly(undefined), []);
});

/* -------------------------------------------------------------------- *
 *  Pool names
 * -------------------------------------------------------------------- */

test("a bare genre pool", () => {
  assert.deepEqual(parsePoolName("lounge"), {
    genres: ["lounge"], langs: [], vox: null, mix: false, unknown: [],
  });
});

test("the _vox and _novox suffixes decide vocals", () => {
  assert.equal(parsePoolName("lounge_vox").vox, true);
  assert.equal(parsePoolName("lounge_novox").vox, false);
  assert.equal(parsePoolName("lounge").vox, null);
});

test("language words become our two-letter codes", () => {
  assert.deepEqual(parsePoolName("pop_danish").langs, ["da"]);
  assert.deepEqual(parsePoolName("english_spanish_danish").langs, ["en", "es", "da"]);
  for (const code of Object.values(LANG_WORD)) assert.equal(isLang(code), true);
});

test("a language-only pool is vocal by implication", () => {
  // You cannot sing in Danish without singing.
  const p = parsePoolName("danish");
  assert.deepEqual(p.langs, ["da"]);
  assert.equal(p.vox, true);
  assert.deepEqual(p.genres, []);
});

test("mix is a modifier, not a genre", () => {
  const p = parsePoolName("lounge_mix_english_danish");
  assert.deepEqual(p.genres, ["lounge"]);
  assert.equal(p.mix, true);
  assert.deepEqual(p.langs, ["en", "da"]);
});

test("several genres survive", () => {
  assert.deepEqual(parsePoolName("pop_lounge_jazz").genres, ["pop", "lounge", "jazz"]);
});

test("tokens we do not know are reported rather than silently dropped", () => {
  const p = parsePoolName("chillout_piano");
  assert.deepEqual(p.genres, ["chillout"]);
  assert.deepEqual(p.unknown, ["piano"]);
});

/* -------------------------------------------------------------------- *
 *  Genre mapping
 * -------------------------------------------------------------------- */

test("every genre chip we show has a 1000trax pool behind it, bar one", () => {
  const ours = new Set(Object.values(TRAX_GENRE));
  const missing = GENRES.map((g) => g.id).filter((id) => !ours.has(id));
  // "classical" is shown as Klassisk and has nothing behind it: there is
  // no classical pool in their 156 metric sets.
  assert.deepEqual(missing, ["classical"]);
});

test("the chips are mapped by what they say, not by their id", () => {
  // The ids are historical and the labels were re-badged over them, so
  // `bossa` must land on the id shown as "Bossa", not on "Unplugged".
  const label = (id: string) => GENRES.find((g) => g.id === id)?.label.da;
  assert.equal(label(TRAX_GENRE.bossa), "Bossa");
  assert.equal(label(TRAX_GENRE.unplugged), "Unplugged");
  assert.equal(label(TRAX_GENRE.house), "House");
  assert.equal(label(TRAX_GENRE.downbeat), "Downbeat");
  assert.equal(label(TRAX_GENRE.chillout), "Chillout");
});

/* -------------------------------------------------------------------- *
 *  Metrics
 * -------------------------------------------------------------------- */

const SET = (tracks: number[][]): TraxMetricSet => ({
  lowMinimum: 80,
  lowMaximum: 105,
  tempoSelection: true,
  visibleForSelection: true,
  id: 1,
  formula: "x",
  stats: {
    columns: ["bpmbase", "tracks", "minDuration", "maxDuration", "totalDuration", "avgBpm", "avgDuration", "tracksShare", "allowed"],
    rows: tracks,
  },
});

test("a pool's size is the sum of its tempo buckets", () => {
  assert.equal(poolTrackCount(SET([[80, 16, 0, 0, 0, 0, 0, 0, 1], [85, 4, 0, 0, 0, 0, 0, 0, 1]])), 20);
});

test("an empty pool counts zero rather than throwing", () => {
  assert.equal(poolTrackCount(SET([])), 0);
  assert.equal(poolTrackCount({ ...SET([]), stats: undefined } as unknown as TraxMetricSet), 0);
});

test("usablePools keeps what we can map and drops what we cannot", () => {
  const metrics: TraxMetrics = {
    languagesAvailable: ["en", "it", "es", "da"],
    metricSets: {
      pop_danish: SET([[90, 246, 0, 0, 0, 0, 0, 0, 1]]),
      lounge_novox: SET([[70, 727, 0, 0, 0, 0, 0, 0, 1]]),
      xmas: SET([[90, 140, 0, 0, 0, 0, 0, 0, 1]]),
      medit_inst: SET([[90, 158, 0, 0, 0, 0, 0, 0, 1]]),
      empty_pool: SET([]),
      hidden: { ...SET([[90, 10, 0, 0, 0, 0, 0, 0, 1]]), visibleForSelection: false },
    },
  };
  const pools = usablePools(metrics);
  const names = pools.map((p) => p.name);
  assert.ok(names.includes("pop_danish"));
  assert.ok(names.includes("lounge_novox"));
  // xmas is a real pool with a real genre word we do not carry, medit_inst
  // is unmappable, the empty one has nothing in it, and a pool their own
  // UI hides is not one we should surface either.
  assert.ok(!names.includes("xmas"));
  assert.ok(!names.includes("medit_inst"));
  assert.ok(!names.includes("empty_pool"));
  assert.ok(!names.includes("hidden"));
  const pop = pools.find((p) => p.name === "pop_danish");
  assert.equal(pop?.tracks, 246);
  assert.equal(pop?.facets.vox, true);
  assert.deepEqual(pop?.facets.langs, ["da"]);
});

/* -------------------------------------------------------------------- *
 *  Audio
 * -------------------------------------------------------------------- */

test("audio is addressed through our own origin, not theirs", () => {
  // demo.1000trax.com answers with `Access-Control-Allow-Origin:
  // 1000trax.com`, which is not a legal origin and never matches ours,
  // so a crossOrigin="anonymous" element — which is what the spectrum
  // analyser needs — cannot load it directly.
  assert.equal(
    proxiedAudioUrl({ ...MUSIC, vcFolder: "MusicShort/" } as never),
    "/api/audio/MusicShort/241030.004@v01.mp3",
  );
});

test("a folder with no trailing slash is joined the way their player joins it", () => {
  assert.equal(
    proxiedAudioUrl({ ...MUSIC, vcFolder: "MusicShort" } as never),
    "/api/audio/MusicShort/241030.004@v01.mp3",
  );
});

/* -------------------------------------------------------------------- *
 *  Short vs full
 * -------------------------------------------------------------------- */

test("a signed-out listener keeps the 60-second cut", () => {
  assert.equal(
    sourceFor("/api/audio/MusicShort/241030.004@v01.mp3", false),
    "/api/audio/MusicShort/241030.004@v01.mp3",
  );
});

test("a signed-in customer gets the whole composition", () => {
  assert.equal(
    sourceFor("/api/audio/MusicShort/241030.004@v01.mp3", true),
    "/api/audio/Music/241030.004@v01.mp3",
  );
});

test("only our own proxy paths are rewritten", () => {
  // A local file or an absolute URL has nothing to do with the tiers and
  // must survive untouched, however the flag is set.
  for (const src of ["/audio/soft-open.mp3", "https://demo.1000trax.com/MusicShort/x.mp3"]) {
    assert.equal(sourceFor(src, true), src);
  }
});

test("rewriting twice is the same as rewriting once", () => {
  const once = sourceFor("/api/audio/MusicShort/a.mp3", true);
  assert.equal(sourceFor(once, true), once);
});
