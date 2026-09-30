import { test } from "node:test";
import assert from "node:assert/strict";

import { readSignupResponse } from "../src/auth/api-response.ts";

test("a plain success means the invite email was sent", () => {
  assert.deepEqual(readSignupResponse(200, '{"ok":true}'), { kind: "ok", invited: true });
});

test("a success marked no-invite means the account exists but no email went out", () => {
  assert.deepEqual(readSignupResponse(200, '{"ok":true,"message":"no-invite"}'), { kind: "ok", invited: false });
});

test("field errors come through as they are", () => {
  assert.deepEqual(readSignupResponse(200, '{"ok":false,"errors":{"email":"exists"}}'), {
    kind: "errors",
    errors: { email: "exists" },
  });
});

test("an error body is read whatever the status, so a 400 or 500 still says why", () => {
  assert.deepEqual(readSignupResponse(500, '{"ok":false,"errors":{"form":"server"}}'), {
    kind: "errors",
    errors: { form: "server" },
  });
  assert.deepEqual(readSignupResponse(400, '{"ok":false,"errors":{"form":"invalid"}}'), {
    kind: "errors",
    errors: { form: "invalid" },
  });
});

test("anything that is not the expected JSON is unreachable", () => {
  const unreachable = { kind: "unreachable" };
  assert.deepEqual(readSignupResponse(404, "<!DOCTYPE html><html>Not found</html>"), unreachable);
  assert.deepEqual(readSignupResponse(200, ""), unreachable);
  assert.deepEqual(readSignupResponse(200, "null"), unreachable);
  assert.deepEqual(readSignupResponse(200, "[]"), unreachable);
  assert.deepEqual(readSignupResponse(200, '{"hello":"world"}'), unreachable);
  assert.deepEqual(readSignupResponse(502, "Bad Gateway"), unreachable);
});

test("a success is only believed with status 200", () => {
  assert.deepEqual(readSignupResponse(500, '{"ok":true}'), { kind: "unreachable" });
});

test("error values that are not text are dropped, and an empty error list is unreachable", () => {
  assert.deepEqual(readSignupResponse(200, '{"ok":false,"errors":{"email":"exists","n":5,"o":{}}}'), {
    kind: "errors",
    errors: { email: "exists" },
  });
  assert.deepEqual(readSignupResponse(200, '{"ok":false,"errors":{}}'), { kind: "unreachable" });
  assert.deepEqual(readSignupResponse(200, '{"ok":false,"errors":null}'), { kind: "unreachable" });
});
