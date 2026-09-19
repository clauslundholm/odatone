import { test } from "node:test";
import assert from "node:assert/strict";

import { initials } from "../lib/initials.ts";

test("takes the first letter of the first and last word", () => {
  assert.equal(initials("Nordisk Webshop"), "NW");
  assert.equal(initials("Claus Lundholm"), "CL");
});

test("skips the middle of a three-part name", () => {
  assert.equal(initials("Eva W. Gjelseth"), "EG");
});

test("a single word contributes one letter, not two", () => {
  assert.equal(initials("Odatone"), "O");
});

test("punctuation is a separator, not a letter", () => {
  assert.equal(initials("claus@lundholm.com"), "CC");
  assert.equal(initials("  spaced   out  "), "SO");
});

test("a trailing legal form is not an initial", () => {
  // The S of A/S is the legal form, not the company — a reader expects NW.
  assert.equal(initials("Nordisk Webshop A/S"), "NW");
  assert.equal(initials("Nordisk Webshop ApS"), "NW");
  assert.equal(initials("Bang & Olufsen a/s"), "BO");
  assert.equal(initials("Acme Trading, Ltd."), "AT");
  assert.equal(initials("Studio Werk GmbH"), "SW");
});

test("only a trailing legal form is stripped, and only once", () => {
  // Leading, so it is part of the name.
  assert.equal(initials("A/S Storebælt"), "AS");
  // Stripping both would leave "Nordisk" alone; one suffix comes off.
  assert.equal(initials("Nordisk Handel ApS A/S"), "NA");
});

test("a name that is only a legal form still monograms", () => {
  assert.equal(initials("ApS"), "A");
});

test("uppercases Danish letters", () => {
  assert.equal(initials("øre æble"), "ØÆ");
  assert.equal(initials("ålborg"), "Å");
});

test("handles non-Latin scripts without mangling them", () => {
  assert.equal(initials("Ελένη Παπαδοπούλου"), "ΕΠ");
});

test("empty and letterless input gives an empty monogram", () => {
  assert.equal(initials(""), "");
  assert.equal(initials(null), "");
  assert.equal(initials(undefined), "");
  assert.equal(initials("   "), "");
  assert.equal(initials("--- ///"), "");
});
