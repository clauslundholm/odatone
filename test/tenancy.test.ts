import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isCustomerRole,
  isPublicPath,
  isStaffRole,
  landingFor,
  mayEnter,
  parseRole,
  portalFor,
} from "../lib/tenancy.ts";

test("staff roles are staff", () => {
  assert.equal(isStaffRole("staff_admin"), true);
  assert.equal(isStaffRole("staff_support"), true);
  assert.equal(isStaffRole("owner"), false);
});

test("customer roles are customers", () => {
  assert.equal(isCustomerRole("owner"), true);
  assert.equal(isCustomerRole("manager"), true);
  assert.equal(isCustomerRole("staff_admin"), false);
});

test("each role lands in its own portal", () => {
  assert.equal(landingFor("staff_admin"), "/admin");
  assert.equal(landingFor("owner"), "/my-odatone");
});

test("portalFor recognises both portals and their subpaths", () => {
  assert.equal(portalFor("/admin"), "admin");
  assert.equal(portalFor("/admin/settings"), "admin");
  assert.equal(portalFor("/my-odatone"), "portal");
  assert.equal(portalFor("/my-odatone/invoices"), "portal");
});

test("portalFor does not match a path that merely starts with the same characters", () => {
  assert.equal(portalFor("/administrators"), null);
  assert.equal(portalFor("/my-odatone-blog"), null);
  assert.equal(portalFor("/"), null);
});

test("login routes are public", () => {
  assert.equal(isPublicPath("/admin/login"), true);
  assert.equal(isPublicPath("/my-odatone/login"), true);
  assert.equal(isPublicPath("/admin/login/reset"), true);
});

test("a route that merely starts with the login path is still gated (regression: the old code used path.startsWith(loginPath))", () => {
  // The old predicate was `PUBLIC.some((p) => path.startsWith(p))`, which is
  // true for both of these because "/admin/login-secrets" and
  // "/admin/loginsecret" both start with the string "/admin/login". Verified
  // directly against that exact expression before this fix landed:
  //   ["/admin/login", "/admin/login-secrets", "/admin/loginsecret"].every(
  //     (p) => p.startsWith("/admin/login"),
  //   ) === true
  // which is exactly the Critical: a route named e.g. login-as/[userId]
  // (staff impersonation) would ship with no auth check at all.
  assert.equal(isPublicPath("/admin/login-secrets"), false);
  assert.equal(isPublicPath("/admin/loginsecret"), false);
  assert.equal(portalFor("/admin/login-secrets"), "admin");
  assert.equal(portalFor("/admin/loginsecret"), "admin");
});

test("ordinary admin and portal routes are not public", () => {
  assert.equal(isPublicPath("/admin"), false);
  assert.equal(isPublicPath("/admin/settings"), false);
  assert.equal(isPublicPath("/my-odatone"), false);
});

test("path matching is case-insensitive", () => {
  assert.equal(portalFor("/Admin/Settings"), "admin");
  assert.equal(isPublicPath("/ADMIN/LOGIN"), true);
  assert.equal(isPublicPath("/Admin/Login-Secrets"), false);
});

test("mayEnter denies the wrong audience", () => {
  assert.equal(mayEnter("/my-odatone", "staff_admin"), false);
  assert.equal(mayEnter("/admin", "owner"), false);
});

test("mayEnter denies an unresolved role on any guarded path", () => {
  assert.equal(mayEnter("/admin", undefined), false);
  assert.equal(mayEnter("/my-odatone", undefined), false);
});

test("mayEnter admits the right audience", () => {
  assert.equal(mayEnter("/admin", "staff_admin"), true);
  assert.equal(mayEnter("/admin", "staff_support"), true);
  assert.equal(mayEnter("/my-odatone", "owner"), true);
  assert.equal(mayEnter("/my-odatone", "manager"), true);
});

test("mayEnter has nothing to deny outside both portals", () => {
  assert.equal(mayEnter("/da/priser", undefined), true);
});

test("parseRole accepts only the four known roles", () => {
  assert.equal(parseRole("owner"), "owner");
  assert.equal(parseRole("staff_admin"), "staff_admin");
});

test("parseRole rejects anything else, including a widened enum value", () => {
  assert.equal(parseRole("superadmin"), undefined);
  assert.equal(parseRole(undefined), undefined);
  assert.equal(parseRole(null), undefined);
  assert.equal(parseRole(42), undefined);
  assert.equal(parseRole(""), undefined);
});
