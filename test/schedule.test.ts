import { test } from "node:test";
import assert from "node:assert/strict";

import {
  END,
  SNAP,
  START,
  type ScheduleBlock,
  distribution,
  fit,
  hhmm,
  hhmmShort,
  hoursLabel,
  invalidBlocks,
  overlaps,
  plannedMinutes,
  quarterHours,
  rangeLabel,
  snapTo,
  spotMarks,
  spotTimes,
  spotsPerWeek,
  weekdaysLabel,
} from "../lib/schedule.ts";

const b = (id: string, weekday: number, from: number, to: number): ScheduleBlock => ({
  id,
  playlistId: "p1",
  weekday,
  from,
  to,
});

const H = (hour: number, min = 0) => hour * 60 + min;

/* ------------------------------------------------------------ snapping */

test("snapping lands on the quarter, the unit the database accepts", () => {
  /* 0016 refuses anything else outright, so a drag that produced 10:07
     would be a write the grid let you make and the database threw out. */
  for (const [raw, want] of [
    [600, 600],
    [607, 600],
    [608, 615],
    [622, 615],
    [623, 630],
  ] as const) {
    assert.equal(snapTo(raw), want);
    assert.equal(snapTo(raw) % SNAP, 0);
  }
});

test("every from/to option the panel offers is inside the grid and on the quarter", () => {
  const from = quarterHours(START, END - SNAP);
  const to = quarterHours(START + SNAP, END);
  assert.equal(from[0], START);
  assert.equal(to[to.length - 1], END);
  for (const m of [...from, ...to]) assert.equal(m % SNAP, 0);
  /* The two lists are offset by one step, so "to" can always be at
     least one quarter past the latest "from". */
  assert.equal(to.length, from.length);
});

/* ------------------------------------------------------------- labels */

test("the hour label drops :00 and keeps everything else", () => {
  assert.equal(hhmmShort(H(7)), "07");
  assert.equal(hhmmShort(H(7, 30)), "07:30");
  assert.equal(hhmm(H(7)), "07:00");
  assert.equal(rangeLabel(H(10, 15), H(12)), "10:15–12");
});

test("hours read in the reader's own language", () => {
  assert.equal(hoursLabel(150, "da"), "2,5 t");
  assert.equal(hoursLabel(150, "en"), "2.5 t");
});

/* ----------------------------------------------------------- overlaps */

test("neighbouring blocks are neighbours, not a clash", () => {
  /* 09–12 then 12–15 is the boundary a hand-rolled comparison gets
     wrong about half the time, and the database allows it (0016 uses a
     half-open range), so the grid must too. */
  const week = [b("a", 0, H(9), H(12))];
  assert.equal(overlaps(week, { weekday: 0, from: H(12), to: H(15) }), false);
  assert.equal(overlaps(week, { weekday: 0, from: H(11), to: H(13) }), true);
  assert.equal(overlaps(week, { weekday: 1, from: H(9), to: H(12) }), false);
});

test("a block being dragged does not clash with where it used to be", () => {
  const week = [b("a", 0, H(9), H(12))];
  assert.equal(overlaps(week, { weekday: 0, from: H(10), to: H(13) }, "a"), false);
});

/* ---------------------------------------------------------------- fit */

test("a press on free space opens the two hours the design asks for", () => {
  assert.deepEqual(fit([], 0, H(9), 120), { from: H(9), to: H(11) });
});

test("fit shortens to the next block rather than refusing", () => {
  /* The alternative — refuse because the default two hours reached into
     the evening — makes the grid feel broken at exactly the moment
     someone is filling the last gap in their day. */
  const week = [b("a", 0, H(10), H(14))];
  assert.deepEqual(fit(week, 0, H(9), 120), { from: H(9), to: H(10) });
});

test("fit refuses only when the press lands inside a block", () => {
  const week = [b("a", 0, H(10), H(14))];
  assert.equal(fit(week, 0, H(11), 120), null);
});

test("fit fills a quarter-hour gap exactly, rather than giving up on it", () => {
  const week = [b("a", 0, H(10), H(14)), b("b", 0, H(14, 15), H(16))];
  assert.deepEqual(fit(week, 0, H(14), 120), { from: H(14), to: H(14, 15) });
});

test("fit never runs past midnight", () => {
  const got = fit([], 0, END - 30, 120);
  assert.deepEqual(got, { from: END - 30, to: END });
});

/* ----------------------------------------------------------- the week */

test("planned minutes and the distribution agree with each other", () => {
  const week = [
    { ...b("a", 0, H(8), H(10)), playlistId: "morning" },
    { ...b("b", 1, H(8), H(10)), playlistId: "morning" },
    { ...b("c", 0, H(18), H(22)), playlistId: "evening" },
  ];
  assert.equal(plannedMinutes(week), 8 * 60);

  const spread = distribution(week);
  assert.equal(spread.length, 2, "one row per list, not per block");
  assert.deepEqual(
    Object.fromEntries(spread.map((d) => [d.playlistId, d.minutes])),
    { morning: 240, evening: 240 },
  );
  assert.equal(
    spread.reduce((sum, d) => sum + d.minutes, 0),
    plannedMinutes(week),
    "the bars add up to the figure in the stats chip",
  );
  /* Biggest first, so the panel's bar chart needs no second sort. */
  const mins = spread.map((d) => d.minutes);
  assert.deepEqual([...mins].sort((x, y) => y - x), mins);
});

