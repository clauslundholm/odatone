import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LOGIN_PATH,
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

test("a realistic mixed-case slug is still gated and still not mistaken for public", () => {
  // The literal case the review reproduced live: GET /admin/Customers/ABC-123.
  // Gating must not depend on the caller pre-folding the path — portalFor,
  // isPublicPath and mayEnter each fold internally, which is also why
  // lib/supabase/proxy.ts no longer keeps a separate lower-cased copy of the
  // path: that second copy was what leaked into the `next` redirect
  // parameter and would have lower-cased a customer- or invoice-id slug.
  assert.equal(portalFor("/admin/Customers/ABC-123"), "admin");
  assert.equal(isPublicPath("/admin/Customers/ABC-123"), false);
  assert.equal(mayEnter("/admin/Customers/ABC-123", "staff_admin"), true);
  assert.equal(mayEnter("/admin/Customers/ABC-123", "owner"), false);
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

test("LOGIN_PATH is the single source isPublicPath agrees with", () => {
  // lib/supabase/proxy.ts builds its redirect target from this same
  // constant rather than a second copy of the string. If the two ever
  // diverged, the proxy would redirect to a path the gate itself does not
  // consider public, and the redirect would loop forever.
  assert.equal(isPublicPath(LOGIN_PATH.admin), true);
  assert.equal(isPublicPath(LOGIN_PATH.portal), true);
});
