# App Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People can sign up for Odatone, log in, reset a password and log out inside the Expo app (`mobile/`), and only a signed-in customer with a live subscription can play music.

**Architecture:** The website gains one route, `POST /api/app/signup`, which turns JSON into the `FormData` the existing `submitSignup` server action already takes, so web and app share one signup implementation. Everything else the app does talks straight to Supabase with the public anon key: password sign-in, emailed 6-digit codes (`verifyOtp`), and reading the customer's own profile and subscription under the existing row-level security. An `AuthProvider` owns the session and a pure `entitlement` rule; `PlayerProvider` asks it before starting playback.

**Tech Stack:** Next.js 16 route handler, Supabase (GoTrue + PostgREST), Expo SDK 57 / React Native 0.86, expo-router, `@supabase/supabase-js`, AsyncStorage, `node --test` with Node's TypeScript stripping.

**Spec:** `docs/superpowers/specs/2026-09-29-app-accounts-design.md`. Read it before starting.

## Global Constraints

- Work in the worktree `/Users/cll/Developer/odatone/.claude/worktrees/mobile-monorepo`, on a new branch `app-accounts` created from `mobile-monorepo` (Task 0). Never touch the main checkout at `/Users/cll/Developer/odatone`: it holds someone else's uncommitted `simpler-signup` work.
- Do not edit `lib/signup.ts`, `app/actions.ts` or `components/signup/SignupFlow.tsx`.
- The app sends no `venueType` and no `m2`. On `main` the server still requires them, so a real app signup returns `venueType`/`m2` errors until `simpler-signup` is merged and deployed. That is expected; the app must show its generic server message for it, not crash or hang.
- Playable subscription statuses, exactly: `pending`, `trialing`, `active`, `past_due`. Staff roles `staff_admin` and `staff_support` always play.
- Minimum password length: 8.
- Offline entitlement window: 7 days. AsyncStorage key: `odatone.entitlement.v1`.
- Payment method sent by the app is always `"invoice"`. No card fields anywhere in the app.
- Every user-visible string goes in `mobile/src/i18n/strings.ts` with both `da` and `en`. Components hold no copy of their own.
- App env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. Never print or commit their values; `mobile/.env` is already ignored by the root `.gitignore` (`.env*`).
- The app keeps its own `package.json` and `node_modules`; no npm workspace. Install app packages with `npx expo install` from `mobile/`.
- Pure modules that `node --test` runs (`mobile/src/auth/entitlement.ts`, `errors.ts`, `signup-form.ts`, `api-response.ts`) import nothing from React Native, Expo or Supabase, and import each other with the `.ts` extension.
- Match the surrounding code: double quotes, 2-space indent, block comments that explain why, inline styles with `useTheme()` colours and `SPACE`/`RADIUS` tokens.
- End every commit message with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Two deviations from the spec's wording, both deliberate:
  - The spec lists a `locale` field in the signup body. Nothing on the server reads it (the invite email is bilingual), so the app does not send it and the route ignores it.
  - The spec names `verifyInvite` and `resetPassword` as separate actions. They are one function, `verifyCode(email, code, password, kind)`, because the only difference is the code's `kind`.
- `ean` and `po` are forwarded to `submitSignup`, which ignores them today, exactly as the web form's values are ignored. Do not add database columns for them.

## Review Focus

Conditions the spec implies but does not spell out. Each has a test in the task that owns the code.

1. **The code is accepted but saving the password fails** (too short for the server, or the network drops). Pressing the button again must not ask for a new code: the code is single-use and already spent. → `shouldVerifyCode` test, Task 5.
2. **The device clock is wrong.** A cached entitlement stamped in the future must not count, or setting the clock back would extend the 7-day offline window forever. → `resolveEntitled` test, Task 4.
3. **The server returns error keys the app has no field for** (`venueType`, `m2` before `simpler-signup` lands, or any future field). The customer must see the generic server message on the last step, not a form that silently does nothing. → `stepForErrors` / `visibleErrors` test, Task 7.
4. **The email is typed with capitals or stray spaces** (phone keyboards capitalise and append a space after autocomplete). Sign-in, the code check and signup must all use the trimmed, lower-cased address, or the code check fails against an address that looks identical. → `normalizeEmail` test, Task 5; `toPayload` test, Task 7.
5. **The API answers with something that isn't the expected JSON**: an HTML 404 page because the route isn't deployed, a Vercel error page, an empty body. The app must report "couldn't reach Odatone" and keep everything typed. → `readSignupResponse` test, Task 7.

---

## File map

Website (repository root):

| File | Responsibility |
|---|---|
| `lib/app-signup.ts` (new) | Pure: raw request text → `FormData` for `submitSignup`, or `null` |
| `app/api/app/signup/route.ts` (new) | HTTP wrapper: read body, call `submitSignup`, return JSON |
| `test/app-signup.test.ts` (new) | Tests for `lib/app-signup.ts` |
| `supabase/templates/invite.html`, `recovery.html` (modify) | Add the 6-digit code block |
| `docs/supabase-email-templates.md` (new) | How to update the hosted templates |

App (`mobile/`):

| File | Responsibility |
|---|---|
| `metro.config.js` (new), `tsconfig.json`, `package.json` (modify) | Read `../lib`, `@web/*` alias, `test` script |
| `.env.example` (new) | The three env var names |
| `src/auth/supabase.ts` (new) | The Supabase client and `API_URL` |
| `src/auth/entitlement.ts` (new) | Pure: account types, who may play, offline cache rule |
| `src/auth/errors.ts` (new) | Pure: error codes, `normalizeEmail`, `shouldVerifyCode` |
| `src/auth/account.ts` (new) | Reads profile, customer, subscription from Supabase |
| `src/auth/AuthProvider.tsx` (new) | Session, account, `entitled`, auth actions |
| `src/auth/signup-form.ts` (new) | Pure: signup draft, validation, payload, error routing |
| `src/auth/api-response.ts` (new) | Pure: HTTP status + body text → signup result |
| `src/auth/api.ts` (new) | `postSignup`: the `fetch` call |
| `src/data/plans.ts` (new) | `usePlans()`: plans from Supabase, compiled fallback |
| `src/components/Button.tsx`, `Field.tsx`, `AuthScreen.tsx` (new) | Shared form pieces and the modal scaffold |
| `src/components/GateSheet.tsx` (new) | "Log in to play" / "Subscription ended" sheet |
| `app/auth/login.tsx`, `forgot.tsx`, `verify.tsx`, `signup.tsx` (new) | The four auth screens |
| `app/_layout.tsx`, `src/audio/PlayerProvider.tsx`, `app/(tabs)/account.tsx`, `src/i18n/strings.ts` (modify) | Providers, gating, account card, copy |
| `test/*.test.ts` (new) | Unit tests for the four pure modules |

---

### Task 0: Branch and dependencies

**Files:** none changed in git except by later tasks.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/cll/Developer/odatone/.claude/worktrees/mobile-monorepo
git switch -c app-accounts
git status -sb
```

Expected: `## app-accounts`, clean.

- [ ] **Step 2: Install the website's dependencies in the worktree**

The worktree has no `node_modules` of its own. The route handler needs a real `next` to build against.

```bash
npm ci
```

Expected: exits 0.

- [ ] **Step 3: Give the worktree the website's local environment**

`.env.local` is ignored by git, so the worktree doesn't have it. Copy it from the main checkout without printing it:

```bash
cp /Users/cll/Developer/odatone/.env.local .env.local
git status --short
```

Expected: `git status` shows nothing (the file is ignored).

- [ ] **Step 4: Confirm the baseline**

```bash
npm test 2>&1 | tail -6
npx tsc --noEmit -p . && echo WEB_TSC_OK
(cd mobile && npm run -s typecheck && echo APP_TSC_OK)
```

Expected: `pass 170`, `fail 0`, `WEB_TSC_OK`, `APP_TSC_OK`.

---

### Task 1: `POST /api/app/signup`

**Files:**
- Create: `lib/app-signup.ts`
- Create: `app/api/app/signup/route.ts`
- Test: `test/app-signup.test.ts`

**Interfaces:**
- Consumes: `submitSignup(formData: FormData): Promise<ActionResult>` from `app/actions.ts`; `ActionResult = { ok: true; message?: string } | { ok: false; errors: Record<string, string> }` from `lib/forms.ts`.
- Produces: `parseAppSignup(raw: string): FormData | null`, and the HTTP contract the app's `postSignup` (Task 7) relies on:
  - `200` + `{ "ok": true }` or `{ "ok": true, "message": "no-invite" }`
  - `200` + `{ "ok": false, "errors": { "<field>": "<code>" } }`
  - `400` + `{ "ok": false, "errors": { "form": "invalid" } }` for a body that isn't a JSON object or is over 10 000 characters
  - `500` + `{ "ok": false, "errors": { "form": "server" } }` if the action throws

- [ ] **Step 1: Write the failing test**

Create `test/app-signup.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseAppSignup, MAX_BODY_CHARS } from "../lib/app-signup.ts";

const BODY = {
  name: "Jens Hansen",
  company: "Café Nord",
  email: "jens@nord.test",
  cvr: "12345678",
  phone: "+45 12 34 56 78",
  address: "Nørregade 1",
  postcode: "8000",
  city: "Aarhus",
  planId: "small",
  billing: "annual",
  locations: 3,
  ean: "5790000000000",
  po: "PO-7",
};

test("maps every field onto the names submitSignup reads", () => {
  const fd = parseAppSignup(JSON.stringify(BODY));
  assert.ok(fd);
  assert.equal(fd.get("name"), "Jens Hansen");
  assert.equal(fd.get("company"), "Café Nord");
  assert.equal(fd.get("email"), "jens@nord.test");
  assert.equal(fd.get("cvr"), "12345678");
  assert.equal(fd.get("phone"), "+45 12 34 56 78");
  assert.equal(fd.get("address"), "Nørregade 1");
  assert.equal(fd.get("postcode"), "8000");
  assert.equal(fd.get("city"), "Aarhus");
  assert.equal(fd.get("planId"), "small");
  assert.equal(fd.get("billing"), "annual");
  assert.equal(fd.get("ean"), "5790000000000");
  assert.equal(fd.get("po"), "PO-7");
});

test("sends a numeric location count as a digit string", () => {
  const fd = parseAppSignup(JSON.stringify(BODY));
  assert.equal(fd?.get("locations"), "3");
});

test("passes a fractional count through unrounded, for the server to reject", () => {
  const fd = parseAppSignup(JSON.stringify({ ...BODY, locations: 3.7 }));
  assert.equal(fd?.get("locations"), "3.7");
});

test("always pays by invoice, whatever the client claims", () => {
  const fd = parseAppSignup(JSON.stringify({ ...BODY, paymentMethod: "card" }));
  assert.equal(fd?.get("paymentMethod"), "invoice");
});

test("drops keys it does not know, and keys that are not text or numbers", () => {
  const fd = parseAppSignup(
    JSON.stringify({ ...BODY, role: "staff_admin", card: "4111", name: { $ne: "" }, city: null }),
  );
  assert.ok(fd);
  assert.equal(fd.has("role"), false);
  assert.equal(fd.has("card"), false);
  assert.equal(fd.has("name"), false);
  assert.equal(fd.has("city"), false);
});

test("leaves a missing field missing, so the server reports it as required", () => {
  const { email: _email, ...rest } = BODY;
  const fd = parseAppSignup(JSON.stringify(rest));
  assert.equal(fd?.has("email"), false);
});

test("refuses anything that is not a JSON object", () => {
  assert.equal(parseAppSignup(""), null);
  assert.equal(parseAppSignup("not json"), null);
  assert.equal(parseAppSignup("null"), null);
  assert.equal(parseAppSignup("[1,2]"), null);
  assert.equal(parseAppSignup('"text"'), null);
  assert.equal(parseAppSignup("42"), null);
});

test("refuses an oversized body before parsing it", () => {
  const big = JSON.stringify({ ...BODY, name: "x".repeat(MAX_BODY_CHARS) });
  assert.equal(parseAppSignup(big), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test test/app-signup.test.ts 2>&1 | tail -8
```

Expected: FAIL, `Cannot find module '.../lib/app-signup.ts'`.

- [ ] **Step 3: Write `lib/app-signup.ts`**

```ts
/* The mobile app's signup body, turned into the FormData that
   submitSignup (app/actions.ts) already takes from the web form. Kept
   apart from the route handler so it runs under plain `node --test`,
   the same split lib/signup.ts makes from app/actions.ts.

   Nothing here validates a value. buildSignup (lib/signup.ts) is the one
   place a signup field is judged, for the web form and the app alike;
   this only decides which keys are allowed to reach it. */

/** A real signup is a few hundred characters. This is a ceiling on what
    gets parsed at all, not a field limit — those are buildSignup's. */
export const MAX_BODY_CHARS = 10_000;

/** The field names SignupFlow.tsx sends, minus the venue step's. A key
    that is not on this list never reaches submitSignup. */
const FIELDS = [
  "name",
  "company",
  "email",
  "cvr",
  "phone",
  "address",
  "postcode",
  "city",
  "planId",
  "billing",
  "locations",
  "ean",
  "po",
] as const;

export function parseAppSignup(raw: string): FormData | null {
  if (raw.length > MAX_BODY_CHARS) return null;

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;

  const record = body as Record<string, unknown>;
  const fd = new FormData();
  for (const key of FIELDS) {
    const value = record[key];
    if (typeof value === "string") fd.set(key, value);
    else if (typeof value === "number" && Number.isFinite(value)) fd.set(key, String(value));
  }
  /* The app has no card form. Set here rather than trusted from the
     body, so a hand-written request cannot claim otherwise. */
  fd.set("paymentMethod", "invoice");
  return fd;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
node --test test/app-signup.test.ts 2>&1 | tail -8
```

Expected: `pass 8`, `fail 0`.

- [ ] **Step 5: Write the route handler**

This repository pins a Next.js version with its own conventions. Before writing, skim the route-handler page in `node_modules/next/dist/docs/` (search it for "route.ts") and follow it if it differs from the code below.

Create `app/api/app/signup/route.ts`:

