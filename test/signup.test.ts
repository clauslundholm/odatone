import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildSignup, decideSignupDedupe, inviteCreatedNewUser } from "../lib/signup.ts";
import { EMAIL_RE } from "../lib/forms.ts";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const VALID = {
  name: "Jens Hansen", company: "Café Nord", email: "jens@nord.test",
  plan: "small", billing: "monthly", locations: "1",
};

test("accepts a complete signup", () => {
  const r = buildSignup(form(VALID));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.customer.name, "Café Nord");
    assert.equal(r.value.locations.length, 1);
  }
});

test("rejects a bad email", () => {
  const r = buildSignup(form({ ...VALID, email: "not-an-email" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.email, "email");
});

test("rejects an unknown plan rather than trusting the form", () => {
  const r = buildSignup(form({ ...VALID, plan: "enterprise" }));
  assert.equal(r.ok, false);
});

test("creates one location per location claimed", () => {
  const r = buildSignup(form({ ...VALID, locations: "3" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.locations.length, 3);
});

test("never trusts a price from the form", () => {
  const r = buildSignup(form({ ...VALID, monthly: "1" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal("monthly" in r.value.customer, false);
});

/* ---------------------------------------------------------------------- *
 *  Fix round 1 — behaviours added beyond the brief's five verbatim cases.
 * ---------------------------------------------------------------------- */

test("accepts the real UI's field name (planId), not just the brief's fixture (plan)", () => {
  const { plan: _plan, ...withoutPlan } = VALID;
  const r = buildSignup(form({ ...withoutPlan, planId: "medium" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.planId, "medium");
});

test("keeps the contact person's name separate from the company name", () => {
  const r = buildSignup(form(VALID));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.customer.name, "Café Nord"); // the company
    assert.equal(r.value.customer.contactName, "Jens Hansen"); // the person
  }
});

test("no longer asks for venue type, area or opening hours", () => {
  // The signup flow stopped collecting these: a visitor answers how many
  // locations they have and picks a plan, nothing more. A form that still
  // sends them must not be able to write them either — they are ignored,
  // not trusted.
  const r = buildSignup(form({ ...VALID, venueType: "spaceship", m2: "-5", hoursBand: "nonsense" }));
  assert.equal(r.ok, true);
  if (r.ok) {
    const loc = r.value.locations[0] as Record<string, unknown>;
    assert.equal("venue_type" in loc, false);
    assert.equal("m2" in loc, false);
    assert.equal("hours_band" in loc, false);
  }
});

test("a location carries only its name now", () => {
  const r = buildSignup(form({ ...VALID, locations: "2" }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.locations.length, 2);
    assert.deepEqual(Object.keys(r.value.locations[0]), ["name"]);
  }
});

test("clamps a zero or blank location count up to one rather than rejecting it", () => {
  const zero = buildSignup(form({ ...VALID, locations: "0" }));
  assert.equal(zero.ok, true);
  if (zero.ok) assert.equal(zero.value.locations.length, 1);

  const blank = buildSignup(form({ ...VALID, locations: "" }));
  assert.equal(blank.ok, true);
  if (blank.ok) assert.equal(blank.value.locations.length, 1);
});

test("accepts exactly the location cap and rejects one more", () => {
  const atCap = buildSignup(form({ ...VALID, locations: "500" }));
  assert.equal(atCap.ok, true);
  if (atCap.ok) assert.equal(atCap.value.locations.length, 500);

  const overCap = buildSignup(form({ ...VALID, locations: "501" }));
  assert.equal(overCap.ok, false);
  if (!overCap.ok) assert.equal(overCap.errors.locations, "required");
});

test("rejects a location count that isn't a plain digit string, rather than silently reinterpreting it", () => {
  // Regression: a bare Number() parses "0x1F4" as 500 (hex) and "3.7" as 4
  // (rounded) instead of rejecting either as malformed.
  for (const bad of ["0x1F4", "3.7", "-5", "1e3", "3abc"]) {
    const r = buildSignup(form({ ...VALID, locations: bad }));
    assert.equal(r.ok, false, `expected "${bad}" to be rejected`);
    if (!r.ok) assert.equal(r.errors.locations, "required");
  }
});

test("rejects a company name past the length cap rather than writing it (or truncating it silently)", () => {
  const r = buildSignup(form({ ...VALID, company: "A".repeat(201) }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.company, "long");
});

test("rejects a name past the length cap", () => {
  const r = buildSignup(form({ ...VALID, name: "A".repeat(201) }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.name, "long");
});

test("rejects an email past the length cap", () => {
  const longLocal = "a".repeat(250);
  const r = buildSignup(form({ ...VALID, email: `${longLocal}@nord.test` }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.email, "long");
});

test("rejects an overlong optional field rather than truncating it", () => {
  // Fix round 2: this used to truncate silently at 300 chars, which is the
  // identical "wrong record, not a safe one" mistake already rejected for
  // company/name/email — a cut-off address or CVR number is not a safe
  // fallback for a real one.
  for (const field of ["cvr", "address", "postcode", "city", "phone"] as const) {
    const r = buildSignup(form({ ...VALID, [field]: "X".repeat(301) }));
    assert.equal(r.ok, false, `expected an overlong "${field}" to be rejected`);
    if (!r.ok) assert.equal(r.errors[field], "long");
  }
});

test("accepts an optional field exactly at the length cap", () => {
  const r = buildSignup(form({ ...VALID, address: "X".repeat(300) }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.customer.address?.length, 300);
});

test("persists the optional business fields when given, null when blank", () => {
  const withFields = buildSignup(
    form({ ...VALID, cvr: "12345678", address: "Hovedgaden 1", postcode: "8000", city: "Aarhus", phone: "12345678" }),
  );
  assert.equal(withFields.ok, true);
  if (withFields.ok) {
    assert.deepEqual(
      {
        cvr: withFields.value.customer.cvr,
        address: withFields.value.customer.address,
        postcode: withFields.value.customer.postcode,
        city: withFields.value.customer.city,
        phone: withFields.value.customer.phone,
      },
      { cvr: "12345678", address: "Hovedgaden 1", postcode: "8000", city: "Aarhus", phone: "12345678" },
    );
  }

  const withoutFields = buildSignup(form(VALID));
  assert.equal(withoutFields.ok, true);
  if (withoutFields.ok) {
    assert.equal(withoutFields.value.customer.cvr, null);
    assert.equal(withoutFields.value.customer.address, null);
    assert.equal(withoutFields.value.customer.postcode, null);
    assert.equal(withoutFields.value.customer.city, null);
    assert.equal(withoutFields.value.customer.phone, null);
  }
});

/* ---------------------------------------------------------------------- *
 *  The duplicate-signup Critical: decideSignupDedupe and
 *  inviteCreatedNewUser are the pure decision logic app/actions.ts calls
 *  before it will ever create a customer, call invite, or delete an auth
 *  user. These pin exactly the behaviour that regressed: a repeat signup
 *  for an email with a completed account must never be treated as safe to
 *  invite or overwrite, and an auth user must never be deleted unless this
 *  request is provably the one that created it.
 * ---------------------------------------------------------------------- */

test("decideSignupDedupe: a brand new email creates a new customer", () => {
  const decision = decideSignupDedupe([], []);
  assert.deepEqual(decision, { action: "create" });
});

test("decideSignupDedupe: an existing, un-owned, pending, uninvoiced customer is reused rather than duplicated", () => {
  const decision = decideSignupDedupe(
    [{ id: "customer-1", created_at: "2026-01-01T00:00:00Z", status: "pending" }],
    [],
  );
  assert.deepEqual(decision, { action: "reuse", customerId: "customer-1" });
});

test("decideSignupDedupe: the oldest eligible customer is the one reused", () => {
  const decision = decideSignupDedupe(
    [
      { id: "newer", created_at: "2026-02-01T00:00:00Z", status: "pending" },
      { id: "older", created_at: "2026-01-01T00:00:00Z", status: "pending" },
    ],
    [],
  );
  assert.deepEqual(decision, { action: "reuse", customerId: "older" });
});

test("decideSignupDedupe: an owned customer means the email is already registered — never reused, never re-invited", () => {
  const decision = decideSignupDedupe(
    [{ id: "customer-1", created_at: "2026-01-01T00:00:00Z", status: "pending" }],
    [{ customer_id: "customer-1" }],
  );
  assert.deepEqual(decision, { action: "already-registered" });
});

test("decideSignupDedupe: one owned customer among several still refuses, even if another is un-owned", () => {
  const decision = decideSignupDedupe(
    [
      { id: "owned", created_at: "2026-01-01T00:00:00Z", status: "pending" },
      { id: "unowned", created_at: "2026-01-02T00:00:00Z", status: "pending" },
    ],
    [{ customer_id: "owned" }],
  );
  assert.deepEqual(decision, { action: "already-registered" });
});

/* Fix round 3: reuse must never touch a real (non-pending, or already
   invoiced) customer, however it ended up with no owner. */

test("decideSignupDedupe: an un-owned customer that isn't pending is refused, not reused", () => {
  const decision = decideSignupDedupe(
    [{ id: "customer-1", created_at: "2026-01-01T00:00:00Z", status: "active" }],
    [],
  );
  assert.deepEqual(decision, { action: "already-registered" });
});

test("decideSignupDedupe: an un-owned, pending, but already-invoiced customer is refused, not reused", () => {
  const decision = decideSignupDedupe(
    [{ id: "customer-1", created_at: "2026-01-01T00:00:00Z", status: "pending" }],
    [],
    new Set(["customer-1"]),
  );
  assert.deepEqual(decision, { action: "already-registered" });
});

test("decideSignupDedupe: an ineligible customer alongside an eligible one still reuses the eligible one", () => {
  const decision = decideSignupDedupe(
    [
      { id: "active", created_at: "2026-01-01T00:00:00Z", status: "active" },
      { id: "pending", created_at: "2026-01-02T00:00:00Z", status: "pending" },
    ],
    [],
  );
  assert.deepEqual(decision, { action: "reuse", customerId: "pending" });
});

test("inviteCreatedNewUser: a user created at or after the request started is this request's own", () => {
  const requestStartedAt = Date.parse("2026-01-01T12:00:00.000Z");
  assert.equal(inviteCreatedNewUser("2026-01-01T12:00:00.100Z", requestStartedAt), true);
  assert.equal(inviteCreatedNewUser("2026-01-01T12:00:00.000Z", requestStartedAt), true);
});

test("inviteCreatedNewUser: a user created well before the request started already existed — the exact case the Critical exploited", () => {
  const requestStartedAt = Date.parse("2026-01-01T12:00:00.000Z");
  assert.equal(inviteCreatedNewUser("2026-01-01T11:00:00.000Z", requestStartedAt), false);
  assert.equal(inviteCreatedNewUser("2020-01-01T00:00:00.000Z", requestStartedAt), false);
});

test("inviteCreatedNewUser: only positive clock skew (the Auth server's clock running ahead) is tolerated, never negative", () => {
  // Fix round 2's Important: the previous version subtracted a 5-second
  // "slack" from requestStartedAt before comparing, which is the dangerous
  // direction — measured live, a user created 4999ms *before* the request
  // started was classified as "this request created it". A user created
  // strictly before the request started must never pass, by any margin;
  // one created after it (the direction real clock skew actually needs) is
  // already covered by the "at or after" test above.
  const requestStartedAt = Date.parse("2026-01-01T12:00:00.000Z");
  assert.equal(inviteCreatedNewUser("2026-01-01T11:59:59.999Z", requestStartedAt), false); // 1ms earlier
  assert.equal(inviteCreatedNewUser("2026-01-01T11:59:55.001Z", requestStartedAt), false); // ~5s earlier — the exploited window
});

test("inviteCreatedNewUser: an unparsable timestamp is never treated as newly created", () => {
  assert.equal(inviteCreatedNewUser("not-a-date", Date.now()), false);
});

/* Fix round 4 removed escapeLikePattern and its tests that lived here: an
   .ilike()-based lookup was itself the Critical this round closes (see
   lib/signup.ts's comment where the function used to be) — PostgREST
   rewrites a literal "*" to "%" before Postgres ever sees an ilike
   pattern, which no amount of escaping on this side could reach.
   lookupSignup (app/actions.ts) now compares a generated, stored
   `billing_email_lower` column with a plain `.eq()` instead, so there is
   no `like`/`ilike` pattern left anywhere in this path to escape. */

test("EMAIL_RE (lib/forms.ts) rejects a literal * — the exact character PostgREST's ilike rewrite exploited", () => {
  assert.equal(EMAIL_RE.test("*@nord.test"), false);
  assert.equal(EMAIL_RE.test("*@*.test"), false);
  assert.equal(EMAIL_RE.test("jens*hansen@nord.test"), false);
});

test("EMAIL_RE still accepts a real address containing % or _, both valid in a local part", () => {
  assert.equal(EMAIL_RE.test("a_b%c@example.test"), true);
});

/* Fix round 5: the pgTAP coverage in supabase/tests/signup.test.sql pins
   the database side of the primary fix (the generated column, its unique
   index, apply_signup_order's three re-checked conditions) — none of which
   a plain `node --test` run touches at all. This is the cheap thing a Node
   test *can* still pin without a live database: app/actions.ts's own
   source text must filter on billing_email_lower, never fall back to a
   plain, case-sensitive filter on billing_email directly (whether via
   .eq(), or via the .ilike()/.like() shape fix round 4 found exploitable
   through PostgREST's own wildcard rewrite). A source-text check, not a
   behavioural one — but a revert of either shape is exactly what it's
   built to catch, and it needs no database connection to run. */
test("submitSignup's customer lookup filters on billing_email_lower, never the raw billing_email column", () => {
  const actionsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "actions.ts");
  const source = readFileSync(actionsPath, "utf8");
  assert.match(
    source,
    /\.eq\(\s*"billing_email_lower"/,
    "expected the customer lookup to filter on billing_email_lower",
  );
  assert.doesNotMatch(
    source,
    /\.(eq|ilike|like)\(\s*"billing_email"\s*,/,
    "the lookup must never filter on the raw, case-sensitive billing_email column directly — .ilike() against it is the exact shape fix round 4 found exploitable via PostgREST's \"*\" -> \"%\" rewrite",
  );
});
