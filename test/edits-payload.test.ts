import { test } from "node:test";
import assert from "node:assert/strict";

import { parseEdits } from "../app/api/edits/payload.ts";

test("accepts a well-formed payload", () => {
  assert.deepEqual(parseEdits({ path: "/da", edits: { a: "b" } }), {
    ok: true,
    page: "/da",
    edits: { a: "b" },
  });
});

test("rejects a missing path", () => {
  assert.equal(parseEdits({ edits: { a: "b" } }).ok, false);
});

test("rejects edits that are not an object", () => {
  assert.equal(parseEdits({ path: "/da", edits: ["a"] }).ok, false);
  assert.equal(parseEdits({ path: "/da" }).ok, false);
});

test("drops non-string and empty-key entries", () => {
  const result = parseEdits({ path: "/da", edits: { a: "b", "": "c", d: 4 } });
  assert.deepEqual(result.ok && result.edits, { a: "b" });
});

test("rejects a payload left with no usable edits", () => {
  assert.equal(parseEdits({ path: "/da", edits: { "": "c" } }).ok, false);
});
