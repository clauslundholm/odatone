import { test } from "node:test";
import assert from "node:assert/strict";

import { activeNavHref } from "../lib/nav-active.ts";

const ADMIN = ["/admin", "/admin/customers", "/admin/billing", "/admin/products", "/admin/users"];
const PORTAL = ["/my-odatone", "/my-odatone/billing", "/my-odatone/settings"];

test("a section index is highlighted only on itself", () => {
  // The bug: "/admin" is a prefix of every sibling, so a plain prefix rule
  // lit Dashboard on every page under /admin.
  assert.equal(activeNavHref(ADMIN, "/admin"), "/admin");
  for (const path of ["/admin/customers", "/admin/billing", "/admin/products", "/admin/users"]) {
    assert.notEqual(activeNavHref(ADMIN, path), "/admin", `index lit on ${path}`);
  }
});

test("the most specific match wins", () => {
  assert.equal(activeNavHref(ADMIN, "/admin/customers"), "/admin/customers");
  assert.equal(activeNavHref(ADMIN, "/admin/billing"), "/admin/billing");
});

test("a detail page highlights its section, not the index", () => {
  assert.equal(activeNavHref(ADMIN, "/admin/customers/8f3a-1234"), "/admin/customers");
});

test("the same rule holds for the customer portal", () => {
  assert.equal(activeNavHref(PORTAL, "/my-odatone"), "/my-odatone");
  assert.equal(activeNavHref(PORTAL, "/my-odatone/billing"), "/my-odatone/billing");
  assert.equal(activeNavHref(PORTAL, "/my-odatone/settings"), "/my-odatone/settings");
});

test("matching is on segment boundaries, not characters", () => {
  // The concern lib/tenancy.ts documents for its own path matching:
  // /administrators must never match /admin.
  assert.equal(activeNavHref(ADMIN, "/administrators"), undefined);
  assert.equal(activeNavHref(["/admin/user", "/admin/users"], "/admin/users"), "/admin/users");
});

test("an unknown or absent path highlights nothing", () => {
  assert.equal(activeNavHref(ADMIN, "/da/priser"), undefined);
  assert.equal(activeNavHref(ADMIN, undefined), undefined);
  assert.equal(activeNavHref(ADMIN, null), undefined);
  assert.equal(activeNavHref(ADMIN, ""), undefined);
});

test("a trailing slash still matches its own row", () => {
  assert.equal(activeNavHref(ADMIN, "/admin/"), "/admin");
});

test("an empty nav highlights nothing", () => {
  assert.equal(activeNavHref([], "/admin"), undefined);
});