```ts
import { NextResponse } from "next/server";

import { submitSignup } from "@/app/actions";
import { parseAppSignup } from "@/lib/app-signup";
import type { ActionResult } from "@/lib/forms";

/* The mobile app's way in to the same signup the web form runs. A native
   app cannot call a server action, and it cannot do this work itself:
   creating a customer needs the service role (see submitSignup's own
   comment), which never leaves the server.

   No session is read and none is needed — signing up is what an anonymous
   visitor does. Everything the body can influence is validated by
   buildSignup inside submitSignup, exactly as for the web form. */
export async function POST(request: Request) {
  const invalid: ActionResult = { ok: false, errors: { form: "invalid" } };

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json(invalid, { status: 400 });
  }

  const formData = parseAppSignup(raw);
  if (!formData) return NextResponse.json(invalid, { status: 400 });

  try {
    return NextResponse.json(await submitSignup(formData));
  } catch (err) {
    console.error("[odatone] app signup failed unexpectedly", err);
    const failed: ActionResult = { ok: false, errors: { form: "server" } };
    return NextResponse.json(failed, { status: 500 });
  }
}
```

- [ ] **Step 6: Check it against a running server**

An empty object fails validation before anything is written, so this is safe to run against the real database.

```bash
npx tsc --noEmit -p . && echo WEB_TSC_OK
(npx next dev -p 3100 > /tmp/odatone-dev.log 2>&1 &) ; sleep 8
curl -s -X POST http://127.0.0.1:3100/api/app/signup -H 'content-type: application/json' -d '{}'; echo
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3100/api/app/signup -d 'not json'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/api/app/signup
pkill -f "next dev -p 3100"
```

Expected:
- `WEB_TSC_OK`
- first `curl`: `{"ok":false,"errors":{...}}` with at least `"name":"required"`, `"company":"required"`, `"email":"email"` and `"plan":"required"` (on `main` also `venueType` and `m2`)
- second: `400`
- third: `405`

- [ ] **Step 7: Run the whole website suite and commit**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
git add lib/app-signup.ts app/api/app/signup/route.ts test/app-signup.test.ts
git commit -m "Add POST /api/app/signup for the mobile app

Turns the app's JSON into the FormData submitSignup already takes, so
the web form and the app run one signup implementation.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `pass 178`, `fail 0`.

---

### Task 2: The 6-digit code in the invite and recovery emails

**Files:**
- Modify: `supabase/templates/invite.html` (Danish block near line 106, English block near line 139)
- Modify: `supabase/templates/recovery.html` (Danish block near line 96, English block near line 127)
- Create: `docs/supabase-email-templates.md`

**Interfaces:**
- Produces: both emails print `{{ .Token }}`, which the app's verify screen (Task 6) asks the customer to type.

- [ ] **Step 1: Add the code block to `invite.html`, Danish half**

Insert this immediately **before** the line that starts `<p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:#8e8e93;">Linket er gyldigt i 24 timer.`:

```html
<p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:#6e6e73;">Bruger du Odatone-appen? Indtast denne kode i appen:</p>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr>
<td align="center" bgcolor="#f5f5f7" style="padding:20px; border:1px solid rgba(0,0,0,0.09); border-radius:14px;">
<span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace; font-size:32px; font-weight:700; letter-spacing:10px; color:#1c1c1e;">{{ .Token }}</span>
</td>
</tr>
</table>

```

- [ ] **Step 2: Add the code block to `invite.html`, English half**

Insert immediately **before** the line that starts `<p style="margin:0; font-size:12px; line-height:1.6; color:#8e8e93;">This link is valid for 24 hours.`:

```html
<p style="margin:0 0 8px 0; font-size:12px; line-height:1.6; color:#6e6e73;">Using the Odatone app? Enter this code in the app:</p>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
<tr>
<td align="center" bgcolor="#f5f5f7" style="padding:18px; border:1px solid rgba(0,0,0,0.09); border-radius:14px;">
<span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace; font-size:28px; font-weight:700; letter-spacing:9px; color:#1c1c1e;">{{ .Token }}</span>
</td>
</tr>
</table>

```

- [ ] **Step 3: Do the same in `recovery.html`**

Insert the Danish block from Step 1 immediately before the line starting `<p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:#8e8e93;">Linket er gyldigt i 1 time.`, and the English block from Step 2 immediately before the line starting `<p style="margin:0; font-size:12px; line-height:1.6; color:#8e8e93;">This link is valid for 1 hour.`.

- [ ] **Step 4: Update each file's header comment**

In the `<!-- ... -->` comment at the top of both files, add this paragraph before the line that begins `Brand tokens below`:

```
  Carries {{ .Token }} as well as the link: the mobile app cannot follow
  a link into the website, so the customer types the 6-digit code into
  the app instead (mobile/app/auth/verify.tsx). The link is unchanged
  and is still what a web visitor uses.

```

- [ ] **Step 5: Verify**

```bash
grep -c '{{ .Token }}' supabase/templates/invite.html supabase/templates/recovery.html
grep -c '{{ .ConfirmationURL }}' supabase/templates/invite.html supabase/templates/recovery.html
```

Expected: `{{ .Token }}` appears 3 times in each file (two code boxes and the header comment); `{{ .ConfirmationURL }}` still 6 in each.

- [ ] **Step 6: Write the hosted-dashboard instructions**

Create `docs/supabase-email-templates.md`:

```markdown
# Updating the hosted Supabase email templates

`supabase/templates/*.html` only configure the **local** Supabase stack
(`supabase/config.toml`). The hosted project keeps its own copies, and
nothing deploys these files to it. After changing a template here, paste
it into the dashboard by hand.

The mobile app depends on two of them printing `{{ .Token }}`. Until they
do, a customer who signs up in the app never receives the code the app
asks for.

1. Open the Supabase dashboard for the Odatone project.
2. Go to **Authentication → Emails → Templates** (older dashboards:
   Authentication → Email Templates).
3. **Invite user**: replace the message body with the whole of
   `supabase/templates/invite.html`. Leave the subject as it is. Save.
4. **Reset password**: replace the body with the whole of
   `supabase/templates/recovery.html`. Save.
5. **Magic link**: confirm the body already contains `{{ .Token }}`
   (`supabase/templates/magic_link.html` does). The app's "Resend code"
   button sends this email.
6. Under **Authentication → Sign In / Providers → Email**, confirm the
   email OTP length is **6** and the expiry is **3600** seconds, matching
   `otp_length` and `otp_expiry` in `supabase/config.toml`.

To check it worked: sign up in the app with an address you own. The
invite email should show a 6-digit code above the "valid for 24 hours"
line.
```

- [ ] **Step 7: Commit**

```bash
git add supabase/templates/invite.html supabase/templates/recovery.html docs/supabase-email-templates.md
git commit -m "Print the 6-digit code in the invite and recovery emails

The mobile app cannot follow an emailed link into the website, so the
customer types the code instead. The links are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: App foundation — Supabase client, shared code, test runner

**Files:**
- Create: `mobile/metro.config.js`
- Create: `mobile/.env.example`, `mobile/.env` (ignored)
- Create: `mobile/src/auth/supabase.ts`
- Create: `mobile/test/foundation.test.ts`
- Modify: `mobile/tsconfig.json`, `mobile/package.json`

**Interfaces:**
- Produces:
  - `supabase` (a `SupabaseClient`), `API_URL: string` (no trailing slash), `configured: boolean` from `mobile/src/auth/supabase.ts`
  - the import alias `@web/*` → `<repo>/lib/*`, usable from any file Metro bundles (not from files `node --test` runs)
  - `npm test` in `mobile/`, running `node --test test/`

- [ ] **Step 1: Install the packages**

```bash
cd mobile
npx expo install @supabase/supabase-js react-native-url-polyfill
```

Expected: both appear under `dependencies` in `mobile/package.json`.

- [ ] **Step 2: Add the test script**

In `mobile/package.json`, add to `scripts` after `"typecheck"`:

```json
    "test": "node --test test/",
```

- [ ] **Step 3: Write the failing test**

This pins the one thing the rest of the plan leans on: that the website's pricing module loads from the app's side of the repository and prices a plan.

Create `mobile/test/foundation.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PLANS, quote } from "../../lib/pricing.ts";

test("the website's pricing module is reachable from the app", () => {
  assert.equal(PLANS.length, 3);
  assert.equal(quote(PLANS[0], "monthly", 1).perLocation, PLANS[0].monthly);
});

test("tsconfig maps @web/* onto the website's lib folder", () => {
  const tsconfig = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"));
  assert.deepEqual(tsconfig.compilerOptions.paths["@web/*"], ["../lib/*"]);
  assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true);
});

test("the env example names all three variables and no values", () => {
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_API_URL"]) {
    assert.match(example, new RegExp(`^${name}=`, "m"));
  }
  assert.doesNotMatch(example, /^EXPO_PUBLIC_SUPABASE_ANON_KEY=.+$/m);
});
```

- [ ] **Step 4: Run it and watch it fail**

```bash
npm test 2>&1 | tail -12
```

Expected: the first test passes; the second fails on `paths` (undefined); the third fails with `ENOENT ... .env.example`.

- [ ] **Step 5: Configure TypeScript**

Replace `mobile/tsconfig.json` with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "paths": {
      "@web/*": ["../lib/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "test"
  ]
}
```

`test` is excluded because the tests import `node:test`, and adding `@types/node` to a React Native project makes Node's and React Native's global types (timers, `fetch`) fight. Node strips the types when it runs them; it does not need `tsc`.

- [ ] **Step 6: Configure Metro**

Create `mobile/metro.config.js`:

```js
/* The app imports a few pure modules from the website (../lib) — pricing
   above all, so the app and the web can never quote different prices.
   Metro only reads files inside the project unless told otherwise. */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/* Only ../lib, not the repository root: the root holds the website's own
   node_modules and .next, which Metro has no business watching. */
config.watchFolders = [path.resolve(projectRoot, "../lib")];

/* A file in ../lib must never resolve a package from the website's
   node_modules — two copies of React in one bundle is the classic way
   this goes wrong. Packages come from the app's own install, full stop. */
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 7: Create the env files**

```bash
cat > .env.example <<'EOF'
# The website's public Supabase values (NEXT_PUBLIC_SUPABASE_URL and
# NEXT_PUBLIC_SUPABASE_ANON_KEY in the repository root's .env.local).
# The anon key is public by design; row-level security is what protects data.
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Where POST /api/app/signup and /my-odatone live. No trailing slash.
EXPO_PUBLIC_API_URL=
EOF

{
  printf 'EXPO_PUBLIC_SUPABASE_URL=%s\n' "$(grep '^NEXT_PUBLIC_SUPABASE_URL=' ../.env.local | cut -d= -f2-)"
  printf 'EXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' ../.env.local | cut -d= -f2-)"
  printf 'EXPO_PUBLIC_API_URL=https://odatone.studio74.io\n'
} > .env

grep -c '=.' .env
git -C .. status --short mobile/.env
```

Expected: `3` (three lines with a value), and `git status` prints nothing for `mobile/.env`. Do not `cat` the file.

- [ ] **Step 8: Write the Supabase client**

Create `mobile/src/auth/supabase.ts`:

```ts
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False when the build has no Supabase values. createClient() throws on
    an empty URL, and a thrown error at import time is a white screen —
    so it is handed a placeholder instead, and AuthProvider checks this
    flag and reports a service error rather than calling a fake host. */
export const configured = url !== "" && anonKey !== "";

/** The website: POST /api/app/signup and the /my-odatone portal. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/* The anon key, never the service role: everything this client reads is
   decided by row-level security (supabase/migrations/0003_tenancy.sql),
   which lets a signed-in user see their own profile, customer and
   subscriptions and nothing else. */
export const supabase = createClient(configured ? url : "http://localhost", configured ? anonKey : "missing", {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    /* There is no URL to read a session from in a native app; leaving
       this on makes supabase-js look for window.location. */
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 9: Prove Metro resolves the alias**

Nothing imports `@web/*` yet, so Metro would not bundle it. Add one temporary line, check, remove it.

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npm run -s typecheck && echo APP_TSC_OK

printf 'import "@web/pricing";\n' | cat - app/_layout.tsx > /tmp/_layout.tsx && cp /tmp/_layout.tsx app/_layout.tsx
(npx expo start --port 8090 < /dev/null > /tmp/odatone-metro.log 2>&1 &) ; sleep 20
curl -s "http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true" | grep -c "ANNUAL_DISCOUNT_PCT"
pkill -f "expo start --port 8090"
git checkout app/_layout.tsx
git status --short
```

Expected: `pass 3`, `fail 0`; `APP_TSC_OK`; the `grep -c` prints `1` or more; `git status` shows `app/_layout.tsx` is not modified.

If the count is `0`, read `/tmp/odatone-metro.log` for the resolution error before going further: every later task that imports `@web/*` depends on this.

- [ ] **Step 10: Commit**

```bash
cd ..
git add mobile/metro.config.js mobile/tsconfig.json mobile/package.json mobile/package-lock.json mobile/.env.example mobile/src/auth/supabase.ts mobile/test/foundation.test.ts
git commit -m "Give the app a Supabase client and a way to import the website's lib

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The entitlement rule

**Files:**
- Create: `mobile/src/auth/entitlement.ts`
- Test: `mobile/test/entitlement.test.ts`

**Interfaces:**
- Produces, all from `mobile/src/auth/entitlement.ts`:

```ts
type Role = "owner" | "manager" | "staff_admin" | "staff_support";
type Subscription = { plan_id: string; billing: "monthly" | "annual"; status: string; created_at: string };
type Account = {
  profile: { role: Role; full_name: string | null; customer_id: string | null };
  customer: { id: string; name: string; billing_email: string; status: string } | null;
  subscription: Subscription | null;
};
type AccountState = { kind: "signed-out" } | { kind: "loaded"; account: Account | null } | { kind: "unavailable" };
type CachedEntitlement = { userId: string; entitled: boolean; at: number };
type Gate = "login" | "ended";

const PLAYABLE_STATUSES: readonly string[];
const OFFLINE_WINDOW_MS: number;
function latestSubscription<T extends { created_at: string; status: string }>(subs: T[]): T | null;
function accountEntitled(account: Account | null): boolean;
function parseCache(raw: string | null): CachedEntitlement | null;
function resolveEntitled(state: AccountState, cache: CachedEntitlement | null, userId: string | null, now: number): boolean;
function gateFor(signedIn: boolean): Gate;
```

- [ ] **Step 1: Write the failing test**

Create `mobile/test/entitlement.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OFFLINE_WINDOW_MS,
  accountEntitled,
  gateFor,
  latestSubscription,
  parseCache,
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd mobile && npm test 2>&1 | tail -8
```

Expected: FAIL, `Cannot find module '.../src/auth/entitlement.ts'`.

- [ ] **Step 3: Write `mobile/src/auth/entitlement.ts`**

```ts
/* Who may press play. Pure, no React Native and no Supabase, so the rule
   the whole app hangs on runs under plain `node --test`. */

