import { test } from "node:test";
import assert from "node:assert/strict";

import { signSession, verifySession, passwordMatches } from "../lib/edit-session.ts";

const SECRET = "hunter2";

test("accepts a token it just signed", () => {
  const token = signSession(Date.now() + 60_000, SECRET);
  assert.equal(verifySession(token, SECRET), true);
});

test("rejects a token signed with a different secret", () => {
  const token = signSession(Date.now() + 60_000, "other");
  assert.equal(verifySession(token, SECRET), false);
});

test("rejects an expired token", () => {
  const token = signSession(Date.now() - 1, SECRET);
  assert.equal(verifySession(token, SECRET), false);
});

test("rejects a tampered expiry", () => {
  const token = signSession(Date.now() + 60_000, SECRET);
  const [, mac] = token.split(".");
  assert.equal(verifySession(`${Date.now() + 999_000}.${mac}`, SECRET), false);
});

test("rejects malformed and missing tokens", () => {
  assert.equal(verifySession(undefined, SECRET), false);
  assert.equal(verifySession("", SECRET), false);
  assert.equal(verifySession("nonsense", SECRET), false);
});

test("never verifies when no secret is configured", () => {
  const token = signSession(Date.now() + 60_000, SECRET);
  assert.equal(verifySession(token, undefined), false);
});

test("password comparison", () => {
  assert.equal(passwordMatches("hunter2", SECRET), true);
  assert.equal(passwordMatches("hunter3", SECRET), false);
  assert.equal(passwordMatches("hunter2", undefined), false);
  assert.equal(passwordMatches("", ""), false);
});
