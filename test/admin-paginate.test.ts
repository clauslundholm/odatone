import { test } from "node:test";
import assert from "node:assert/strict";

import { fetchAllRows } from "../lib/admin/paginate.ts";

/** A fake table of `count` numbered rows, paged exactly the way PostgREST
    pages a real one: a request for [from, to] returns at most `pageSize`
    rows starting at `from`, silently clamped, never an error for asking
    past the end (an empty page instead). */
function fakeTable(count: number, pageSize: number) {
  const all = Array.from({ length: count }, (_, i) => i);
  return async (from: number, to: number) => {
    const requested = to - from + 1;
    const size = Math.min(requested, pageSize);
    return { data: all.slice(from, from + size), error: null };
  };
}

test("a table smaller than one page is read in a single request", async () => {
  let calls = 0;
  const page = async (from: number, to: number) => {
    calls += 1;
    return { data: [1, 2, 3].slice(from, to + 1), error: null };
  };
  const { rows, error } = await fetchAllRows(page, 1000);
  assert.deepEqual(rows, [1, 2, 3]);
  assert.equal(error, null);
  assert.equal(calls, 1);
});

test("a table exactly one page long still stops after that page", async () => {
  const page = fakeTable(1000, 1000);
  const { rows, error } = await fetchAllRows(page, 1000);
  assert.equal(rows.length, 1000);
  assert.equal(error, null);
});

test("a table past the cap is read across as many pages as it takes", async () => {
  let calls = 0;
  const inner = fakeTable(1201, 1000);
  const page = async (from: number, to: number) => {
    calls += 1;
    return inner(from, to);
  };
  const { rows, error } = await fetchAllRows(page, 1000);
  assert.equal(rows.length, 1201);
  assert.deepEqual(rows, Array.from({ length: 1201 }, (_, i) => i));
  assert.equal(error, null);
  assert.equal(calls, 2); // 1000 + 201, not one request per row
});

test("an empty table returns no rows in one request", async () => {
  let calls = 0;
  const page = async () => {
    calls += 1;
    return { data: [], error: null };
  };
  const { rows, error } = await fetchAllRows(page, 1000);
  assert.deepEqual(rows, []);
  assert.equal(error, null);
  assert.equal(calls, 1);
});

test("a null data page is treated as empty, not a crash", async () => {
  const page = async () => ({ data: null, error: null });
  const { rows } = await fetchAllRows(page, 1000);
  assert.deepEqual(rows, []);
});

test("stops on the first error and returns whatever was already read", async () => {
  let calls = 0;
  const page = async (from: number, to: number) => {
    calls += 1;
    if (calls === 2) return { data: null, error: "boom" };
    return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null };
  };
  const { rows, error } = await fetchAllRows(page, 2);
  assert.equal(error, "boom");
  assert.deepEqual(rows, [0, 1]); // the first page's rows, kept
  assert.equal(calls, 2);
});
