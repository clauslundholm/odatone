import { test } from "node:test";
import assert from "node:assert/strict";

import { applyCopy } from "../lib/copy-apply.ts";

test("replaces a string that has an override", () => {
  assert.equal(applyCopy("Talk to sales", { "Talk to sales": "Contact us" }), "Contact us");
});

test("leaves a string with no override alone", () => {
  assert.equal(applyCopy("Talk to sales", {}), "Talk to sales");
});

test("walks nested objects", () => {
  const content = { hero: { line1: { da: "Spar", en: "Save" } } };
  const out = applyCopy(content, { Save: "Save big" });
  assert.deepEqual(out, { hero: { line1: { da: "Spar", en: "Save big" } } });
});

test("walks arrays", () => {
  const out = applyCopy(["one", "two"], { two: "three" });
  assert.deepEqual(out, ["one", "three"]);
});

test("matches strings containing newlines", () => {
  const out = applyCopy({ t: "Someone had to\nredo it." }, { "Someone had to\nredo it.": "Redone." });
  assert.deepEqual(out, { t: "Redone." });
});

test("does not mutate the input", () => {
  const content = { a: "old" };
  applyCopy(content, { old: "new" });
  assert.deepEqual(content, { a: "old" });
});

test("leaves non-string leaves untouched", () => {
  const out = applyCopy({ n: 4, b: true, z: null }, { "4": "four" });
  assert.deepEqual(out, { n: 4, b: true, z: null });
});
