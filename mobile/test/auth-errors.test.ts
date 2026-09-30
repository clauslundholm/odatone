import { test } from "node:test";
import assert from "node:assert/strict";

import {
  codeError,
  normalizeEmail,
  passwordError,
  sendError,
  shouldVerifyCode,
  signInError,
} from "../src/auth/errors.ts";

test("normalizeEmail trims and lower-cases, the way the server stores addresses", () => {
  assert.equal(normalizeEmail("  Jens@Nord.Test "), "jens@nord.test");
  assert.equal(normalizeEmail("jens@nord.test"), "jens@nord.test");
});

test("a wrong password and an unknown address are the same error", () => {
  assert.equal(signInError({ code: "invalid_credentials", status: 400 }), "invalid");
  assert.equal(signInError({ code: "email_not_confirmed", status: 400 }), "invalid");
  assert.equal(signInError({ status: 400 }), "invalid");
});

test("a rate limit is reported as one, in every flow", () => {
  assert.equal(signInError({ status: 429 }), "rate");
  assert.equal(codeError({ code: "over_request_rate_limit", status: 429 }), "rate");
  assert.equal(sendError({ code: "over_email_send_rate_limit", status: 429 }), "rate");
  assert.equal(passwordError({ status: 429 }), "rate");
});

test("no status, status 0 and 5xx are an outage, not the customer's mistake", () => {
  for (const failure of [{}, { status: 0 }, { status: 500 }, { status: 503 }]) {
    assert.equal(signInError(failure), "service");
    assert.equal(codeError(failure), "service");
    assert.equal(sendError(failure), "service");
    assert.equal(passwordError(failure), "service");
  }
});

test("a rejected code is a wrong-or-expired code", () => {
  assert.equal(codeError({ code: "otp_expired", status: 403 }), "code");
  assert.equal(codeError({ status: 400 }), "code");
});

test("a rejected password is weak, and re-using the old one is not an error", () => {
  assert.equal(passwordError({ code: "weak_password", status: 422 }), "weak");
  assert.equal(passwordError({ status: 422 }), "weak");
  assert.equal(passwordError({ code: "same_password", status: 422 }), null);
  assert.equal(passwordError({ status: 401 }), "service");
});

test("sending a code never reveals whether the address has an account", () => {
  assert.equal(sendError({ code: "otp_disabled", status: 422 }), null);
  assert.equal(sendError({ code: "user_not_found", status: 400 }), null);
});

test("the code is checked only when there is no session for that address yet", () => {
  assert.equal(shouldVerifyCode(null, "jens@nord.test"), true);
  assert.equal(shouldVerifyCode("other@nord.test", "jens@nord.test"), true);
  assert.equal(shouldVerifyCode("jens@nord.test", "jens@nord.test"), false);
  assert.equal(shouldVerifyCode("Jens@Nord.test", " jens@nord.test "), false);
});
