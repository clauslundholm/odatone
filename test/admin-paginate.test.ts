import { test } from "node:test";
import assert from "node:assert/strict";

import { fetchAllRows } from "../lib/admin/paginate.ts";

/** Captures every console.warn call made while `fn` runs, restoring the
    original afterward regardless of how `fn` exits. */
async function captureWarnings<T>(fn: () => Promise<T>): Promise<{ result: T; warnings: string[] }> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    const result = await fn();
    return { result, warnings };
  } finally {
    console.warn = original;
  }
}

/** A fake table of `count` numbered rows, paged the way real PostgREST
    pages one: a request for [from, to] returns at most `serverCap` rows
    starting at `from` (silently clamped below whatever was actually
    requested, exactly like a server-side max_rows lower than the
    caller's own page size), never an error for asking past the end (an
    empty page instead). `withCount` mirrors requesting `count: "exact"` —
    PostgREST computes it as a separate, uncapped COUNT(*). */
function fakeTable(rowCount: number, serverCap: number, withCount: boolean) {
  const all = Array.from({ length: rowCount }, (_, i) => i);
  return async (from: number, to: number) => {
    const requested = to - from + 1;
    const size = Math.min(requested, serverCap, Math.max(0, rowCount - from));
    return {
      data: all.slice(from, from + size),
      error: null,
      count: withCount ? rowCount : null,
    };
  };
}

test("a table smaller than one page is read in a single request", async () => {
  let calls = 0;
  const page = async (from: number, to: number) => {
    calls += 1;
    return { data: [1, 2, 3].slice(from, to + 1), error: null, count: 3 };
  };
  const { rows, error } = await fetchAllRows(page, "test", 1000);
  assert.deepEqual(rows, [1, 2, 3]);
  assert.equal(error, null);
  assert.equal(calls, 1);
});

test("a table exactly one page long still stops after that page", async () => {
  const page = fakeTable(1000, 1000, true);
  const { rows, error } = await fetchAllRows(page, "test", 1000);
  assert.equal(rows.length, 1000);
  assert.equal(error, null);
});

test("a table past the caller's own page size is read across as many pages as it takes", async () => {
  let calls = 0;
  const inner = fakeTable(1201, 1000, true);
  const page = async (from: number, to: number) => {
    calls += 1;
    return inner(from, to);
  };
  const { rows, error } = await fetchAllRows(page, "test", 1000);
  assert.equal(rows.length, 1201);
  assert.deepEqual(rows, Array.from({ length: 1201 }, (_, i) => i));
  assert.equal(error, null);
  assert.equal(calls, 2); // 1000 + 201, not one request per row
});

test("an empty table returns no rows in one request", async () => {
  let calls = 0;
  const page = async () => {
    calls += 1;
    return { data: [], error: null, count: 0 };
  };
  const { rows, error } = await fetchAllRows(page, "test", 1000);
  assert.deepEqual(rows, []);
  assert.equal(error, null);
  assert.equal(calls, 1);
});

test("a null data page is treated as empty, not a crash", async () => {
  const page = async () => ({ data: null, error: null, count: 0 });
  const { rows } = await fetchAllRows(page, "test", 1000);
  assert.deepEqual(rows, []);
});

test("stops on the first error and returns whatever was already read", async () => {
  let calls = 0;
  const page = async (from: number, to: number) => {
    calls += 1;
    if (calls === 2) return { data: null, error: "boom" };
    return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null, count: 100 };
  };
  const { rows, error } = await fetchAllRows(page, "test", 2);
  assert.equal(error, "boom");
  assert.deepEqual(rows, [0, 1]); // the first page's rows, kept
  assert.equal(calls, 2);
});

// --- Regression coverage for fix-round 2: a server cap below pageSize ---
// The original implementation stopped as soon as a page came back shorter
// than requested. `max_rows` is a Supabase dashboard setting, not a
// constant this code controls, so the moment it's lower than pageSize a
// completely ordinary read would look identical to "end of table" and
// silently drop everything past it — reproduced live at 1201 rows against
// a lowered `max_rows`. These cases pin the fix: the loop must page past a
// short-but-nonempty response whenever the known total says more remain.

test("a server cap below the caller's page size still yields every row", async () => {
  let calls = 0;
  const inner = fakeTable(1201, 500, true); // server clamps every request to 500
  const page = async (from: number, to: number) => {
    calls += 1;
    return inner(from, to);
  };
  const { rows, error } = await fetchAllRows(page, "test", 1000); // asks for 1000 at a time
  assert.equal(error, null);
  assert.equal(rows.length, 1201);
  assert.deepEqual(rows, Array.from({ length: 1201 }, (_, i) => i));
  assert.equal(calls, 3); // 500 + 500 + 201 — every page short of the 1000 asked for
});

test("warns naming the context and counts when a page is capped short of the known total", async () => {
  const inner = fakeTable(1201, 500, true);
  const { result, warnings } = await captureWarnings(() => fetchAllRows(inner, "customers: locations", 1000));
  assert.equal(result.rows.length, 1201);
  // Two intermediate pages (500, then 500 of the remaining 701) are short
  // of the known total and should each warn; the final 201-row page
  // reaches the total exactly and must not.
  const relevant = warnings.filter((w) => w.includes("customers: locations"));
  assert.equal(relevant.length, 2);
  for (const w of relevant) {
    assert.match(w, /requested 1000 rows/);
    assert.match(w, /received only 500/);
    assert.match(w, /known total 1201/);
  }
});

test("does not warn when a short page is the ordinary, correct end of the table", async () => {
  const inner = fakeTable(60, 1000, true); // never capped — 60 rows, one page, exactly the whole table
  const { result, warnings } = await captureWarnings(() => fetchAllRows(inner, "customers", 1000));
  assert.equal(result.rows.length, 60);
  assert.equal(warnings.length, 0);
});

test("without a known total, still pages past a short response rather than assuming the end", async () => {
  // No count requested (count stays null) — the conservative fallback:
  // keep going by actual batch length until a page comes back genuinely
  // empty, rather than trusting a short-but-nonempty page.
  let calls = 0;
  const inner = fakeTable(1201, 500, false);
  const page = async (from: number, to: number) => {
    calls += 1;
    return inner(from, to);
  };
  const { rows, error } = await fetchAllRows(page, "test", 1000);
  assert.equal(error, null);
  assert.equal(rows.length, 1201);
  assert.equal(calls, 4); // 500 + 500 + 201, plus one more request to confirm the end (an empty page)
});