export type Role = "owner" | "manager" | "staff_admin" | "staff_support";

/** The columns of `subscriptions` the app reads. */
export type Subscription = {
  plan_id: string;
  billing: "monthly" | "annual";
  status: string;
  created_at: string;
};

/** What row-level security lets a signed-in user read about themselves. */
export type Account = {
  profile: { role: Role; full_name: string | null; customer_id: string | null };
  /** null for staff, who belong to no customer. */
  customer: { id: string; name: string; billing_email: string; status: string } | null;
  subscription: Subscription | null;
};

/** `pending` is on the list on purpose: a signup creates a pending
    subscription, and the website promises the trial starts at once, not
    when staff get round to approving it. */
export const PLAYABLE_STATUSES: readonly string[] = ["pending", "trialing", "active", "past_due"];

const EARNING: readonly string[] = ["active", "trialing", "past_due"];
const STAFF: readonly string[] = ["staff_admin", "staff_support"];

/** Which subscription counts when a customer has several. The same rule
    as the website's latestSubscription (lib/admin/customers.ts): the
    newest earning one, or failing that the newest of any status. Copied
    rather than imported because that module pulls in the admin's stats
    and pricing; keep the two in step. */
export function latestSubscription<T extends { created_at: string; status: string }>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  const earning = subs.filter((s) => EARNING.includes(s.status));
  const pool = earning.length > 0 ? earning : subs;
  return pool.reduce((latest, s) => (Date.parse(s.created_at) > Date.parse(latest.created_at) ? s : latest));
}

export function accountEntitled(account: Account | null): boolean {
  if (!account) return false;
  if (STAFF.includes(account.profile.role)) return true;
  return account.subscription !== null && PLAYABLE_STATUSES.includes(account.subscription.status);
}

/** `loaded` with a null account is a signed-in user with no profile row —
    a real answer ("no access"), not a failure to read. `unavailable` is
    the failure: offline, or the request errored, or it has not come back
    yet. */
export type AccountState =
  | { kind: "signed-out" }
  | { kind: "loaded"; account: Account | null }
  | { kind: "unavailable" };

/** The last answer the server gave, kept on the device. */
export type CachedEntitlement = { userId: string; entitled: boolean; at: number };

/** A shop with poor signal keeps its music for a week; a lapsed account
    does not keep it forever. */
export const OFFLINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** How far into the future a cache stamp may sit and still be believed.
    Phone clocks get corrected by a few seconds all the time; a stamp a
    day ahead means the clock was moved. */
const CLOCK_DRIFT_MS = 5 * 60 * 1000;

export function parseCache(raw: string | null): CachedEntitlement | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { userId, entitled, at } = v as Record<string, unknown>;
    if (typeof userId !== "string" || typeof entitled !== "boolean" || typeof at !== "number") return null;
    return { userId, entitled, at };
  } catch {
    return null;
  }
}

export function resolveEntitled(
  state: AccountState,
  cache: CachedEntitlement | null,
  userId: string | null,
  now: number,
): boolean {
  if (state.kind === "signed-out" || userId === null) return false;
  if (state.kind === "loaded") return accountEntitled(state.account);
  if (!cache || cache.userId !== userId || !cache.entitled) return false;
  const age = now - cache.at;
  /* A negative age is a stamp from the future. Without the lower bound,
     setting the phone's clock back a year would make a week-old yes
     look new for a year. */
  return age >= -CLOCK_DRIFT_MS && age <= OFFLINE_WINDOW_MS;
}

export type Gate = "login" | "ended";