test("invalidBlocks catches everything the grid cannot draw", () => {
  const bad = invalidBlocks([
    b("ok", 0, H(9), H(11)),
    b("reversed", 0, H(14), H(12)),
    b("past-midnight", 1, H(23), END + 60),
    b("off-quarter", 2, H(9) + 7, H(11)),
    b("bad-day", 9, H(9), H(11)),
  ]).map((x) => x.id);
  assert.deepEqual(bad.sort(), ["bad-day", "off-quarter", "past-midnight", "reversed"]);
});

test("two blocks that overlap are both reported, not one of them", () => {
  /* The page counts these to decide whether to say anything, so
     reporting one of a clashing pair would undercount the problem. */
  const bad = invalidBlocks([b("a", 0, H(9), H(12)), b("b", 0, H(11), H(13))]).map((x) => x.id);
  assert.deepEqual(bad.sort(), ["a", "b"]);
});

/* ---------------------------------------------------------- the spots */

const spot = (over: Partial<Parameters<typeof spotTimes>[0]> = {}) => ({
  mode: "interval" as const,
  at: H(12),
  from: H(10),
  to: H(18),
  everyMin: 30,
  ...over,
});

test("an interval spot plays from its start up to but not past its end", () => {
  const times = spotTimes(spot({ from: H(10), to: H(12), everyMin: 30 }));
  assert.deepEqual(times, [H(10), H(10, 30), H(11), H(11, 30)]);
});

test("a fixed spot plays once", () => {
  assert.deepEqual(spotTimes(spot({ mode: "fixed", at: H(11, 45) })), [H(11, 45)]);
});

test("the weekly count ignores spots that are switched off", () => {
  const base = {
    id: "s",
    name: "",
    fileName: "",
    path: null,
    seconds: 10,
    duck: false,
    duckLevel: 25,
    volume: 100,
    ...spot({ from: H(10), to: H(12), everyMin: 30 }),
  };
  const on = { ...base, weekdays: [0, 1, 2, 3, 4], active: true };
  const off = { ...base, id: "s2", weekdays: [0, 1, 2, 3, 4], active: false };
  assert.equal(spotsPerWeek([on, off]), 5 * 4);
});

test("an interval spot is marked at both ends of its window, dotted between", () => {
  const sp = {
    id: "s", name: "Velkomst", fileName: "", path: null, seconds: 10,
    duck: false, duckLevel: 25, volume: 100, weekdays: [0], active: true,
    ...spot({ from: H(10), to: H(12), everyMin: 30 }),
  };
  const marks = spotMarks(sp);
  const edges = marks.filter((m) => m.kind === "edge").map((m) => m.minute);
  const ticks = marks.filter((m) => m.kind === "tick").map((m) => m.minute);
  /* Both ends, because "from 10:00" alone leaves the reader counting
     dots to find where it stops. */
  assert.deepEqual(edges.sort((a, b) => a - b), [H(10), H(12)]);
  /* 10:00 is an occurrence AND the window start; it gets one mark, not
     a dot underneath a pill. */
  assert.deepEqual(ticks.sort((a, b) => a - b), [H(10, 30), H(11), H(11, 30)]);
});

test("a fixed spot is one pill and no dots", () => {
  const sp = {
    id: "s", name: "Frokost", fileName: "", path: null, seconds: 10,
    duck: true, duckLevel: 25, volume: 100, weekdays: [0], active: true,
    ...spot({ mode: "fixed" as const, at: H(11, 45) }),
  };
  assert.deepEqual(spotMarks(sp), [
    { spotId: "s", kind: "edge", minute: H(11, 45), label: "Frokost" },
  ]);
});

test("the day summary says the thing people mean", () => {
  assert.equal(weekdaysLabel([0, 1, 2, 3, 4, 5, 6], "da"), "Alle dage");
  assert.equal(weekdaysLabel([0, 1, 2, 3, 4], "da"), "Hverdage");
  assert.equal(weekdaysLabel([5, 6], "da"), "Weekend");
  assert.equal(weekdaysLabel([0, 1, 2, 3], "da"), "Man–Tor");
  assert.equal(weekdaysLabel([0, 2, 4], "da"), "Man, Ons, Fre");
  assert.equal(weekdaysLabel([3], "en"), "Thu");
  assert.equal(weekdaysLabel([], "da"), "Ingen dage");
});

test("the day summary does not care what order the days arrive in", () => {
  assert.equal(weekdaysLabel([4, 0, 2, 1, 3], "da"), "Hverdage");
  assert.equal(weekdaysLabel([6, 5, 5], "da"), "Weekend");
});
