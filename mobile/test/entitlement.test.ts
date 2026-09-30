import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OFFLINE_WINDOW_MS,
  accountEntitled,
  gateFor,
  latestSubscription,
  effectiveUserId,
  parseCache,
  sessionReady,
  resolveEntitled,
  type Account,
  type Role,
} from "../src/auth/entitlement.ts";

const sub = (status: string, created_at = "2026-09-01T00:00:00Z") => ({
  plan_id: "small",
  billing: "monthly" as const,
  status,
  created_at,
});

const account = (role: Role, status: string | null): Account => ({
  profile: { role, full_name: "Jens", customer_id: role.startsWith("staff") ? null : "c1" },
  customer: role.startsWith("staff") ? null : { id: "c1", name: "Café Nord", billing_email: "j@nord.test", status: "pending" },
  subscription: status === null ? null : sub(status),
});

test("a customer plays on pending, trialing, active and past_due", () => {
  for (const status of ["pending", "trialing", "active", "past_due"]) {
    assert.equal(accountEntitled(account("owner", status)), true, status);
    assert.equal(accountEntitled(account("manager", status)), true, status);
  }
});

test("a customer does not play when cancelled, with no subscription, or on an unknown status", () => {
  assert.equal(accountEntitled(account("owner", "cancelled")), false);
  assert.equal(accountEntitled(account("owner", null)), false);
  assert.equal(accountEntitled(account("owner", "paused")), false);
});

test("staff always play, with no customer and no subscription", () => {
  assert.equal(accountEntitled(account("staff_admin", null)), true);
  assert.equal(accountEntitled(account("staff_support", null)), true);
});

test("a signed-in user with no profile does not play", () => {
  assert.equal(accountEntitled(null), false);
});

test("latestSubscription prefers the newest earning subscription", () => {
  const picked = latestSubscription([
    sub("cancelled", "2026-09-20T00:00:00Z"),
    sub("active", "2026-08-01T00:00:00Z"),
    sub("trialing", "2026-09-10T00:00:00Z"),
  ]);
  assert.equal(picked?.status, "trialing");
});

test("latestSubscription falls back to the newest of any status", () => {
  const picked = latestSubscription([sub("pending", "2026-09-01T00:00:00Z"), sub("cancelled", "2026-09-20T00:00:00Z")]);
  assert.equal(picked?.status, "cancelled");
  assert.equal(latestSubscription([]), null);
});

const NOW = Date.parse("2026-10-01T12:00:00Z");
const cached = (entitled: boolean, ageMs: number, userId = "u1") => ({ userId, entitled, at: NOW - ageMs });

test("signed out never plays, whatever is cached", () => {
  assert.equal(resolveEntitled({ kind: "signed-out" }, cached(true, 0), null, NOW), false);
});

test("a loaded account decides, and the cache is ignored", () => {
  assert.equal(resolveEntitled({ kind: "loaded", account: account("owner", "active") }, cached(false, 0), "u1", NOW), true);
  assert.equal(resolveEntitled({ kind: "loaded", account: account("owner", "cancelled") }, cached(true, 0), "u1", NOW), false);
  assert.equal(resolveEntitled({ kind: "loaded", account: null }, cached(true, 0), "u1", NOW), false);
});

test("when the account cannot be read, a fresh cached yes counts for 7 days", () => {
  const unavailable = { kind: "unavailable" } as const;
  assert.equal(resolveEntitled(unavailable, cached(true, 0), "u1", NOW), true);
  assert.equal(resolveEntitled(unavailable, cached(true, OFFLINE_WINDOW_MS), "u1", NOW), true);
  assert.equal(resolveEntitled(unavailable, cached(true, OFFLINE_WINDOW_MS + 1), "u1", NOW), false);
});

test("when the account cannot be read, a cached no, no cache, or another user's cache does not play", () => {
  const unavailable = { kind: "unavailable" } as const;
  assert.equal(resolveEntitled(unavailable, cached(false, 0), "u1", NOW), false);
  assert.equal(resolveEntitled(unavailable, null, "u1", NOW), false);
  assert.equal(resolveEntitled(unavailable, cached(true, 0, "someone-else"), "u1", NOW), false);
});

test("a cache stamped in the future does not count, beyond a few minutes of clock drift", () => {
  const unavailable = { kind: "unavailable" } as const;
  assert.equal(resolveEntitled(unavailable, cached(true, -60_000), "u1", NOW), true);
  assert.equal(resolveEntitled(unavailable, cached(true, -24 * 60 * 60 * 1000), "u1", NOW), false);
});

test("parseCache accepts only the exact shape it wrote", () => {
  assert.deepEqual(parseCache('{"userId":"u1","entitled":true,"at":5}'), { userId: "u1", entitled: true, at: 5 });
  assert.equal(parseCache(null), null);
  assert.equal(parseCache(""), null);
  assert.equal(parseCache("not json"), null);
  assert.equal(parseCache("null"), null);
  assert.equal(parseCache('{"userId":"u1","entitled":"yes","at":5}'), null);
  assert.equal(parseCache('{"userId":"u1","entitled":true,"at":"5"}'), null);
  assert.equal(parseCache('{"entitled":true,"at":5}'), null);
});

test("the gate asks a signed-out person to log in and tells a signed-in one it has ended", () => {
  assert.equal(gateFor(false), "login");
  assert.equal(gateFor(true), "ended");
});

test("parseCache takes an optional email and rejects a non-string one", () => {
  assert.deepEqual(parseCache('{"userId":"u1","entitled":true,"at":5,"email":"a@b.test"}'), {
    userId: "u1",
    entitled: true,
    at: 5,
    email: "a@b.test",
  });
  assert.equal(parseCache('{"userId":"u1","entitled":true,"at":5,"email":7}'), null);
});

test("effectiveUserId: a session wins, absence is signed out, unknown falls back to the cache", () => {
  const cache = { userId: "cached", entitled: true, at: 1 };
  assert.equal(effectiveUserId({ userId: "live" }, cache), "live");
  assert.equal(effectiveUserId({ userId: "live" }, null), "live");
  assert.equal(effectiveUserId("absent", cache), null);
  assert.equal(effectiveUserId("absent", null), null);
  assert.equal(effectiveUserId("unknown", cache), "cached");
  assert.equal(effectiveUserId("unknown", null), null);
});

test("sessionReady waits for the cache, then for an answer or a cached identity", () => {
  const cache = { userId: "u", entitled: true, at: 1 };
  assert.equal(sessionReady("absent", false, null, true), false);
  assert.equal(sessionReady("unknown", true, null, false), false);
  assert.equal(sessionReady("unknown", true, cache, false), true);
  assert.equal(sessionReady("unknown", true, null, true), true);
  assert.equal(sessionReady("absent", true, null, false), true);
  assert.equal(sessionReady({ userId: "u" }, true, null, false), true);
});