/** What to tell someone who pressed play and may not. */
export function gateFor(signedIn: boolean): Gate {
  return signedIn ? "ended" : "login";
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npm run -s typecheck && echo APP_TSC_OK
```

Expected: `pass 16`, `fail 0`; `APP_TSC_OK`.

- [ ] **Step 5: Commit**

```bash
cd ..
git add mobile/src/auth/entitlement.ts mobile/test/entitlement.test.ts
git commit -m "Add the rule for who may play

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `AuthProvider`

**Files:**
- Create: `mobile/src/auth/errors.ts`
- Create: `mobile/src/auth/account.ts`
- Create: `mobile/src/auth/AuthProvider.tsx`
- Modify: `mobile/app/_layout.tsx` (wrap the tree)
- Test: `mobile/test/auth-errors.test.ts`

**Interfaces:**
- Consumes: `supabase`, `configured` (Task 3); `Account`, `AccountState`, `CachedEntitlement`, `accountEntitled`, `latestSubscription`, `parseCache`, `resolveEntitled` (Task 4).
- Produces, from `mobile/src/auth/errors.ts`:

```ts
type AuthErrorCode = "invalid" | "code" | "weak" | "rate" | "service";
type AuthResult = { ok: true } | { ok: false; error: AuthErrorCode };
type CodeKind = "invite" | "email" | "recovery";
const MIN_PASSWORD = 8;
function normalizeEmail(raw: string): string;
function shouldVerifyCode(sessionEmail: string | null, email: string): boolean;
```

- Produces, from `mobile/src/auth/AuthProvider.tsx`:

```ts
function AuthProvider(props: { children: ReactNode }): JSX.Element;
function useAuth(): {
  ready: boolean;              // the stored session has been read
  signedIn: boolean;
  email: string | null;
  account: Account | null;
  entitled: boolean;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  verifyCode(email: string, code: string, password: string, kind: CodeKind): Promise<AuthResult>;
  resendCode(email: string): Promise<AuthResult>;
  requestReset(email: string): Promise<AuthResult>;
  refresh(): Promise<void>;
};
```

- [ ] **Step 1: Write the failing test**

Create `mobile/test/auth-errors.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd mobile && npm test 2>&1 | tail -8
```

Expected: FAIL, `Cannot find module '.../src/auth/errors.ts'`.

- [ ] **Step 3: Write `mobile/src/auth/errors.ts`**

```ts
/* What can go wrong when talking to Supabase Auth, reduced to the five
   things the app has a sentence for. Pure: takes the two fields of a
   supabase-js AuthError that matter, so it runs under `node --test`. */

export type AuthErrorCode = "invalid" | "code" | "weak" | "rate" | "service";
export type AuthResult = { ok: true } | { ok: false; error: AuthErrorCode };

/** Which email a code came from, which is also the `type` verifyOtp
    needs: the signup invite, a re-sent sign-in code, or a password reset. */
export type CodeKind = "invite" | "email" | "recovery";

/** The website's own minimum (lib/use-invite-fragment.ts). */
export const MIN_PASSWORD = 8;

/** Phone keyboards capitalise the first letter and add a space after an
    autocompleted address. The server lower-cases on its side
    (lib/signup.ts), so an address that differs only by case or a space
    must be the same address here too. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

type Failure = { code?: string; status?: number };

const RATE_CODES = ["over_email_send_rate_limit", "over_request_rate_limit"];

function isRate(f: Failure): boolean {
  return f.status === 429 || (f.code !== undefined && RATE_CODES.includes(f.code));
}

/** supabase-js reports a request that never got an answer as status 0,
    or with no status at all. */
function isOutage(f: Failure): boolean {
  return f.status === undefined || f.status === 0 || f.status >= 500;
}

/** Deliberately one answer for a wrong password and an unknown address,
    the same as the website's login (see lib/content/portal.ts). */
export function signInError(f: Failure): AuthErrorCode {
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  return "invalid";
}

export function codeError(f: Failure): AuthErrorCode {
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  return "code";
}

/** null means "not an error": choosing the password you already had is
    fine, the customer is in either way. */
export function passwordError(f: Failure): AuthErrorCode | null {
  if (f.code === "same_password") return null;
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  if (f.code === "weak_password" || f.status === 422) return "weak";
  return "service";
}

/** For "send me a code". Any refusal that would tell a stranger whether
    the address has an account is swallowed; only a rate limit or an
    outage is worth saying out loud. */
export function sendError(f: Failure): AuthErrorCode | null {
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  return null;
}

/** A code is single-use. If it was accepted but saving the password then
    failed, the customer is already signed in, and asking them for the
    code again would fail every time — so the second attempt skips
    straight to saving the password. */
export function shouldVerifyCode(sessionEmail: string | null, email: string): boolean {
  return sessionEmail === null || normalizeEmail(sessionEmail) !== normalizeEmail(email);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `pass 24`, `fail 0`.

- [ ] **Step 5: Write `mobile/src/auth/account.ts`**

```ts
import { latestSubscription, type Account, type Subscription } from "./entitlement.ts";
import { supabase } from "./supabase";

export type AccountResult = { ok: true; account: Account | null } | { ok: false };

/** Reads what the signed-in user is allowed to see about themselves.
    Row-level security does the filtering; the `.eq()` calls below only
    say which of the visible rows is wanted.

    `{ ok: true, account: null }` is a user with no profile row — signed
    in, but never set up as a customer or as staff. `{ ok: false }` is a
    request that failed, which the caller must not mistake for that. */
export async function fetchAccount(userId: string): Promise<AccountResult> {
  try {
    const profile = await supabase
      .from("profiles")
      .select("role, full_name, customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile.error) return { ok: false };
    if (!profile.data) return { ok: true, account: null };

    const p = profile.data as Account["profile"];
    if (!p.customer_id) return { ok: true, account: { profile: p, customer: null, subscription: null } };

    const [customer, subscriptions] = await Promise.all([
      supabase.from("customers").select("id, name, billing_email, status").eq("id", p.customer_id).maybeSingle(),
      supabase.from("subscriptions").select("plan_id, billing, status, created_at").eq("customer_id", p.customer_id),
    ]);
    if (customer.error || subscriptions.error) return { ok: false };

    return {
      ok: true,
      account: {
        profile: p,
        customer: (customer.data as Account["customer"]) ?? null,
        subscription: latestSubscription((subscriptions.data ?? []) as Subscription[]),
      },
    };
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 6: Write `mobile/src/auth/AuthProvider.tsx`**

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { fetchAccount } from "./account";
import {
  accountEntitled,
  parseCache,
  resolveEntitled,
  type Account,
  type AccountState,
  type CachedEntitlement,
} from "./entitlement.ts";
import {
  MIN_PASSWORD,
  codeError,
  normalizeEmail,
  passwordError,
  sendError,
  shouldVerifyCode,
  signInError,
  type AuthErrorCode,
  type AuthResult,
  type CodeKind,
} from "./errors.ts";
import { configured, supabase } from "./supabase";

const CACHE_KEY = "odatone.entitlement.v1";

type AuthValue = {
  /** False until the stored session has been read, so a screen can tell
      "signed out" from "not checked yet". */
  ready: boolean;
  signedIn: boolean;
  email: string | null;
  account: Account | null;
  /** May this person press play right now. */
  entitled: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  verifyCode: (email: string, code: string, password: string, kind: CodeKind) => Promise<AuthResult>;
  resendCode: (email: string) => Promise<AuthResult>;
  requestReset: (email: string) => Promise<AuthResult>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

const fail = (error: AuthErrorCode): AuthResult => ({ ok: false, error });
const OK: AuthResult = { ok: true };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AccountState>({ kind: "signed-out" });
  const [cache, setCache] = useState<CachedEntitlement | null>(null);

  const userId = session?.user.id ?? null;
  /* A request for one user's account can still be in the air when someone
     else signs in. The ref is how a late answer finds out it is stale. */
  const currentUser = useRef<string | null>(null);

  /* ---- session: read what is stored, then follow every change ---- */
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => alive && setReady(true));

    /* Only setSession here. Calling another supabase method from inside
       this callback deadlocks supabase-js's auth lock; the account is
       loaded from the effect below instead, once React has the new id. */
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async (id: string) => {
    const result = await fetchAccount(id);
    if (currentUser.current !== id) return;
    if (!result.ok) {
      setState({ kind: "unavailable" });
      return;
    }
    setState({ kind: "loaded", account: result.account });
    const next: CachedEntitlement = { userId: id, entitled: accountEntitled(result.account), at: Date.now() };
    setCache(next);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /* ---- account: reload whenever the signed-in user changes ---- */
  useEffect(() => {
    currentUser.current = userId;
    if (!userId) {
      setState({ kind: "signed-out" });
      setCache(null);
      return;
    }
    /* Until the server answers, the last known answer stands in — that is
       what lets music start at once when the app opens, and at all when
       the shop's wifi is down. */
    setState({ kind: "unavailable" });
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        const stored = parseCache(raw);
        if (stored && currentUser.current === userId) setCache((now) => now ?? stored);
      })
      .catch(() => {});
    load(userId);
  }, [userId, load]);

  /* ---- foreground: refresh tokens only while visible, and re-read the
          account each time the app comes back, so a subscription
          cancelled in /admin takes effect the next time it is opened ---- */
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        supabase.auth.startAutoRefresh();
        if (currentUser.current) load(currentUser.current);
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [load]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!configured) return fail("service");
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    return error ? fail(signInError(error)) : OK;
  }, []);

  const signOut = useCallback(async () => {
    /* "local": this phone only. The default signs the account out
       everywhere, which would stop the music in every other shop on the
       same login. A failed request still clears the local session. */
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    setCache(null);
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string, password: string, kind: CodeKind): Promise<AuthResult> => {
      if (!configured) return fail("service");
      /* Checked before the code is spent: a code is single-use, and
         burning it on a password the server was always going to refuse
         would send the customer back for another email. */
      if (password.length < MIN_PASSWORD) return fail("weak");

      const address = normalizeEmail(email);
      const { data: current } = await supabase.auth.getSession();
      if (shouldVerifyCode(current.session?.user.email ?? null, address)) {
        const { error } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: kind });
        if (error) return fail(codeError(error));
      }

      const { error } = await supabase.auth.updateUser({ password });
      const failed = error ? passwordError(error) : null;
      return failed ? fail(failed) : OK;
    },
    [],
  );

  const resendCode = useCallback(async (email: string): Promise<AuthResult> => {
    if (!configured) return fail("service");
    /* The sign-in-code email (supabase/templates/magic_link.html). Never
       creates a user: only someone the signup already invited gets one. */
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: false },
    });
    const failed = error ? sendError(error) : null;
    return failed ? fail(failed) : OK;
  }, []);

  const requestReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!configured) return fail("service");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
    const failed = error ? sendError(error) : null;
    return failed ? fail(failed) : OK;
  }, []);

  const refresh = useCallback(async () => {
    if (currentUser.current) await load(currentUser.current);
  }, [load]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      signedIn: userId !== null,
      email: session?.user.email ?? null,
      account: state.kind === "loaded" ? state.account : null,
      entitled: resolveEntitled(state, cache, userId, Date.now()),
      signIn,
      signOut,
      verifyCode,
      resendCode,
      requestReset,
      refresh,
    }),
    [ready, userId, session, state, cache, signIn, signOut, verifyCode, resendCode, requestReset, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
```

- [ ] **Step 7: Wrap the app**

In `mobile/app/_layout.tsx`, add the import after the `PlayerProvider` import:

```tsx
import { AuthProvider } from "../src/auth/AuthProvider";
```

and change the provider nesting in `RootLayout` so `AuthProvider` sits outside `PlayerProvider` (Task 8 makes the player read it):

```tsx
        <I18nProvider>
          <AuthProvider>
            <PlayerProvider>
              <Shell />
            </PlayerProvider>
          </AuthProvider>
        </I18nProvider>
```

- [ ] **Step 8: Verify**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npm run -s typecheck && echo APP_TSC_OK
(npx expo start --port 8090 < /dev/null > /tmp/odatone-metro.log 2>&1 &) ; sleep 20
curl -s -o /dev/null -w 'bundle %{http_code}\n' "http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true"
grep -ci "error" /tmp/odatone-metro.log
pkill -f "expo start --port 8090"
```

Expected: `pass 24`, `fail 0`; `APP_TSC_OK`; `bundle 200`; `0` errors in the log.

- [ ] **Step 9: Commit**

```bash
cd ..
git add mobile/src/auth/errors.ts mobile/src/auth/account.ts mobile/src/auth/AuthProvider.tsx mobile/app/_layout.tsx mobile/test/auth-errors.test.ts
git commit -m "Add AuthProvider: session, account and the auth actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Log in, forgot password, enter code, and the Account card

**Files:**
- Create: `mobile/src/components/Button.tsx`, `mobile/src/components/Field.tsx`, `mobile/src/components/AuthScreen.tsx`
- Create: `mobile/app/auth/login.tsx`, `mobile/app/auth/forgot.tsx`, `mobile/app/auth/verify.tsx`
- Modify: `mobile/app/_layout.tsx` (register the three routes as modals)
- Modify: `mobile/app/(tabs)/account.tsx` (replace the static Plan card)
- Modify: `mobile/src/i18n/strings.ts`

**Interfaces:**
- Consumes: `useAuth()` and the types in `errors.ts` (Task 5); `API_URL` (Task 3); `PLANS` from `@web/pricing`.
- Produces:
  - `Button({ label, onPress, variant?: "primary" | "secondary" | "link", busy?, disabled? })`
  - `Field({ label, error?, hint?, ...TextInputProps })`
  - `AuthScreen({ title, body?, children })`, `Notice({ text })`, `closeAuth(router)` from `AuthScreen.tsx`
  - routes `/auth/login`, `/auth/forgot`, `/auth/verify?email=…&kind=invite|recovery`
- Navigation rule for every auth screen, relied on by Tasks 7 and 8: **move between auth screens with `router.replace`, never `router.push`**, so there is only ever one auth screen on the stack and `closeAuth` (one `router.back()`) returns the customer to where they were.

- [ ] **Step 1: Add the strings**

In `mobile/src/i18n/strings.ts`, delete these two lines:

```ts
  "account.planName": { da: "Small Venue", en: "Small Venue" },
  "account.planPrice": { da: "149 kr. pr. lokation / måned", en: "DKK 149 per location / month" },
```

and add these entries directly above the `"common.min"` line:

```ts
  "auth.close": { da: "Luk", en: "Close" },
  "auth.email": { da: "E-mail", en: "Email" },
  "auth.password": { da: "Adgangskode", en: "Password" },
  "auth.newPassword": { da: "Ny adgangskode", en: "New password" },
  "auth.passwordHint": { da: "mindst 8 tegn", en: "at least 8 characters" },
  "auth.code": { da: "Kode fra e-mailen", en: "Code from the email" },

  "auth.login.title": { da: "Log ind", en: "Log in" },
  "auth.login.body": {
    da: "Log ind med den e-mail og adgangskode, du bruger på Mit Odatone.",
    en: "Log in with the email and password you use for My Odatone.",
  },
  "auth.login.submit": { da: "Log ind", en: "Log in" },
  "auth.login.forgot": { da: "Glemt adgangskode?", en: "Forgot password?" },

  "auth.forgot.title": { da: "Nulstil adgangskode", en: "Reset password" },
  "auth.forgot.body": {
    da: "Skriv din e-mail, så sender vi en kode, du kan vælge en ny adgangskode med.",
    en: "Enter your email and we'll send a code you can choose a new password with.",
  },
  "auth.forgot.submit": { da: "Send kode", en: "Send code" },
  "auth.forgot.back": { da: "Tilbage til log ind", en: "Back to log in" },

  "auth.verify.titleInvite": { da: "Bekræft din e-mail", en: "Confirm your email" },
  "auth.verify.titleRecovery": { da: "Vælg en ny adgangskode", en: "Choose a new password" },
  "auth.verify.body": {
    da: "Vi har sendt en kode på 6 cifre til {email}. Skriv den her, og vælg en adgangskode.",
    en: "We've sent a 6-digit code to {email}. Enter it here and choose a password.",
  },
  "auth.verify.submit": { da: "Gem og fortsæt", en: "Save and continue" },
  "auth.verify.resend": { da: "Send koden igen", en: "Resend code" },
  "auth.verify.resent": {
    da: "Vi har sendt en ny kode. Den gamle virker ikke længere.",
    en: "We've sent a new code. The old one no longer works.",
  },

  "auth.error.invalid": {
    da: "Den e-mail og adgangskode passer ikke sammen.",
    en: "That email and password don't match.",
  },
  "auth.error.code": {
    da: "Koden er forkert eller udløbet.",
    en: "The code is wrong or has expired.",
  },
  "auth.error.weak": {
    da: "Adgangskoden skal være mindst 8 tegn.",
    en: "The password must be at least 8 characters.",
  },
  "auth.error.rate": {
    da: "For mange forsøg. Vent lidt, og prøv igen.",
    en: "Too many attempts. Wait a moment and try again.",
  },
  "auth.error.service": {
    da: "Vi kunne ikke få forbindelse til Odatone. Prøv igen.",
    en: "Couldn't reach Odatone. Try again.",
  },
  "auth.error.email": { da: "Ugyldig e-mail", en: "Invalid email" },

  "account.signedOut.title": { da: "Log ind for at spille", en: "Log in to play" },
  "account.signedOut.body": {
    da: "Musikken er for Odatone-kunder. Log ind, eller opret en konto med 14 dage gratis.",
    en: "The music is for Odatone customers. Log in, or create an account with 14 days free.",
  },
  "account.logIn": { da: "Log ind", en: "Log in" },
  "account.logOut": { da: "Log ud", en: "Log out" },
  "account.manage": { da: "Administrér abonnement", en: "Manage subscription" },
  "account.noAccess": {
    da: "Din konto er ikke sat op til Odatone endnu. Kontakt os.",
    en: "Your account isn't set up for Odatone yet. Contact us.",
  },
  "account.staff": { da: "Odatone-medarbejder", en: "Odatone staff" },
  "account.noSubscription": { da: "Intet abonnement", en: "No subscription" },
  "account.status.pending": { da: "Afventer", en: "Pending" },
  "account.status.trialing": { da: "Prøveperiode", en: "Trialing" },
  "account.status.active": { da: "Aktiv", en: "Active" },
  "account.status.past_due": { da: "Forfalden", en: "Past due" },
  "account.status.cancelled": { da: "Opsagt", en: "Cancelled" },
```

- [ ] **Step 2: Write `mobile/src/components/Button.tsx`**

```tsx
import { ActivityIndicator, Pressable } from "react-native";

import { useTheme } from "../theme/theme";
import { RADIUS } from "../theme/tokens";
import { Txt } from "./Txt";

/** One button for every form. `primary` is the filled accent pill, used
    once per screen; `secondary` is the outlined alternative; `link` is
    text only, for the way out ("Forgot password?"). */
export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "link";
  busy?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const off = busy || disabled;

  if (variant === "link") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={off}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 8, opacity: off ? 0.5 : pressed ? 0.6 : 1 })}
      >
        <Txt variant="bodyStrong" tone="accent">
          {label}
        </Txt>
      </Pressable>
    );
  }

  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        paddingHorizontal: 20,
        borderRadius: RADIUS.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? c.accent : c.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: c.line,
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.accentInk : c.ink2} />
      ) : (
        <Txt variant="bodyStrong" tone={primary ? "onAccent" : "ink"}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 3: Write `mobile/src/components/Field.tsx`**

```tsx
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "../theme/theme";
import { RADIUS } from "../theme/tokens";
import { Txt } from "./Txt";

/** A labelled text input. The error sits under the field it belongs to,
    the same place the website's <Field> puts it. */
export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Txt variant="label" tone="ink2">
          {label}
        </Txt>
        {hint ? (
          <Txt variant="label" tone="ink3">
            {hint}
          </Txt>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.ink3}
        {...input}
        style={[
          {
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: error ? c.warn : c.line,
            backgroundColor: c.surface,
            color: c.ink,
            fontSize: 16,
          },
          style,
        ]}
      />
      {error ? (
        <Txt variant="label" tone="warn">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Write `mobile/src/components/AuthScreen.tsx`**

```tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../i18n/i18n";
import { useTheme } from "../theme/theme";
import { RADIUS, SPACE } from "../theme/tokens";
import { Txt } from "./Txt";

type Router = ReturnType<typeof useRouter>;

/** Leave the auth flow. Every auth screen replaces the one before it, so
    there is exactly one of them on the stack and one step back is the
    screen the customer came from. The fallback covers an auth screen
    opened cold from a link, with nothing underneath it. */
export function closeAuth(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** The frame every auth screen shares: a close button, a title, and a
    scroll view that moves out of the keyboard's way. */
export function AuthScreen({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + SPACE.md,
          paddingHorizontal: SPACE.lg,
          paddingBottom: insets.bottom + SPACE.xl,
          gap: SPACE.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("auth.close")}
          hitSlop={12}
          onPress={() => closeAuth(router)}
          style={{ alignSelf: "flex-end" }}
        >
          <Ionicons name="close" size={26} color={c.ink2} />
        </Pressable>
        <View style={{ gap: 8 }}>
          <Txt variant="title">{title}</Txt>
          {body ? (
            <Txt variant="body" tone="ink2">
              {body}
            </Txt>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A message about the whole form rather than one field. */
export function Notice({ text, tone = "warn" }: { text: string; tone?: "warn" | "ink2" }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: SPACE.md,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface,
      }}
    >
      <Txt variant="body" tone={tone}>
        {text}
      </Txt>
    </View>
  );
}
```

- [ ] **Step 5: Write `mobile/app/auth/login.tsx`**

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import type { AuthErrorCode } from "../../src/auth/errors.ts";
import { AuthScreen, Notice, closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { useI18n } from "../../src/i18n/i18n";

export default function LoginScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const submit = async () => {
    if (busy) return;
    /* An empty form is the same answer as a wrong one, without the
       round trip. */
    if (!email.trim() || !password) {
      setError("invalid");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) closeAuth(router);
    else setError(result.error);
  };

  return (
    <AuthScreen title={t("auth.login.title")} body={t("auth.login.body")}>
      {error ? <Notice text={t(`auth.error.${error}`)} /> : null}
      <Field
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
      />
      <Field
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t("auth.login.submit")} onPress={submit} busy={busy} />
      <Button variant="link" label={t("auth.login.forgot")} onPress={() => router.replace("/auth/forgot")} />
    </AuthScreen>
  );
}
```

- [ ] **Step 6: Write `mobile/app/auth/forgot.tsx`**

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import { normalizeEmail, type AuthErrorCode } from "../../src/auth/errors.ts";
import { AuthScreen, Notice } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { useI18n } from "../../src/i18n/i18n";

export default function ForgotScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { requestReset } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | "email" | null>(null);

  const submit = async () => {
    if (busy) return;
    const address = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError("email");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestReset(address);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    /* On to the code screen whether or not the address has an account —
       saying "no such account" here would let anyone test addresses. */
    router.replace({ pathname: "/auth/verify", params: { email: address, kind: "recovery" } });
  };

  return (
    <AuthScreen title={t("auth.forgot.title")} body={t("auth.forgot.body")}>
      {error && error !== "email" ? <Notice text={t(`auth.error.${error}`)} /> : null}
      <Field
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        error={error === "email" ? t("auth.error.email") : undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button label={t("auth.forgot.submit")} onPress={submit} busy={busy} />
      <Button variant="link" label={t("auth.forgot.back")} onPress={() => router.replace("/auth/login")} />
    </AuthScreen>
  );
}
```

- [ ] **Step 7: Write `mobile/app/auth/verify.tsx`**

```tsx
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import type { AuthErrorCode, CodeKind } from "../../src/auth/errors.ts";
import { AuthScreen, Notice, closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { useI18n } from "../../src/i18n/i18n";

/** Where a new customer (after signup) and a customer resetting a
    password both end up: type the 6-digit code from the email, choose a
    password. */
export default function VerifyScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { verifyCode, resendCode, requestReset } = useAuth();
  const params = useLocalSearchParams<{ email?: string; kind?: string }>();

  const email = String(params.email ?? "");
  const recovery = params.kind === "recovery";
  /* Starts as the email that was actually sent. A resend from the signup
     path goes out as the sign-in-code email instead, whose code verifies
     under a different type — so the kind follows the last email sent. */
  const [kind, setKind] = useState<CodeKind>(recovery ? "recovery" : "invite");

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  if (!email) return <Redirect href="/auth/login" />;

  const submit = async () => {
    if (busy) return;
    if (code.trim().length !== 6) {
      setError("code");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifyCode(email, code, password, kind);
    setBusy(false);
    if (result.ok) closeAuth(router);
    else setError(result.error);
  };

  const resend = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    setResent(false);
    const result = recovery ? await requestReset(email) : await resendCode(email);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!recovery) setKind("email");
    setCode("");
    setResent(true);
  };

  return (
    <AuthScreen
      title={t(recovery ? "auth.verify.titleRecovery" : "auth.verify.titleInvite")}
      body={t("auth.verify.body").replace("{email}", email)}
    >
      {error ? <Notice text={t(`auth.error.${error}`)} /> : null}
      {resent && !error ? <Notice tone="ink2" text={t("auth.verify.resent")} /> : null}
      <Field
        label={t("auth.code")}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      <Field
        label={t("auth.newPassword")}
        hint={t("auth.passwordHint")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t("auth.verify.submit")} onPress={submit} busy={busy} />
      <Button variant="link" label={t("auth.verify.resend")} onPress={resend} busy={sending} />
    </AuthScreen>
  );
}
```

- [ ] **Step 8: Register the routes**

In `mobile/app/_layout.tsx`, add above `export default function RootLayout`:

```tsx
/* Every auth screen is a modal over whatever the customer was looking at,
   so closing it puts them back there. */
const AUTH_MODAL = { presentation: "modal", animation: "slide_from_bottom" } as const;
```

and add inside `<Stack>`, after the `playlist/[id]` screen:

```tsx
        <Stack.Screen name="auth/login" options={AUTH_MODAL} />
        <Stack.Screen name="auth/forgot" options={AUTH_MODAL} />
        <Stack.Screen name="auth/verify" options={AUTH_MODAL} />
```

- [ ] **Step 9: Replace the Account tab's static Plan card**

In `mobile/app/(tabs)/account.tsx`:

Change the `react-native` import to add `RefreshControl`, and add these imports:

```tsx
import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { PLANS } from "@web/pricing";

import { useAuth } from "../../src/auth/AuthProvider";
import { API_URL } from "../../src/auth/supabase";
import { Button } from "../../src/components/Button";
import { STRINGS, type StringKey } from "../../src/i18n/strings";
```

Inside `AccountTab`, add after the `useI18n()` line:

```tsx
  const { refresh, signedIn } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };
```

Give the `ScrollView` a refresh control (only meaningful when signed in):

```tsx
      <ScrollView
        contentContainerStyle={{ paddingBottom: BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={c.ink3} /> : undefined}
      >
```

Replace this block:

```tsx
        <Card>
          <Txt variant="label" tone="ink3">{t("account.plan")}</Txt>
          <Txt variant="section">{t("account.planName")}</Txt>
          <Txt variant="body" tone="ink2">{t("account.planPrice")}</Txt>
        </Card>
```

with:

```tsx
        <AccountCard />
```

and add this component above the `Card` function at the bottom of the file:

```tsx
/** Who is signed in and what they are on — or, signed out, the way in. */
function AccountCard() {
  const { t } = useI18n();
  const router = useRouter();
  const { ready, signedIn, email, account, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);

  /* Nothing until the stored session has been read: showing "Log in" for
     half a second to someone who is logged in is worse than a gap. */
  if (!ready) return null;

  if (!signedIn) {
    return (
      <Card>
        <Txt variant="section">{t("account.signedOut.title")}</Txt>
        <Txt variant="body" tone="ink2">{t("account.signedOut.body")}</Txt>
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button label={t("account.logIn")} onPress={() => router.push("/auth/login")} />
        </View>
      </Card>
    );
  }

  const staff = account?.profile.role === "staff_admin" || account?.profile.role === "staff_support";
  const subscription = account?.subscription ?? null;
  const planName = subscription ? PLANS.find((p) => p.id === subscription.plan_id)?.name ?? subscription.plan_id : null;
  /* An enum value this build has no label for falls back to the raw
     word rather than throwing — the website's statusLabel does the same. */
  const statusKey = `account.status.${subscription?.status ?? ""}`;
  const status = subscription ? (statusKey in STRINGS ? t(statusKey as StringKey) : subscription.status) : null;

  const leave = async () => {
    setLeaving(true);
    await signOut();
    setLeaving(false);
  };

  return (
    <Card>
      <Txt variant="label" tone="ink3">{account?.customer?.name ?? (staff ? t("account.staff") : t("account.title"))}</Txt>
      <Txt variant="section" numberOfLines={1}>{account?.profile.full_name || email}</Txt>
      {account?.profile.full_name ? <Txt variant="body" tone="ink2" numberOfLines={1}>{email}</Txt> : null}

      {account === null ? (
        <Txt variant="body" tone="warn" style={{ marginTop: 6 }}>{t("account.noAccess")}</Txt>
      ) : staff ? null : (
        <View style={{ marginTop: 10, gap: 2 }}>
          <Txt variant="label" tone="ink3">{t("account.plan")}</Txt>
          <Txt variant="bodyStrong">{planName ?? t("account.noSubscription")}</Txt>
          {status ? <Txt variant="body" tone={subscription?.status === "cancelled" ? "warn" : "ink2"}>{status}</Txt> : null}
        </View>
      )}

      <View style={{ gap: 10, marginTop: 12 }}>
        {!staff && account !== null ? (
          <Button
            variant="secondary"
            label={t("account.manage")}
            onPress={() => Linking.openURL(`${API_URL}/my-odatone`).catch(() => {})}
          />
        ) : null}
        <Button variant="secondary" label={t("account.logOut")} onPress={leave} busy={leaving} />
      </View>
    </Card>
  );
}
```

`account === null` while signed in also covers the moment before the first answer arrives and the offline case; the "not set up" line can flash for a moment on a slow connection. That is acceptable for now and is listed under Known limits in Task 9.

- [ ] **Step 10: Verify the build**

```bash
cd mobile
grep -rn "account.planName\|account.planPrice" app src ; echo "stale refs: $?"
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npm run -s typecheck && echo APP_TSC_OK
(npx expo start --port 8090 < /dev/null > /tmp/odatone-metro.log 2>&1 &) ; sleep 20
curl -s "http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true" > /tmp/odatone-bundle.js
grep -c "auth.verify.titleInvite" /tmp/odatone-bundle.js
grep -ci "error" /tmp/odatone-metro.log
pkill -f "expo start --port 8090"
```

Expected: `stale refs: 1` (grep found nothing); `pass 24`, `fail 0`; `APP_TSC_OK`; the string count is `1` or more; `0` errors.

- [ ] **Step 11: Look at the screens**

Start the app in the iOS Simulator and open each route by link, taking a screenshot of each:

```bash
npx expo start --ios --port 8090 < /dev/null > /tmp/odatone-metro.log 2>&1 &
sleep 60
for route in auth/login auth/forgot "auth/verify?email=test@example.com&kind=invite"; do
  xcrun simctl openurl booted "exp://127.0.0.1:8090/--/$route"
  sleep 4
  xcrun simctl io booted screenshot "/tmp/odatone-$(echo "$route" | tr '/?&=@' '-----').png"
done
pkill -f "expo start --ios --port 8090"
```

Read each screenshot. Expected: the title, the fields and the buttons are all visible and nothing overlaps; the verify screen's body shows `test@example.com`.

If the simulator or Expo Go cannot be started from the terminal, say so in the task report. Do not report the screens as seen.

- [ ] **Step 12: Commit**

```bash
cd ..
git add mobile/src/components/Button.tsx mobile/src/components/Field.tsx mobile/src/components/AuthScreen.tsx mobile/app/auth mobile/app/_layout.tsx "mobile/app/(tabs)/account.tsx" mobile/src/i18n/strings.ts
git commit -m "Add log in, forgot password and the code screen to the app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Create account

**Files:**
- Create: `mobile/src/auth/signup-form.ts`, `mobile/src/auth/api-response.ts`, `mobile/src/auth/api.ts`
- Create: `mobile/src/data/plans.ts`
- Create: `mobile/app/auth/signup.tsx`
- Modify: `mobile/src/lib/format.ts` (add `kr`)
- Modify: `mobile/app/_layout.tsx`, `mobile/app/auth/login.tsx`, `mobile/app/(tabs)/account.tsx`, `mobile/src/i18n/strings.ts`
- Test: `mobile/test/signup-form.test.ts`, `mobile/test/api-response.test.ts`

**Interfaces:**
- Consumes: the HTTP contract of `POST /api/app/signup` (Task 1); `supabase`, `configured`, `API_URL` (Task 3); `normalizeEmail` (Task 5); `AuthScreen`, `Notice`, `closeAuth`, `Button`, `Field` and the `router.replace` rule (Task 6); `quote`, `PLANS`, `ANNUAL_DISCOUNT_PCT`, `Plan` from `@web/pricing`; `rowToPlan`, `PlanRow` from `@web/plans-row`.
- Produces:

```ts
// signup-form.ts
type SignupDraft = {
  planId: string; billing: "monthly" | "annual"; locations: number;
  name: string; company: string; cvr: string; email: string; phone: string;
  address: string; postcode: string; city: string;
  ean: string; po: string; terms: boolean;
};
type FieldErrors = Record<string, string>;
type ErrorKey = "required" | "long" | "email" | "cvr" | "ean" | "terms" | "exists" | "server" | "plan" | "locations";
const EMPTY_DRAFT: SignupDraft; const MIN_LOCATIONS = 1; const MAX_LOCATIONS = 99;
function validatePlan(d: SignupDraft): FieldErrors;
function validateAccount(d: SignupDraft): FieldErrors;
function validatePayment(d: SignupDraft): FieldErrors;
function toPayload(d: SignupDraft): Record<string, string | number>;
function visibleErrors(errors: FieldErrors): FieldErrors;
function stepForErrors(errors: FieldErrors): number;   // 0, 1 or 2
function errorKey(field: string, code: string): ErrorKey;

// api-response.ts
type SignupResult = { kind: "ok"; invited: boolean } | { kind: "errors"; errors: FieldErrors } | { kind: "unreachable" };
function readSignupResponse(status: number, body: string): SignupResult;

// api.ts
function postSignup(payload: Record<string, string | number>): Promise<SignupResult>;

// data/plans.ts
function usePlans(): Plan[];
```

- route `/auth/signup`

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/signup-form.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_DRAFT,
  errorKey,
  stepForErrors,
  toPayload,
  validateAccount,
  validatePayment,
  validatePlan,
  visibleErrors,
  type SignupDraft,
} from "../src/auth/signup-form.ts";

const VALID: SignupDraft = {
  ...EMPTY_DRAFT,
  name: "Jens Hansen",
  company: "Café Nord",
  email: "jens@nord.test",
  address: "Nørregade 1",
  postcode: "8000",
  city: "Aarhus",
  terms: true,
};

test("an empty account step names every required field", () => {
  assert.deepEqual(validateAccount(EMPTY_DRAFT), {
    name: "required",
    company: "required",
    email: "email",
    address: "required",
    postcode: "required",
    city: "required",
  });
});

test("a complete account step has no errors, with the optional fields blank", () => {
  assert.deepEqual(validateAccount(VALID), {});
});

test("a CVR is optional, but if given it is 8 digits however it is typed", () => {
  assert.deepEqual(validateAccount({ ...VALID, cvr: "12 34 56 78" }), {});
  assert.deepEqual(validateAccount({ ...VALID, cvr: "DK12345678" }), {});
  assert.deepEqual(validateAccount({ ...VALID, cvr: "1234567" }), { cvr: "cvr" });
});

test("an email is judged after trimming and lower-casing", () => {
  assert.deepEqual(validateAccount({ ...VALID, email: "  Jens@Nord.Test " }), {});
  assert.deepEqual(validateAccount({ ...VALID, email: "jens@nord" }), { email: "email" });
  assert.deepEqual(validateAccount({ ...VALID, email: "jens nord@x.test" }), { email: "email" });
  assert.deepEqual(validateAccount({ ...VALID, email: "*@*.test" }), { email: "email" });
});

test("the server's length caps are applied before sending", () => {
  assert.deepEqual(validateAccount({ ...VALID, name: "x".repeat(201) }), { name: "long" });
  assert.deepEqual(validateAccount({ ...VALID, company: "x".repeat(201) }), { company: "long" });
  assert.deepEqual(validateAccount({ ...VALID, email: `${"x".repeat(250)}@a.dk` }), { email: "long" });
  assert.deepEqual(validateAccount({ ...VALID, phone: "1".repeat(301) }), { phone: "long" });
  assert.deepEqual(validateAccount({ ...VALID, address: "x".repeat(301) }), { address: "long" });
});

test("the plan step wants a plan and a whole number of locations from 1 to 99", () => {
  assert.deepEqual(validatePlan(VALID), {});
  assert.deepEqual(validatePlan({ ...VALID, planId: "" }), { plan: "required" });
  for (const locations of [0, 100, 2.5, Number.NaN]) {
    assert.deepEqual(validatePlan({ ...VALID, locations }), { locations: "required" }, String(locations));
  }
  assert.deepEqual(validatePlan({ ...VALID, locations: 99 }), {});
});

test("the payment step wants the terms accepted and, if given, a 13-digit EAN", () => {
  assert.deepEqual(validatePayment(VALID), {});
  assert.deepEqual(validatePayment({ ...VALID, terms: false }), { terms: "terms" });
  assert.deepEqual(validatePayment({ ...VALID, ean: "5790 0000 0000 0" }), {});
  assert.deepEqual(validatePayment({ ...VALID, ean: "12345" }), { ean: "ean" });
});

test("the payload is trimmed, the email normalised, and the numbers reduced to digits", () => {
  const payload = toPayload({
    ...VALID,
    name: "  Jens Hansen ",
    email: " Jens@Nord.Test ",
    cvr: "DK 12 34 56 78",
    ean: "5790 0000 0000 0",
    billing: "annual",
    locations: 3,
    planId: "medium",
  });
  assert.deepEqual(payload, {
    name: "Jens Hansen",
    company: "Café Nord",
    email: "jens@nord.test",
    cvr: "12345678",
    phone: "",
    address: "Nørregade 1",
    postcode: "8000",
    city: "Aarhus",
    planId: "medium",
    billing: "annual",
    locations: 3,
    ean: "5790000000000",
    po: "",
  });
  assert.equal("terms" in payload, false);
});

test("a server error sends the customer to the earliest step that owns a field in it", () => {
  assert.equal(stepForErrors({ plan: "required" }), 0);
  assert.equal(stepForErrors({ locations: "required", email: "exists" }), 0);
  assert.equal(stepForErrors({ email: "exists" }), 1);
  assert.equal(stepForErrors({ postcode: "long", form: "server" }), 1);
  assert.equal(stepForErrors({ form: "server" }), 2);
});

