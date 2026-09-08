import { test } from "node:test";
import assert from "node:assert/strict";

import { applyCopy, resolveKey, type Overrides } from "../lib/copy-apply.ts";

/* An override is keyed by the string as lib/content writes it. The browser
   cannot know that string once the page is rendering an override, so it sends
   back whatever is on screen — and the key has to be resolved from that. */

test("an unknown string keys under itself", () => {
  assert.equal(resolveKey("Talk to sales", {}), "Talk to sales");
});

test("a string that is already a key stays that key", () => {
  assert.equal(resolveKey("A", { A: "B" }), "A");
});

test("a string that is an override's value resolves to that override's key", () => {
  assert.equal(resolveKey("B", { A: "B" }), "A");
});

test("being a key wins over being some other override's value", () => {
  /* "B" is both a source string in its own right and what A was edited to.
     Preferring the key keeps an edit of the real "B" from retargeting A. */
  assert.equal(resolveKey("B", { A: "B", B: "C" }), "B");
});

/* The bug this exists to prevent: editing a string a second time used to store
   an entry under the edited text, which appears nowhere in lib/content, so the
   page kept rendering the first edit no matter how many times it was changed. */
test("editing the same string twice keeps one live override", () => {
  const source = "Spar op til 90 %";
  let overrides: Overrides = {};

  const save = (from: string, to: string) => {
    const key = resolveKey(from, overrides);
    overrides = { ...overrides, [key]: to };
  };

  save(source, "Spee op til 90 %");
  assert.equal(applyCopy(source, overrides), "Spee op til 90 %");

  /* The page now renders "Spee…", so that is what the browser sends back. */
  save("Spee op til 90 %", "Spar op til 91 %");
  assert.deepEqual(Object.keys(overrides), [source], "should not have grown a second key");
  assert.equal(applyCopy(source, overrides), "Spar op til 91 %");

  /* And a third time, to be sure it is not just the second that works. */
  save("Spar op til 91 %", "Spar op til 92 %");
  assert.deepEqual(Object.keys(overrides), [source]);
  assert.equal(applyCopy(source, overrides), "Spar op til 92 %");
});
