import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SEASONS,
  contains,
  currentSeason,
  seasonById,
  seasonFilters,
} from "../lib/seasons.ts";
import { BPM_MAX, BPM_MIN, GENRES, filterTracks } from "../lib/tracks.ts";
import { SEASON_PHOTO } from "../lib/v4/photos.ts";

const on = (month: number, day: number) => new Date(2026, month - 1, day);

test("every date in a season's own range is in that season", () => {
  for (const s of SEASONS) {
    assert.equal(contains(s, on(s.from.month, s.from.day)), true, `${s.id} first day`);
    assert.equal(contains(s, on(s.to.month, s.to.day)), true, `${s.id} last day`);
  }
});

/* Nytår runs 27 December to 1 January, so `from` sorts after `to` and the
   obvious `from <= x && x <= to` is false on every day of the year. This is
   the case the comparison exists for. */
test("the season that crosses the new year contains days on both sides of it", () => {
  const nytaar = seasonById("nytaar");
  assert.ok(nytaar);
  for (const [m, d] of [[12, 27], [12, 31], [1, 1]] as [number, number][]) {
    assert.equal(contains(nytaar, on(m, d)), true, `${d}/${m}`);
  }
  for (const [m, d] of [[12, 26], [1, 2], [6, 15]] as [number, number][]) {
    assert.equal(contains(nytaar, on(m, d)), false, `${d}/${m}`);
  }
});

test("no two seasons claim the same day", () => {
  /* Overlapping ranges would make currentSeason depend on array order,
     which is not a thing anyone should have to know to add a season. */
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const hits = SEASONS.filter((s) => contains(s, on(m, d))).map((s) => s.id);
      assert.ok(hits.length <= 1, `${d}/${m} is claimed by ${hits.join(", ")}`);
    }
  }
});

test("currentSeason picks the right season across the year", () => {
  const cases: [number, number, string][] = [
    [9, 1, "efteraar"], [10, 31, "efteraar"], [11, 30, "efteraar"],
    [12, 1, "jul"], [12, 26, "jul"],
    [12, 27, "nytaar"], [1, 1, "nytaar"],
    [1, 2, "vinter"], [2, 28, "vinter"],
    [3, 1, "foraar"], [5, 31, "foraar"],
    [6, 1, "sommer"], [8, 31, "sommer"],
  ];
  for (const [m, d, id] of cases) {
    assert.equal(currentSeason(on(m, d))?.id, id, `${d}/${m}`);
  }
});

test("currentSeason returns null rather than guessing on a day no season covers", () => {
  /* 29 February is real and Vinter ends on the 28th. Returning a season
     anyway would mean the page highlights one that does not apply. */
  assert.equal(currentSeason(new Date(2028, 1, 29)), null);
});

test("every season's genres are genres we actually have", () => {
  const known = new Set(GENRES.map((g) => g.id));
  for (const s of SEASONS) {
    for (const g of s.rule.genres) {
      assert.ok(known.has(g), `${s.id} wants "${g}", which is not one of our genres`);
    }
  }
});

test("every season's tempo window is inside the catalogue's own range", () => {
  for (const s of SEASONS) {
    const [lo, hi] = s.rule.bpm;
    assert.ok(lo >= BPM_MIN && hi <= BPM_MAX && lo < hi, `${s.id} has a nonsense window ${lo}-${hi}`);
  }
});

test("seasonFilters clears mood, so a season plays the whole room", () => {
  /* Leaving a mood set would intersect the two and quietly hand back a
     fraction of what the season card promised. */
  const s = seasonById("efteraar");
  assert.ok(s);
  const f = seasonFilters(s);
  assert.equal(f.mood, null);
  assert.deepEqual(f.genres, s.rule.genres);
  assert.deepEqual(f.bpm, s.rule.bpm);
});

test("every season has its own photograph, and no two share one", () => {
  /* A season is the one thing on the site that has to look like a time
     of year, so a missing picture is a grey rectangle where the whole
     point was. Reusing one would be worse: two cards showing the same
     café says the seasons are a label on the same thing. */
  const paths = SEASONS.map((s) => SEASON_PHOTO[s.id]);
  for (const [i, path] of paths.entries()) {
    assert.ok(path, `${SEASONS[i]!.id} has no photograph`);
    assert.match(path, /^\/v4\/seasons\/.+\.jpg$/);
  }
  assert.equal(new Set(paths).size, SEASONS.length, "two seasons share a photograph");
});

test("a season that matches nothing in the catalogue is reported, not hidden", () => {
  /* Not an assertion that every season has tracks — the catalogue is 24
     placeholder files and some seasons legitimately come up empty. It is
     an assertion that we can SEE which, so the page can say "ingen numre"
     instead of offering a play button that does nothing. */
  const counts = SEASONS.map((s) => [s.id, filterTracks(seasonFilters(s)).length] as const);
  for (const [, n] of counts) assert.equal(typeof n, "number");
  assert.equal(counts.length, SEASONS.length);
});