test("error keys the app has no field for become the generic server message on the last step", () => {
  const shown = visibleErrors({ venueType: "required", m2: "required" });
  assert.deepEqual(shown, { form: "server" });
  assert.equal(stepForErrors(shown), 2);
});

test("a known field error survives next to an unknown one, and an existing form error is kept", () => {
  assert.deepEqual(visibleErrors({ email: "exists", venueType: "required" }), { email: "exists", form: "server" });
  assert.deepEqual(visibleErrors({ form: "invalid", mystery: "x" }), { form: "invalid" });
  assert.deepEqual(visibleErrors({ name: "required" }), { name: "required" });
});

test("every error resolves to a message the app has, never a raw code", () => {
  assert.equal(errorKey("name", "required"), "required");
  assert.equal(errorKey("email", "exists"), "exists");
  assert.equal(errorKey("plan", "required"), "plan");
  assert.equal(errorKey("locations", "required"), "locations");
  assert.equal(errorKey("form", "server"), "server");
  assert.equal(errorKey("form", "invalid"), "server");
  assert.equal(errorKey("name", "something-new"), "server");
});
```

Create `mobile/test/api-response.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd mobile && npm test 2>&1 | tail -10
```

Expected: both new files fail with `Cannot find module`.

- [ ] **Step 3: Write `mobile/src/auth/signup-form.ts`**

```ts
/* The signup form's rules, pure so they run under `node --test`. The
   server (lib/signup.ts's buildSignup) is the judge that counts; these
   are the same rules applied early, so a customer hears about a missing
   field on the step that has it rather than after pressing the last
   button. Keep the limits in step with buildSignup. */

import { normalizeEmail } from "./errors.ts";

export type SignupDraft = {
  planId: string;
  billing: "monthly" | "annual";
  locations: number;
  name: string;
  company: string;
  cvr: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  city: string;
  ean: string;
  po: string;
  terms: boolean;
};

export const EMPTY_DRAFT: SignupDraft = {
  planId: "small",
  billing: "monthly",
  locations: 1,
  name: "",
  company: "",
  cvr: "",
  email: "",
  phone: "",
  address: "",
  postcode: "",
  city: "",
  ean: "",
  po: "",
  terms: false,
};

export type FieldErrors = Record<string, string>;

/** The stepper's own range, the same as the website's. */
export const MIN_LOCATIONS = 1;
export const MAX_LOCATIONS = 99;

/* buildSignup's caps (lib/signup.ts). */
const MAX_TEXT = 200;
const MAX_EMAIL = 254;
const MAX_OPTIONAL = 300;

/** lib/forms.ts's EMAIL_RE, copied: that file's other exports are web
    form types this module has no use for. */
const EMAIL_RE = /^[^\s@*]+@[^\s@*]+\.[^\s@*]{2,}$/;

const digits = (value: string) => value.replace(/\D/g, "");

function required(value: string, max: number): string | null {
  const v = value.trim();
  if (!v) return "required";
  return v.length > max ? "long" : null;
}

export function validatePlan(d: SignupDraft): FieldErrors {
  const e: FieldErrors = {};
  if (!d.planId) e.plan = "required";
  if (!Number.isInteger(d.locations) || d.locations < MIN_LOCATIONS || d.locations > MAX_LOCATIONS) {
    e.locations = "required";
  }
  return e;
}

export function validateAccount(d: SignupDraft): FieldErrors {
  const e: FieldErrors = {};
  const put = (field: string, code: string | null) => {
    if (code) e[field] = code;
  };

  put("name", required(d.name, MAX_TEXT));
  put("company", required(d.company, MAX_TEXT));
  if (d.cvr.trim() && digits(d.cvr).length !== 8) e.cvr = "cvr";

  const email = normalizeEmail(d.email);
  if (email.length > MAX_EMAIL) e.email = "long";
  else if (!EMAIL_RE.test(email)) e.email = "email";

  if (d.phone.trim().length > MAX_OPTIONAL) e.phone = "long";
  /* Optional on the server, required by the website's own form — an
     invoice needs somewhere to be addressed to. */
  put("address", required(d.address, MAX_OPTIONAL));
  put("postcode", required(d.postcode, MAX_OPTIONAL));
  put("city", required(d.city, MAX_OPTIONAL));
  return e;
}

export function validatePayment(d: SignupDraft): FieldErrors {
  const e: FieldErrors = {};
  if (d.ean.trim() && digits(d.ean).length !== 13) e.ean = "ean";
  if (d.po.trim().length > MAX_OPTIONAL) e.po = "long";
  if (!d.terms) e.terms = "terms";
  return e;
}

/** The body of POST /api/app/signup. `terms` is not sent: it is a
    promise the customer makes on this screen, not a field the server
    stores. */
export function toPayload(d: SignupDraft): Record<string, string | number> {
  return {
    name: d.name.trim(),
    company: d.company.trim(),
    email: normalizeEmail(d.email),
    cvr: digits(d.cvr),
    phone: d.phone.trim(),
    address: d.address.trim(),
    postcode: d.postcode.trim(),
    city: d.city.trim(),
    planId: d.planId,
    billing: d.billing,
    locations: d.locations,
    ean: digits(d.ean),
    po: d.po.trim(),
  };
}

/** Which step shows which field's error. `plan` is the key buildSignup
    uses for the plan; `form` is a message about the whole order. */
const STEP_FIELDS: readonly (readonly string[])[] = [
  ["plan", "billing", "locations"],
  ["name", "company", "cvr", "email", "phone", "address", "postcode", "city"],
  ["ean", "po", "terms", "form"],
];
const KNOWN_FIELDS = new Set(STEP_FIELDS.flat());

/** The server can name a field this screen does not have — `venueType`
    and `m2` until the website's simpler signup is deployed, or whatever a
    later version adds. An error nobody can see is a form that silently
    does nothing, so those collapse into one generic message. */
export function visibleErrors(errors: FieldErrors): FieldErrors {
  const shown: FieldErrors = {};
  let unknown = false;
  for (const [field, code] of Object.entries(errors)) {
    if (KNOWN_FIELDS.has(field)) shown[field] = code;
    else unknown = true;
  }
  if (unknown && !shown.form) shown.form = "server";
  return shown;
}

/** The earliest step with something to fix; the last step if the only
    news is about the order as a whole. */
export function stepForErrors(errors: FieldErrors): number {
  const at = STEP_FIELDS.findIndex((fields) => fields.some((f) => f in errors));
  return at === -1 ? STEP_FIELDS.length - 1 : at;
}

export type ErrorKey =
  | "required"
  | "long"
  | "email"
  | "cvr"
  | "ean"
  | "terms"
  | "exists"
  | "server"
  | "plan"
  | "locations";

const CODES: readonly string[] = ["required", "long", "email", "cvr", "ean", "terms", "exists", "server"];

/** Which sentence to show. The plan and the location count have no text
    field, so "Required" under them would make no sense — they get their
    own wording. A code this build has never heard of gets the generic
    one, never the raw word. */
export function errorKey(field: string, code: string): ErrorKey {
  if (field === "plan") return "plan";
  if (field === "locations") return "locations";
  return CODES.includes(code) ? (code as ErrorKey) : "server";
}
```

- [ ] **Step 4: Write `mobile/src/auth/api-response.ts`**

```ts
/* What POST /api/app/signup answered, read defensively. Pure, so the
   odd cases — an HTML error page, an empty body — are tested without a
   network. */

export type SignupResult =
  | { kind: "ok"; invited: boolean }
  | { kind: "errors"; errors: Record<string, string> }
  | { kind: "unreachable" };

const UNREACHABLE: SignupResult = { kind: "unreachable" };

export function readSignupResponse(status: number, body: string): SignupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* Not JSON at all: the route is not deployed (a 404 page), or
       something in front of it answered instead. */
    return UNREACHABLE;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return UNREACHABLE;

  const { ok, message, errors } = parsed as Record<string, unknown>;

  if (ok === true) {
    if (status !== 200) return UNREACHABLE;
    /* "no-invite": the account was created but the email could not be
       sent (submitSignup, app/actions.ts). */
    return { kind: "ok", invited: message !== "no-invite" };
  }

  if (ok === false && typeof errors === "object" && errors !== null) {
    const clean: Record<string, string> = {};
    for (const [field, code] of Object.entries(errors)) {
      if (typeof code === "string") clean[field] = code;
    }
    return Object.keys(clean).length > 0 ? { kind: "errors", errors: clean } : UNREACHABLE;
  }

  return UNREACHABLE;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `pass 43`, `fail 0`.

- [ ] **Step 6: Write `mobile/src/auth/api.ts`**

```ts
import { readSignupResponse, type SignupResult } from "./api-response.ts";
import { API_URL } from "./supabase";

/** Long enough for a cold serverless start plus the invite email; short
    enough that a dead connection does not leave the button spinning. */
const TIMEOUT_MS = 20_000;

/** Places the order. Never throws: every way this can fail to get an
    answer comes back as `unreachable`. */
export async function postSignup(payload: Record<string, string | number>): Promise<SignupResult> {
  if (!API_URL) return { kind: "unreachable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/app/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return readSignupResponse(res.status, await res.text());
  } catch {
    return { kind: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 7: Write `mobile/src/data/plans.ts`**

```ts
import { PLANS, type Plan } from "@web/pricing";
import { rowToPlan, type PlanRow } from "@web/plans-row";
import { useEffect, useState } from "react";

import { configured, supabase } from "../auth/supabase";

/** The plans on sale, with the prices staff last set in /admin/products.
    Starts from the compiled defaults and swaps in the database's rows
    when they arrive — the same fallback the website's activePlans()
    makes (lib/plans-server.ts), and the same query: active plans, in
    their `sort` order, readable by anyone (plans_public_read). */
export function usePlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(PLANS);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    Promise.resolve(
      supabase
        .from("plans")
        .select("id, name, monthly_ore, max_m2, tagline, features")
        .eq("active", true)
        .order("sort", { ascending: true }),
    )
      .then(({ data, error }) => {
        if (alive && !error && data && data.length > 0) setPlans((data as PlanRow[]).map(rowToPlan));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return plans;
}
```

- [ ] **Step 8: Add `kr` to `mobile/src/lib/format.ts`**

Add at the end of the file (and add `Locale` to the file's existing type import from `../types` if it is not already imported):

```ts
/** "1.234,5 kr." in Danish, "1,234.5 kr." in English. */
export function kr(amount: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", { maximumFractionDigits: 2 }).format(amount);
  return `${formatted} kr.`;
}
```

- [ ] **Step 9: Add the strings**

Add directly above the `"common.min"` line in `mobile/src/i18n/strings.ts`:

```ts
  "account.create": { da: "Opret konto", en: "Create account" },

  "signup.title": { da: "Opret konto", en: "Create account" },
  "signup.step.plan": { da: "Plan", en: "Plan" },
  "signup.step.account": { da: "Konto", en: "Account" },
  "signup.step.payment": { da: "Betaling", en: "Payment" },
  "signup.next": { da: "Næste", en: "Next" },
  "signup.back": { da: "Tilbage", en: "Back" },
  "signup.haveAccount": { da: "Har du allerede en konto? Log ind", en: "Already have an account? Log in" },
  "signup.optional": { da: "valgfri", en: "optional" },

  "signup.plan.heading": { da: "Vælg din plan", en: "Choose your plan" },
  "signup.plan.body": {
    da: "Alle planer starter med 14 dage gratis, og du kan skifte når som helst.",
    en: "Every plan starts with 14 days free and you can switch whenever.",
  },
  "signup.billing.monthly": { da: "Måned", en: "Monthly" },
  "signup.billing.annual": { da: "År", en: "Annual" },
  "signup.locations": { da: "Lokationer", en: "Locations" },
  "signup.perLocation": { da: "Pr. lokation", en: "Per location" },
  "signup.perMonth": { da: "pr. md.", en: "per month" },
  "signup.perYear": { da: "pr. år", en: "per year" },
  "signup.volumeDiscount": { da: "Mængderabat", en: "Volume discount" },
  "signup.annualDiscount": { da: "Årsrabat", en: "Annual discount" },
  "signup.dueToday": { da: "Betales i dag", en: "Due today" },
  "signup.freeTrial": { da: "0 kr. — 14 dage gratis", en: "0 kr. — 14 days free" },
  "signup.then": { da: "Derefter", en: "Then" },
  "signup.exVat": { da: "ekskl. moms", en: "excl. VAT" },

  "signup.account.heading": { da: "Din konto", en: "Your account" },
  "signup.account.body": {
    da: "Kun det vi skal bruge for at oprette abonnementet og sende dig dokumentationen.",
    en: "Only what we need to set up the subscription and send you the documentation.",
  },
  "signup.field.name": { da: "Fulde navn", en: "Full name" },
  "signup.field.company": { da: "Virksomhed", en: "Company" },
  "signup.field.cvr": { da: "CVR-nummer", en: "Company reg. no." },
  "signup.field.email": { da: "Arbejds-e-mail", en: "Work email" },
  "signup.field.phone": { da: "Telefon", en: "Phone" },
  "signup.field.address": { da: "Adresse på lokationen", en: "Address of the location" },
  "signup.field.postcode": { da: "Postnr.", en: "Postcode" },
  "signup.field.city": { da: "By", en: "City" },

  "signup.payment.heading": { da: "Betaling", en: "Payment" },
  "signup.payment.body": {
    da: "Vi trækker ingenting nu. De første 14 dage er gratis, og derefter sender vi en faktura.",
    en: "Nothing is charged now. The first 14 days are free, and after that we send an invoice.",
  },
  "signup.field.ean": { da: "EAN-nummer", en: "EAN number" },
  "signup.field.po": { da: "Rekvisitionsnummer", en: "Purchase order" },
  "signup.terms": {
    da: "Jeg accepterer handelsbetingelserne og privatlivspolitikken.",
    en: "I accept the terms of business and the privacy policy.",
  },
  "signup.termsRead": { da: "Læs dem", en: "Read them" },
  "signup.submit": { da: "Start prøveperioden", en: "Start the trial" },

  "signup.error.required": { da: "Skal udfyldes", en: "Required" },
  "signup.error.long": { da: "For langt", en: "Too long" },
  "signup.error.email": { da: "Ugyldig e-mail", en: "Invalid email" },
  "signup.error.cvr": { da: "8 cifre", en: "8 digits" },
  "signup.error.ean": { da: "13 cifre", en: "13 digits" },
  "signup.error.terms": { da: "Du skal acceptere betingelserne", en: "You must accept the terms" },
  "signup.error.exists": {
    da: "Der findes allerede en konto med denne e-mail.",
    en: "An account with this email already exists.",
  },
  "signup.error.server": {
    da: "Der opstod en fejl. Prøv igen om lidt, eller kontakt os hvis det gentager sig.",
    en: "Something went wrong. Please try again shortly, or contact us if it keeps happening.",
  },
  "signup.error.plan": {
    da: "Den valgte plan er ikke gyldig. Vælg en plan igen.",
    en: "The selected plan isn't valid. Choose a plan again.",
  },
  "signup.error.locations": {
    da: "Antallet af lokationer er ikke gyldigt.",
    en: "The number of locations isn't valid.",
  },
  "signup.unreachable": {
    da: "Vi kunne ikke få forbindelse til Odatone. Intet er gået tabt — prøv igen.",
    en: "Couldn't reach Odatone. Nothing is lost — try again.",
  },
  "signup.exists.reset": { da: "Nulstil adgangskode", en: "Reset password" },
  "signup.noInvite.title": { da: "Kontoen er oprettet", en: "Your account is set up" },
  "signup.noInvite.body": {
    da: "Din konto til {email} er oprettet, men vi kunne ikke sende e-mailen med koden lige nu. Kontakt os, så sender vi den manuelt.",
    en: "Your account for {email} is set up, but we couldn't send the email with the code just now. Contact us and we'll send it by hand.",
  },
```

- [ ] **Step 10: Write `mobile/app/auth/signup.tsx`**

```tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { ANNUAL_DISCOUNT_PCT, quote, type Plan } from "@web/pricing";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { postSignup } from "../../src/auth/api";
import { normalizeEmail } from "../../src/auth/errors.ts";
import {
  EMPTY_DRAFT,
  MAX_LOCATIONS,
  MIN_LOCATIONS,
  errorKey,
  stepForErrors,
  toPayload,
  validateAccount,
  validatePayment,
  validatePlan,
  visibleErrors,
  type FieldErrors,
  type SignupDraft,
} from "../../src/auth/signup-form.ts";
import { API_URL } from "../../src/auth/supabase";
import { AuthScreen, Notice, closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Field } from "../../src/components/Field";
import { Txt } from "../../src/components/Txt";
import { usePlans } from "../../src/data/plans";
import { useI18n } from "../../src/i18n/i18n";
import { kr } from "../../src/lib/format";
import { useTheme } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";

const STEPS = ["signup.step.plan", "signup.step.account", "signup.step.payment"] as const;

/** The website's order, in three steps: plan, account, payment. The
    order itself is placed by the website (POST /api/app/signup), which
    runs the same code as its own form. */
export default function SignupScreen() {
  const { c } = useTheme();
  const { t, l, locale } = useI18n();
  const router = useRouter();
  const plans = usePlans();

  const [draft, setDraft] = useState<SignupDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [noInvite, setNoInvite] = useState(false);

  const set = <K extends keyof SignupDraft>(key: K, value: SignupDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const message = (field: string) =>
    errors[field] ? t(`signup.error.${errorKey(field, errors[field])}`) : undefined;

  /* The database can stop selling a plan the draft started on; fall back
     to the first one on offer rather than pricing a plan that is gone. */
  const selected: Plan = plans.find((p) => p.id === draft.planId) ?? plans[0];
  const q = quote(selected, draft.billing, draft.locations);

  const next = () => {
    const found = step === 0 ? validatePlan({ ...draft, planId: selected.id }) : validateAccount(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(step + 1);
  };

  const submit = async () => {
    if (busy) return;
    const found = validatePayment(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setUnreachable(false);
    const result = await postSignup(toPayload({ ...draft, planId: selected.id }));
    setBusy(false);

    if (result.kind === "unreachable") {
      setUnreachable(true);
      return;
    }
    if (result.kind === "errors") {
      const shown = visibleErrors(result.errors);
      setErrors(shown);
      setStep(stepForErrors(shown));
      return;
    }
    if (!result.invited) {
      setNoInvite(true);
      return;
    }
    router.replace({ pathname: "/auth/verify", params: { email: normalizeEmail(draft.email), kind: "invite" } });
  };

  if (noInvite) {
    return (
      <AuthScreen
        title={t("signup.noInvite.title")}
        body={t("signup.noInvite.body").replace("{email}", normalizeEmail(draft.email))}
      >
        <Button label={t("auth.close")} onPress={() => closeAuth(router)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={t("signup.title")}>
      <Txt variant="label" tone="ink3">
        {step + 1} / {STEPS.length} · {t(STEPS[step])}
      </Txt>

      {step === 0 && (
        <>
          <Txt variant="section">{t("signup.plan.heading")}</Txt>
          <Txt variant="body" tone="ink2">{t("signup.plan.body")}</Txt>

          {plans.map((p) => {
            const active = p.id === selected.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => set("planId", p.id)}
                style={{
                  padding: SPACE.md,
                  borderRadius: RADIUS.lg,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? c.accent : c.line,
                  backgroundColor: c.surface,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Txt variant="bodyStrong">{p.name}</Txt>
                  <Txt variant="num">{kr(p.monthly, locale)}</Txt>
                </View>
                <Txt variant="small" tone="ink2">{l(p.tagline)}</Txt>
              </Pressable>
            );
          })}
          {message("plan") ? <Txt variant="label" tone="warn">{message("plan")}</Txt> : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              label={t("signup.billing.monthly")}
              active={draft.billing === "monthly"}
              onPress={() => set("billing", "monthly")}
            />
            <Chip
              label={`${t("signup.billing.annual")} −${ANNUAL_DISCOUNT_PCT}%`}
              active={draft.billing === "annual"}
              onPress={() => set("billing", "annual")}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt variant="bodyStrong">{t("signup.locations")}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="−"
                hitSlop={10}
                disabled={draft.locations <= MIN_LOCATIONS}
                onPress={() => set("locations", Math.max(MIN_LOCATIONS, draft.locations - 1))}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={30}
                  color={draft.locations <= MIN_LOCATIONS ? c.ink3 : c.ink}
                />
              </Pressable>
              <Txt variant="title" style={{ minWidth: 36, textAlign: "center" }}>{draft.locations}</Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="+"
                hitSlop={10}
                disabled={draft.locations >= MAX_LOCATIONS}
                onPress={() => set("locations", Math.min(MAX_LOCATIONS, draft.locations + 1))}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={30}
                  color={draft.locations >= MAX_LOCATIONS ? c.ink3 : c.ink}
                />
              </Pressable>
            </View>
          </View>
          {message("locations") ? <Txt variant="label" tone="warn">{message("locations")}</Txt> : null}

          <View
            style={{
              padding: SPACE.md,
              borderRadius: RADIUS.lg,
              backgroundColor: c.surface2,
              gap: 8,
            }}
          >
            <Row label={t("signup.perLocation")} value={`${kr(q.perLocation, locale)} ${t("signup.perMonth")}`} />
            {q.volumeDiscountPct > 0 ? (
              <Row label={t("signup.volumeDiscount")} value={`−${q.volumeDiscountPct}%`} />
            ) : null}
            {q.annualDiscountPct > 0 ? (
              <Row label={t("signup.annualDiscount")} value={`−${q.annualDiscountPct}%`} />
            ) : null}
            <Row label={t("signup.dueToday")} value={t("signup.freeTrial")} strong />
            <Row
              label={t("signup.then")}
              value={`${kr(q.chargeExVat, locale)} ${t(draft.billing === "annual" ? "signup.perYear" : "signup.perMonth")}`}
            />
            <Txt variant="label" tone="ink3" style={{ textAlign: "right" }}>{t("signup.exVat")}</Txt>
          </View>
        </>
      )}

      {step === 1 && (
        <>
          <Txt variant="section">{t("signup.account.heading")}</Txt>
          <Txt variant="body" tone="ink2">{t("signup.account.body")}</Txt>

          {errors.email === "exists" ? (
            <View style={{ gap: 10 }}>
              <Notice text={t("signup.error.exists")} />
              <Button variant="secondary" label={t("account.logIn")} onPress={() => router.replace("/auth/login")} />
              <Button variant="link" label={t("signup.exists.reset")} onPress={() => router.replace("/auth/forgot")} />
            </View>
          ) : null}

          <Field
            label={t("signup.field.name")}
            value={draft.name}
            onChangeText={(v) => set("name", v)}
            error={message("name")}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
          />
          <Field
            label={t("signup.field.company")}
            value={draft.company}
            onChangeText={(v) => set("company", v)}
            error={message("company")}
            autoComplete="organization"
            textContentType="organizationName"
          />
          <Field
            label={t("signup.field.cvr")}
            hint={t("signup.optional")}
            value={draft.cvr}
            onChangeText={(v) => set("cvr", v)}
            error={message("cvr")}
            keyboardType="number-pad"
          />
          <Field
            label={t("signup.field.email")}
            value={draft.email}
            onChangeText={(v) => set("email", v)}
            error={errors.email === "exists" ? undefined : message("email")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Field
            label={t("signup.field.phone")}
            hint={t("signup.optional")}
            value={draft.phone}
            onChangeText={(v) => set("phone", v)}
            error={message("phone")}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Field
            label={t("signup.field.address")}
            value={draft.address}
            onChangeText={(v) => set("address", v)}
            error={message("address")}
            autoComplete="street-address"
            textContentType="streetAddressLine1"
          />
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                label={t("signup.field.postcode")}
                value={draft.postcode}
                onChangeText={(v) => set("postcode", v)}
                error={message("postcode")}
                keyboardType="number-pad"
                autoComplete="postal-code"
                textContentType="postalCode"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Field
                label={t("signup.field.city")}
                value={draft.city}
                onChangeText={(v) => set("city", v)}
                error={message("city")}
                textContentType="addressCity"
              />
            </View>
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <Txt variant="section">{t("signup.payment.heading")}</Txt>
          <Txt variant="body" tone="ink2">{t("signup.payment.body")}</Txt>

          {unreachable ? <Notice text={t("signup.unreachable")} /> : null}
          {errors.form ? <Notice text={t(`signup.error.${errorKey("form", errors.form)}`)} /> : null}

          <Field
            label={t("signup.field.ean")}
            hint={t("signup.optional")}
            value={draft.ean}
            onChangeText={(v) => set("ean", v)}
            error={message("ean")}
            keyboardType="number-pad"
          />
          <Field
            label={t("signup.field.po")}
            hint={t("signup.optional")}
            value={draft.po}
            onChangeText={(v) => set("po", v)}
            error={message("po")}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.terms }}
            onPress={() => set("terms", !draft.terms)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
          >
            <Ionicons
              name={draft.terms ? "checkbox" : "square-outline"}
              size={24}
              color={draft.terms ? c.accent : c.ink3}
            />
            <Txt variant="body" tone="ink2" style={{ flex: 1 }}>{t("signup.terms")}</Txt>
          </Pressable>
          {message("terms") ? <Txt variant="label" tone="warn">{message("terms")}</Txt> : null}
          <Button
            variant="link"
            label={t("signup.termsRead")}
            onPress={() =>
              Linking.openURL(`${API_URL}/${locale}/${locale === "da" ? "betingelser" : "terms"}`).catch(() => {})
            }
          />
        </>
      )}

      <View style={{ gap: 10, marginTop: SPACE.sm }}>
        {step < 2 ? (
          <Button label={t("signup.next")} onPress={next} />
        ) : (
          <Button label={t("signup.submit")} onPress={submit} busy={busy} />
        )}
        {step > 0 ? (
          <Button variant="secondary" label={t("signup.back")} onPress={() => setStep(step - 1)} disabled={busy} />
        ) : (
          <Button variant="link" label={t("signup.haveAccount")} onPress={() => router.replace("/auth/login")} />
        )}
      </View>
    </AuthScreen>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.md }}>
      <Txt variant="body" tone="ink2">{label}</Txt>
      <Txt variant={strong ? "bodyStrong" : "body"} style={{ flexShrink: 1, textAlign: "right" }}>{value}</Txt>
    </View>
  );
}
```

- [ ] **Step 11: Wire the screen in**

In `mobile/app/_layout.tsx`, add with the other auth screens:

```tsx
        <Stack.Screen name="auth/signup" options={AUTH_MODAL} />
```

In `mobile/app/auth/login.tsx`, add as the last child of `<AuthScreen>`:

```tsx
      <Button variant="secondary" label={t("account.create")} onPress={() => router.replace("/auth/signup")} />
```

In `mobile/app/(tabs)/account.tsx`, in `AccountCard`'s signed-out branch, add under the "Log in" button:

```tsx
          <Button variant="secondary" label={t("account.create")} onPress={() => router.push("/auth/signup")} />
```

- [ ] **Step 12: Verify**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npm run -s typecheck && echo APP_TSC_OK
(npx expo start --port 8090 < /dev/null > /tmp/odatone-metro.log 2>&1 &) ; sleep 20
curl -s "http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true" > /tmp/odatone-bundle.js
grep -c "signup.plan.heading" /tmp/odatone-bundle.js
grep -c "toKroner" /tmp/odatone-bundle.js
grep -ci "error" /tmp/odatone-metro.log
pkill -f "expo start --port 8090"
```

Expected: `pass 43`, `fail 0`; `APP_TSC_OK`; both counts `1` or more (the second proves `@web/plans-row` and its `money.ts` import bundled); `0` errors.

Then check the app against the deployed website. On `main` the endpoint does not exist yet in production, so this exercises exactly the "not deployed" path:

```bash
node -e '
fetch("https://odatone.studio74.io/api/app/signup", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
  .then(async (r) => console.log(r.status, (await r.text()).slice(0, 80)))
'
```

Expected before the website is deployed: `404` and the start of an HTML page — which `readSignupResponse` turns into `unreachable`. After deployment: `200 {"ok":false,"errors":{…}}`.

- [ ] **Step 13: Look at the three steps**

As in Task 6 Step 11, open `exp://127.0.0.1:8090/--/auth/signup` in the simulator and screenshot it. Expected on step 1: three plan cards with prices, the billing chips, the location stepper and the summary box, with nothing clipped. Steps 2 and 3 need taps, which the terminal cannot do; they are covered by the end-to-end run in Task 9. If the simulator cannot be driven, say so.

- [ ] **Step 14: Commit**

```bash
cd ..
git add mobile/src/auth/signup-form.ts mobile/src/auth/api-response.ts mobile/src/auth/api.ts mobile/src/data/plans.ts mobile/src/lib/format.ts mobile/app/auth/signup.tsx mobile/app/auth/login.tsx mobile/app/_layout.tsx "mobile/app/(tabs)/account.tsx" mobile/src/i18n/strings.ts mobile/test/signup-form.test.ts mobile/test/api-response.test.ts
git commit -m "Add Create account to the app: plan, account, payment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Only an entitled customer can play

**Files:**
- Modify: `mobile/src/audio/PlayerProvider.tsx`
- Create: `mobile/app/auth/gate.tsx`
- Modify: `mobile/app/_layout.tsx`, `mobile/src/i18n/strings.ts`

**Interfaces:**
- Consumes: `useAuth()` → `{ ready, entitled, signedIn, refresh }` (Task 5); `gateFor(signedIn): "login" | "ended"` (Task 4); `Button`, `closeAuth` (Task 6); routes `/auth/login`, `/auth/signup` (Tasks 6, 7).
- Produces: route `/auth/gate?kind=login|ended`. `usePlayer()`'s shape does not change.

- [ ] **Step 1: Add the strings**

Add directly above the `"common.min"` line in `mobile/src/i18n/strings.ts`:

```ts
  "gate.login.title": { da: "Log ind for at spille", en: "Log in to play" },
  "gate.login.body": {
    da: "Musikken er for Odatone-kunder. Log ind, eller opret en konto — de første 14 dage er gratis.",
    en: "The music is for Odatone customers. Log in, or create an account — the first 14 days are free.",
  },
  "gate.ended.title": { da: "Dit abonnement er ikke aktivt", en: "Your subscription isn't active" },
  "gate.ended.body": {
    da: "Denne konto har ikke et aktivt abonnement. Administrér det på Mit Odatone, eller kontakt os.",
    en: "This account has no active subscription. Manage it on My Odatone, or contact us.",
  },
  "gate.ended.retry": { da: "Tjek igen", en: "Check again" },
```

- [ ] **Step 2: Gate the player**

In `mobile/src/audio/PlayerProvider.tsx`:

Add imports:

```tsx
import { router } from "expo-router";

import { useAuth } from "../auth/AuthProvider";
import { gateFor } from "../auth/entitlement.ts";
```

Inside `PlayerProvider`, directly after the `repeatRef.current = repeat;` line, add:

```tsx
  /* Refs, not state in the callbacks' dependency lists: every play
     control would otherwise be rebuilt each time the account refreshes. */
  const { ready, entitled, signedIn } = useAuth();
  const readyRef = useRef(ready);
  const entitledRef = useRef(entitled);
  const signedInRef = useRef(signedIn);
  readyRef.current = ready;
  entitledRef.current = entitled;
  signedInRef.current = signedIn;
  const lastGate = useRef(0);

  /** May playback start? If not, says why — once, however many times
      the button is tapped. Pausing never asks. */
  const guard = useCallback(() => {
    if (entitledRef.current) return true;
    /* The stored session has not been read yet. Telling someone who is
       logged in to log in, because they tapped in the first half-second,
       would be wrong; doing nothing for that half-second is not. */
    if (!readyRef.current) return false;
    const now = Date.now();
    if (now - lastGate.current > 1000) {
      lastGate.current = now;
      router.push({ pathname: "/auth/gate", params: { kind: gateFor(signedInRef.current) } });
    }
    return false;
  }, []);
```

Then call it in the five places playback can start.

In `playTrack`, change:

```tsx
    (next: Track, nextQueue?: Track[], nextSource?: string) => {
      const q = nextQueue?.length ? nextQueue : queueRef.current;
```

to:

```tsx
    (next: Track, nextQueue?: Track[], nextSource?: string) => {
      if (!guard()) return;
      const q = nextQueue?.length ? nextQueue : queueRef.current;
```

and its dependency list from `[player]` to `[guard, player]`.

In `playList`, change `if (!list.length) return;` to `if (!list.length || !guard()) return;` and its dependency list from `[]` to `[guard]`.

In `toggle`, change:

```tsx
    } else {
      wantsPlay.current = true;
      player.play();
```

to:

```tsx
    } else {
      if (!guard()) return;
      wantsPlay.current = true;
      player.play();
```

and its dependency list from `[playList, player, track]` to `[guard, playList, player, track]`.

In `next`, change `if (!q.length) return;` to `if (!q.length || !guard()) return;` and its dependency list from `[]` to `[guard]`.

In `previous`, add `if (!guard()) return;` as the first line of the callback and change its dependency list from `[player]` to `[guard, player]`.

Finally, directly after the `/* ---- advance at the end of a track ---- */` effect, add:

```tsx
  /* ---- entitlement lost while playing: a subscription cancelled in
         /admin, found out when the app came back to the foreground ---- */
  useEffect(() => {
    if (entitled) return;
    wantsPlay.current = false;
    player.pause();
  }, [entitled, player]);

  /* ---- signed out: the next person at this phone starts from nothing,
         not from the last customer's queue ---- */
  useEffect(() => {
    if (signedIn) return;
    setIndex(-1);
    setSource(null);
    setQueue(TRACKS);
    setShuffle(false);
    try {
      player.setActiveForLockScreen(false);
    } catch {
      /* lock-screen controls need a dev build; nothing to clear in Expo Go */
    }
  }, [signedIn, player]);
```

- [ ] **Step 3: Write `mobile/app/auth/gate.tsx`**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth/AuthProvider";
import { API_URL } from "../../src/auth/supabase";
import { closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Txt } from "../../src/components/Txt";
import { useI18n } from "../../src/i18n/i18n";
import { useTheme } from "../../src/theme/theme";
import { SPACE } from "../../src/theme/tokens";

/** What pressing play shows someone who may not play: a way in for a
    visitor, or the state of things for a customer whose subscription is
    not live. A route rather than a view over the app, so it also shows
    above the Now Playing modal. */
export default function GateScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [checking, setChecking] = useState(false);

  const ended = kind === "ended";

  /* "Not active" is also what a customer sees when their phone was
     offline for longer than the offline allowance. Asking again is the
     fix for that, so it is a button and not advice. */
  const retry = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
    closeAuth(router);
  };

  return (
    /* No flex: 1 — a form sheet sizes to its detent, and a flexed child
       inside one collapses on Android. */
    <View
      style={{
        backgroundColor: c.bg,
        paddingTop: SPACE.xl,
        paddingHorizontal: SPACE.lg,
        paddingBottom: insets.bottom + SPACE.lg,
        gap: SPACE.md,
      }}
    >
      <Txt variant="title">{t(ended ? "gate.ended.title" : "gate.login.title")}</Txt>
      <Txt variant="body" tone="ink2">{t(ended ? "gate.ended.body" : "gate.login.body")}</Txt>

      {ended ? (
        <View style={{ gap: 10 }}>
          <Button label={t("gate.ended.retry")} onPress={retry} busy={checking} />
          <Button
            variant="secondary"
            label={t("account.manage")}
            onPress={() => Linking.openURL(`${API_URL}/my-odatone`).catch(() => {})}
          />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button label={t("account.logIn")} onPress={() => router.replace("/auth/login")} />
          <Button variant="secondary" label={t("account.create")} onPress={() => router.replace("/auth/signup")} />
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Register the sheet**

In `mobile/app/_layout.tsx`, add with the other auth screens:

```tsx
        <Stack.Screen
          name="auth/gate"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.45],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
```

If Step 6's screenshot shows the sheet blank or covering the whole screen, replace these options with `AUTH_MODAL` and wrap the gate's content `View` in `style={{ flex: 1, ... }}`; note the change in the task report.

- [ ] **Step 5: Verify the build**

```bash
cd mobile
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npm run -s typecheck && echo APP_TSC_OK
grep -c "guard()" src/audio/PlayerProvider.tsx
(npx expo start --port 8090 < /dev/null > /tmp/odatone-metro.log 2>&1 &) ; sleep 20
curl -s -o /dev/null -w 'bundle %{http_code}\n' "http://localhost:8090/node_modules/expo-router/entry.bundle?platform=ios&dev=true"
grep -ci "error" /tmp/odatone-metro.log
pkill -f "expo start --port 8090"
```

Expected: `pass 43`, `fail 0`; `APP_TSC_OK`; `5` (one `guard()` call in each of `playTrack`, `playList`, `toggle`, `next`, `previous`); `bundle 200`; `0` errors.

- [ ] **Step 6: Look at both sheets**

As in Task 6 Step 11, open and screenshot `exp://127.0.0.1:8090/--/auth/gate?kind=login` and `exp://127.0.0.1:8090/--/auth/gate?kind=ended`. Expected: a sheet covering roughly the lower half, with the title, the body and two buttons each. If the simulator cannot be driven, say so.

- [ ] **Step 7: Commit**

```bash
cd ..
git add mobile/src/audio/PlayerProvider.tsx mobile/app/auth/gate.tsx mobile/app/_layout.tsx mobile/src/i18n/strings.ts
git commit -m "Let only an entitled customer start playback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentation and the end-to-end run

**Files:**
- Modify: `mobile/README.md`
- Modify: `README.md` (root)

- [ ] **Step 1: Update `mobile/README.md`**

Replace the paragraph that begins `**Account.**` with:

```markdown
**Account.** Log in, create an account, reset a password, log out. Playback
is for customers: a signed-in account whose subscription is `pending`,
`trialing`, `active` or `past_due` (or a staff account) can play; anyone
can browse. The rule is `src/auth/entitlement.ts`, and
`src/auth/AuthProvider.tsx` holds the session.

Signing up places the same order as the website's form, through
`POST /api/app/signup` on the website. Login, the emailed 6-digit codes
and reading the customer's own subscription go straight to Supabase with
the public anon key; row-level security decides what is visible.

A phone that cannot reach the server keeps playing on its last known
answer for 7 days.
```

Add a section before `## Structure`:

```markdown
## Configuration

Copy `.env.example` to `.env` and fill in the three values. The Supabase
URL and anon key are the website's public ones (`NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the repository root's `.env.local`);
`EXPO_PUBLIC_API_URL` is the website's address with no trailing slash.
Restart `npm start` after changing `.env`.

The signup email must print a 6-digit code. See
`../docs/supabase-email-templates.md` for the dashboard step.

## Tests

`npm test` runs the pure modules under `node --test`: who may play, how
auth errors are worded, the signup form's rules, and how the signup
endpoint's answer is read.

## Known limits

- The Account tab shows "not set up" for a moment while the account is
  first loading, and while offline.
- EAN and purchase-order numbers are collected but not stored; the
  website's form has the same gap.
- There is no in-app purchase. Ordering a subscription in the app without
  one may not pass App Store review.
```

- [ ] **Step 2: Update the root `README.md`**

In the `## The signup flow` section, add this paragraph at the end of the section:

```markdown
The mobile app places the same order through `POST /api/app/signup`
(`app/api/app/signup/route.ts`), which turns the app's JSON into the
`FormData` `submitSignup` takes and calls it unchanged. The app cannot
follow the invite link, so the invite and recovery emails also print a
6-digit code; see `docs/supabase-email-templates.md`.
```

- [ ] **Step 3: Run everything once more**

```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
npx tsc --noEmit -p . && echo WEB_TSC_OK
(cd mobile && npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npm run -s typecheck && echo APP_TSC_OK)
git status --short
```

Expected: website `pass 178`, `fail 0`, `WEB_TSC_OK`; app `pass 43`, `fail 0`, `APP_TSC_OK`; only the two README files modified.

- [ ] **Step 4: Commit**

```bash
git add README.md mobile/README.md
git commit -m "Document accounts in the app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: End-to-end, with the user**

This step needs three things only the user can provide. Ask for them; do not proceed without them and do not report this step as done if it was not run.

1. The `app-accounts` branch **and** the `simpler-signup` work deployed to `https://odatone.studio74.io`.
2. The invite and recovery templates pasted into the Supabase dashboard (`docs/supabase-email-templates.md`).
3. An email address the user can read, that has no Odatone account.

Then, in the app on a phone or the simulator, in this order:

| # | Do | Expect |
|---|---|---|
| 1 | Signed out, press play on any track | The "Log in to play" sheet; no audio |
| 2 | Create account → complete the three steps with the nominated address | The "Confirm your email" screen naming that address |
| 3 | Read the email | A 6-digit code above the "valid for 24 hours" line |
| 4 | Enter the code and a password of 7 characters | "The password must be at least 8 characters"; the code is not spent |
| 5 | Enter the code and an 8-character password | The modal closes |
| 6 | Press play | Audio plays |
| 7 | Account tab | Name, company, email, the chosen plan, "Pending"; pull down refreshes |
| 8 | Log out | Playback stops, the queue is empty, the card shows "Log in" |
| 9 | Log in with a wrong password | "That email and password don't match" |
| 10 | Forgot password → the nominated address → enter the emailed code and a new password | Signed in; play works |
| 11 | In /admin, cancel the subscription; background and reopen the app; press play | Playback refused with "Your subscription isn't active" |
| 12 | Sign up again with the same address | "An account with this email already exists", with Log in and Reset password |
| 13 | Turn on airplane mode, press Create account's last button | "Couldn't reach Odatone", and the form still holds everything typed |

Record each row's actual result in the report to the user, including any that failed.

---

## Self-review notes

- **Spec coverage:** route and templates (Tasks 1–2); configuration and shared pricing (Task 3); entitlement, offline window, `latestSubscription` (Task 4); `AuthProvider` and every action (Task 5); login, forgot, verify, Account tab (Task 6); three-step signup, plans from the database, error routing (Task 7); gating, sign-out reset (Task 8); docs, manual end-to-end (Task 9). The spec's "sheet" for the gate is a form-sheet route rather than an overlay, so it also appears above the Now Playing modal.
- **Dependency on `simpler-signup`:** nothing here edits it. Until it is deployed, Task 9 Step 5 row 2 ends in the generic server message (the server asks for `venueType` and `m2`); that is the designed behaviour, tested in Task 7.
- **Not automated:** anything that needs taps in the simulator. Those paths are covered by the pure-module tests and by Task 9's manual run.
