# Live Copy Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated editor change marketing copy directly on the deployed site and have it stick for every visitor.

**Architecture:** Copy overrides live in an Upstash Redis hash keyed by `<locale>:<original text>`. The layout and each page read them during static generation and apply them over the `lib/content/*.ts` defaults, so pages stay prerendered and a save triggers `revalidatePath`. Editing is unlocked by a signed cookie from a shared password; local development keeps rewriting source files instead.

**Tech Stack:** Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, `@upstash/redis`, Node 26 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-08-live-copy-editing-design.md`

## Global Constraints

- Node 26 runs `.ts` files directly. Tests are `node --test`, no test framework is to be added.
- The only new runtime dependency permitted is `@upstash/redis`. Install with `pnpm add`.
- Locales are exactly `"da"` and `"en"` (`lib/i18n.ts`). Danish is the default.
- `lib/content/*.ts` stays the defaults and must not be restructured.
- `components/player/*` and `lib/content/meta.ts` are out of scope — do not modify them.
- Every page is statically prerendered. No task may introduce a `cookies()` or `headers()` call into a layout or page, because that would opt all 25 pages into dynamic rendering.
- The site must render correctly with no Redis credentials configured.
- Existing development behaviour (editing rewrites `lib/content/*.ts`) must keep working unchanged.

## Correction to the spec

The spec says the layout reads the edit cookie and passes an `editable` flag to
`<body>`. Doing that would make every page dynamic, breaking the "pages stay
static" requirement in the same document. This plan resolves it as follows and
the spec should be amended to match:

- Reading **overrides** happens in the layout and pages. It touches no request
  state, so prerendering is preserved.
- Deciding **editability** moves to a client component that asks
  `GET /api/edit-session`. To keep this off the path of ordinary visitors, the
  unlock sets two cookies: the signed httpOnly `odatone_edit` cookie that
  actually authorises writes, and a readable `odatone_edit_hint` cookie whose
  only job is to tell the client whether it is worth making that request. A
  visitor without the hint never calls the endpoint.
- Therefore `contentEditable` is no longer in the served HTML at all. The
  editor turns it on at runtime, which also removes today's misleading
  "looks editable but saves nothing" behaviour.

---

### Task 1: Test harness and the pure override transform

**Files:**
- Create: `lib/copy-apply.ts`
- Create: `test/copy-apply.test.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `type Overrides = Record<string, string>` and
  `applyCopy<T>(value: T, overrides: Overrides): T`, used by Tasks 4, 5 and 6.

- [ ] **Step 1: Write the failing test**

Create `test/copy-apply.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { applyCopy } from "../lib/copy-apply.ts";

test("replaces a string that has an override", () => {
  assert.equal(applyCopy("Talk to sales", { "Talk to sales": "Contact us" }), "Contact us");
});

test("leaves a string with no override alone", () => {
  assert.equal(applyCopy("Talk to sales", {}), "Talk to sales");
});

test("walks nested objects", () => {
  const content = { hero: { line1: { da: "Spar", en: "Save" } } };
  const out = applyCopy(content, { Save: "Save big" });
  assert.deepEqual(out, { hero: { line1: { da: "Spar", en: "Save big" } } });
});

test("walks arrays", () => {
  const out = applyCopy(["one", "two"], { two: "three" });
  assert.deepEqual(out, ["one", "three"]);
});

test("matches strings containing newlines", () => {
  const out = applyCopy({ t: "Someone had to\nredo it." }, { "Someone had to\nredo it.": "Redone." });
  assert.deepEqual(out, { t: "Redone." });
});

test("does not mutate the input", () => {
  const content = { a: "old" };
  applyCopy(content, { old: "new" });
  assert.deepEqual(content, { a: "old" });
});

test("leaves non-string leaves untouched", () => {
  const out = applyCopy({ n: 4, b: true, z: null }, { "4": "four" });
  assert.deepEqual(out, { n: 4, b: true, z: null });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/copy-apply.test.ts`
Expected: FAIL — cannot find module `../lib/copy-apply.ts`.

- [ ] **Step 3: Write the implementation**

Create `lib/copy-apply.ts`:

```ts
/** Overrides for one locale: the text as written in lib/content, mapped to
    whatever it was edited to. */
export type Overrides = Record<string, string>;

/** Returns a structural copy of `value` with every string that has an
    override swapped for it. The input is never mutated, so the imported
    content modules stay pristine across requests. */
export function applyCopy<T>(value: T, overrides: Overrides): T {
  if (typeof value === "string") {
    const hit = overrides[value];
    return (hit === undefined ? value : hit) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyCopy(item, overrides)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = applyCopy(item, overrides);
    }
    return out as T;
  }
  return value;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/copy-apply.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "node --test test/"
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm test` then `npx tsc --noEmit`
Expected: 7 passing tests, tsc exits 0.

```bash
git add lib/copy-apply.ts test/copy-apply.test.ts package.json
git commit -m "Add override transform and a node --test harness"
```

---

### Task 2: The override store

**Files:**
- Create: `lib/copy-store.ts`
- Create: `test/copy-store.test.ts`
- Modify: `package.json` (dependency)

**Interfaces:**
- Consumes: `Overrides` from `lib/copy-apply.ts`.
- Produces:
  - `getOverrides(locale: Locale): Promise<Overrides>` — used by Tasks 4 and 5.
  - `setOverride(locale: Locale, from: string, to: string): Promise<{ previous: string | null }>` — used by Task 6.
  - `listHistory(limit?: number): Promise<HistoryEntry[]>` — used by Task 8.
  - `type HistoryEntry = { ts: number; locale: string; from: string; to: string }`.

- [ ] **Step 1: Install the client**

Run: `pnpm add @upstash/redis`

- [ ] **Step 2: Write the failing test**

These tests cover the credential-free path, which is what protects the live
site when the store is unreachable. They must pass with no Redis configured.

Create `test/copy-store.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { getOverrides, setOverride, listHistory } from "../lib/copy-store.ts";

test("returns no overrides when Redis is not configured", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.deepEqual(await getOverrides("da"), {});
});

test("reports failure rather than throwing when writing unconfigured", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  await assert.rejects(() => setOverride("da", "a", "b"), /not configured/);
});

test("returns an empty history when Redis is not configured", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.deepEqual(await listHistory(), []);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/copy-store.test.ts`
Expected: FAIL — cannot find module `../lib/copy-store.ts`.

- [ ] **Step 4: Write the implementation**

Create `lib/copy-store.ts`:

```ts
import { Redis } from "@upstash/redis";

import type { Overrides } from "@/lib/copy-apply";
import type { Locale } from "@/lib/i18n";

const HASH = "copy:overrides";
const HISTORY = "copy:history";
const HISTORY_MAX = 200;

export type HistoryEntry = { ts: number; locale: string; from: string; to: string };

/* Absent credentials are a normal state — locally, and on any deploy made
   before the integration was added — so this returns null instead of throwing
   and every read falls back to the defaults in lib/content. */
function client(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Every override for one locale, keyed by the text as it appears in
    lib/content. A store that is missing or unreachable yields none, which
    renders the site exactly as its source files describe it. */
export async function getOverrides(locale: Locale): Promise<Overrides> {
  const redis = client();
  if (!redis) return {};
  try {
    const all = await redis.hgetall<Record<string, string>>(HASH);
    if (!all) return {};
    const prefix = `${locale}:`;
    const out: Overrides = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Records one edit and returns what the text was before, so the caller can
    report it and the history list can be replayed backwards. */
export async function setOverride(
  locale: Locale,
  from: string,
  to: string,
): Promise<{ previous: string | null }> {
  const redis = client();
  if (!redis) throw new Error("Override store is not configured");

  const field = `${locale}:${from}`;
  const previous = await redis.hget<string>(HASH, field);
  await redis.hset(HASH, { [field]: to });
  await redis.lpush(HISTORY, JSON.stringify({ ts: Date.now(), locale, from, to }));
  await redis.ltrim(HISTORY, 0, HISTORY_MAX - 1);
  return { previous: previous ?? null };
}

/** Most recent edits first. */
export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  const redis = client();
  if (!redis) return [];
  try {
    const raw = await redis.lrange<string>(HISTORY, 0, limit - 1);
    return raw.map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS, 10 tests total.

- [ ] **Step 6: Commit**

```bash
git add lib/copy-store.ts test/copy-store.test.ts package.json pnpm-lock.yaml
git commit -m "Add Redis-backed copy override store"
```

Note: `pnpm-lock.yaml` is currently gitignored. Add `-f` if the lockfile should
be tracked, or leave it out; do not silently change the ignore policy.

---

### Task 3: Signed edit sessions

**Files:**
- Create: `lib/edit-session.ts`
- Create: `test/edit-session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `EDIT_COOKIE = "odatone_edit"`, `HINT_COOKIE = "odatone_edit_hint"`.
  - `signSession(expiresAt: number, secret: string): string`
  - `verifySession(token: string | undefined, secret: string | undefined, now?: number): boolean`
  - `passwordMatches(candidate: string, secret: string | undefined): boolean`

  Used by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

Create `test/edit-session.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/edit-session.test.ts`
Expected: FAIL — cannot find module `../lib/edit-session.ts`.

- [ ] **Step 3: Write the implementation**

Create `lib/edit-session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/** Authorises writes. httpOnly, so script on the page cannot read it. */
export const EDIT_COOKIE = "odatone_edit";
/** Readable by the page, and carries no authority whatsoever: its only job is
    to tell the client whether asking about a session is worth a request. */
export const HINT_COOKIE = "odatone_edit_hint";

export const SESSION_DAYS = 30;

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signSession(expiresAt: number, secret: string): string {
  const payload = String(expiresAt);
  return `${payload}.${mac(payload, secret)}`;
}

/** A session is valid only if the signature matches and it has not expired.
    No secret configured means no valid sessions — editing fails closed. */
export function verifySession(
  token: string | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!equal(signature, mac(payload, secret))) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function passwordMatches(candidate: string, secret: string | undefined): boolean {
  if (!secret || !candidate) return false;
  return equal(candidate, secret);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS, 17 tests total.

- [ ] **Step 5: Commit**

```bash
git add lib/edit-session.ts test/edit-session.test.ts
git commit -m "Add signed edit sessions"
```

---

### Task 4: Serve overrides to client components

**Files:**
- Create: `components/CopyProvider.tsx`
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `getOverrides` (Task 2), `applyCopy` and `Overrides` (Task 1).
- Produces: `useCopy<T>(defaults: T): T` for client components, used in Task 5.

- [ ] **Step 1: Write the provider**

Create `components/CopyProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, useMemo } from "react";

import { applyCopy, type Overrides } from "@/lib/copy-apply";

const CopyContext = createContext<Overrides>({});

export function CopyProvider({
  overrides,
  children,
}: {
  overrides: Overrides;
  children: React.ReactNode;
}) {
  return <CopyContext.Provider value={overrides}>{children}</CopyContext.Provider>;
}

/** Client-side counterpart to reading overrides on the server: hand it the
    imported defaults and get back the edited text. With no overrides in play
    it returns a structural copy of the defaults, so behaviour is identical
    whether or not the store is configured. */
export function useCopy<T>(defaults: T): T {
  const overrides = useContext(CopyContext);
  return useMemo(() => applyCopy(defaults, overrides), [defaults, overrides]);
}
```

- [ ] **Step 2: Seed it from the layout**

In `app/[locale]/layout.tsx`, add to the imports:

```tsx
import { CopyProvider } from "@/components/CopyProvider";
import { getOverrides } from "@/lib/copy-store";
```

After the `if (!isLocale(locale)) notFound();` line, add:

```tsx
  const overrides = await getOverrides(locale);
```

Wrap the existing `<ThemeProvider>` element in `<CopyProvider overrides={overrides}>…</CopyProvider>`.

- [ ] **Step 3: Remove contentEditable from the served HTML**

Still in `app/[locale]/layout.tsx`, change the body back to:

```tsx
      <body className="min-h-dvh antialiased">
```

Editability becomes a runtime decision in Task 7. Leaving the attribute in the
static HTML is what made the deployed site look editable while saving nothing.

- [ ] **Step 4: Verify prerendering survived**

Run: `npx next build`
Expected: exit 0, and the route table still shows `●` (SSG) for `/da`, `/en`
and the `[page]` routes. If any became `ƒ` (Dynamic), a request-time API was
introduced — find and remove it before continuing.

- [ ] **Step 5: Commit**

```bash
git add components/CopyProvider.tsx "app/[locale]/layout.tsx"
git commit -m "Seed copy overrides into the client tree"
```

---

### Task 5: Read overrides in the components that render copy

**Files:**
- Modify (server components): `components/pages/AboutPage.tsx`, `ArtistsPage.tsx`, `ContactPage.tsx`, `LegalPage.tsx`, `PlayerPage.tsx`, `PricingPage.tsx`, `SavingsPage.tsx`, `SignupPage.tsx`
- Modify (client components): `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/ThemeToggle.tsx`, `components/marketing/Calculator.tsx`, `ContactForm.tsx`, `HeroSavings.tsx`, `PriceCompare.tsx`, `PricingTable.tsx`, `components/signup/SignupFlow.tsx`
- Create: `lib/copy-server.ts`

**Interfaces:**
- Consumes: `getOverrides` (Task 2), `applyCopy` (Task 1), `useCopy` (Task 4).
- Produces: `serverCopy<T>(defaults: T, locale: Locale): Promise<T>`.

The pattern is identical in every file: the imported content object is no
longer read directly; it is passed through the override lookup once at the top
and the local name is used from then on.

- [ ] **Step 1: Add the server-side helper**

Create `lib/copy-server.ts`:

```ts
import { cache } from "react";

import { applyCopy } from "@/lib/copy-apply";
import { getOverrides } from "@/lib/copy-store";
import type { Locale } from "@/lib/i18n";

/* React's cache keeps one render pass to a single round trip, however many
   components ask for copy. */
const overridesFor = cache(getOverrides);

export async function serverCopy<T>(defaults: T, locale: Locale): Promise<T> {
  return applyCopy(defaults, await overridesFor(locale));
}
```

- [ ] **Step 2: Convert one server page and verify the shape**

In `components/pages/AboutPage.tsx`, change the import of the content object to
keep the default under a distinct name, then resolve it:

```tsx
import { about as aboutDefaults } from "@/lib/content/about";
import { ui as uiDefaults } from "@/lib/content/common";
import { serverCopy } from "@/lib/copy-server";

export default async function AboutPage({ locale: l }: { locale: Locale }) {
  const about = await serverCopy(aboutDefaults, l);
  const ui = await serverCopy(uiDefaults, l);
```

Every existing `about.…` and `ui.…` reference in the file now reads the
resolved object and needs no further change. The component becomes `async`;
its caller in `app/[locale]/[page]/page.tsx` already awaits its own params and
renders it as a server component, so no change is needed there.

- [ ] **Step 3: Verify the converted page still renders**

Run: `npx next build`
Expected: exit 0, `/da/om` and `/en/about` still listed as SSG.

- [ ] **Step 4: Commit the first page**

```bash
git add lib/copy-server.ts components/pages/AboutPage.tsx
git commit -m "Resolve copy overrides in AboutPage"
```

- [ ] **Step 5: Repeat for the remaining seven server pages**

Apply the exact pattern from Step 2 to `ArtistsPage.tsx`, `ContactPage.tsx`,
`LegalPage.tsx`, `PlayerPage.tsx`, `PricingPage.tsx`, `SavingsPage.tsx` and
`SignupPage.tsx`, renaming each content import to `<name>Defaults` and
resolving it with `serverCopy`. Do not touch anything imported from
`@/lib/content/player` inside `components/player/*`; those are out of scope.

Run `npx next build` after each file. Commit after each: `git commit -m "Resolve copy overrides in <PageName>"`.

- [ ] **Step 6: Convert the client components**

For each of `SiteHeader.tsx`, `SiteFooter.tsx`, `ThemeToggle.tsx`,
`marketing/Calculator.tsx`, `marketing/ContactForm.tsx`,
`marketing/HeroSavings.tsx`, `marketing/PriceCompare.tsx`,
`marketing/PricingTable.tsx` and `signup/SignupFlow.tsx`, rename the content
import and resolve it with the hook. `SiteHeader.tsx` becomes:

```tsx
import { NAV as NAV_DEFAULTS, ui as uiDefaults } from "@/lib/content/common";
import { useCopy } from "@/components/CopyProvider";

// inside the component body, before any early return:
  const ui = useCopy(uiDefaults);
  const NAV = useCopy(NAV_DEFAULTS);
```

`useCopy` is a hook, so the calls must sit at the top of the component with the
other hooks, never inside a condition or loop.

Run `pnpm test && npx tsc --noEmit && npx next build` after each file, and
commit each: `git commit -m "Resolve copy overrides in <ComponentName>"`.

- [ ] **Step 7: Confirm the whole surface is covered**

Run: `grep -rn "@/lib/content" app components | grep -v player | grep -v Defaults`
Expected: only `lib/content/meta.ts` imports (metadata, deliberately out of
scope) remain. Anything else is a component still reading defaults directly.

---

### Task 6: Accept edits in production

**Files:**
- Modify: `app/api/edits/route.ts`
- Create: `test/edits-payload.test.ts`

**Interfaces:**
- Consumes: `setOverride` (Task 2), `verifySession`, `EDIT_COOKIE` (Task 3).
- Produces: no new exports; the route's response gains `{ applied, unresolved, mode: "source" | "live" }`.

- [ ] **Step 1: Write the failing test for payload parsing**

The existing route mixes payload validation into the handler. Extract it so it
can be tested without a server. Create `test/edits-payload.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseEdits } from "../app/api/edits/payload.ts";

test("accepts a well-formed payload", () => {
  assert.deepEqual(parseEdits({ path: "/da", edits: { a: "b" } }), {
    ok: true,
    page: "/da",
    edits: { a: "b" },
  });
});

test("rejects a missing path", () => {
  assert.equal(parseEdits({ edits: { a: "b" } }).ok, false);
});

test("rejects edits that are not an object", () => {
  assert.equal(parseEdits({ path: "/da", edits: ["a"] }).ok, false);
  assert.equal(parseEdits({ path: "/da" }).ok, false);
});

test("drops non-string and empty-key entries", () => {
  const result = parseEdits({ path: "/da", edits: { a: "b", "": "c", d: 4 } });
  assert.deepEqual(result.ok && result.edits, { a: "b" });
});

test("rejects a payload left with no usable edits", () => {
  assert.equal(parseEdits({ path: "/da", edits: { "": "c" } }).ok, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/edits-payload.test.ts`
Expected: FAIL — cannot find module `../app/api/edits/payload.ts`.

- [ ] **Step 3: Extract the parser**

Create `app/api/edits/payload.ts`:

```ts
export type ParsedEdits =
  | { ok: true; page: string; edits: Record<string, string> }
  | { ok: false; error: string };

export function parseEdits(body: unknown): ParsedEdits {
  const { path: page, edits } = (body ?? {}) as { path?: unknown; edits?: unknown };

  if (typeof page !== "string" || !page) return { ok: false, error: "Missing path" };
  if (!edits || typeof edits !== "object" || Array.isArray(edits)) {
    return { ok: false, error: "Missing edits" };
  }

  const clean: Record<string, string> = {};
  for (const [before, after] of Object.entries(edits as object)) {
    if (typeof before === "string" && typeof after === "string" && before) {
      clean[before] = after;
    }
  }
  if (!Object.keys(clean).length) return { ok: false, error: "Missing edits" };

  return { ok: true, page, edits: clean };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS, 22 tests total.

- [ ] **Step 5: Branch the route on environment**

Rewrite `app/api/edits/route.ts` so the handler is:

```ts
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { parseEdits } from "./payload";
import { setOverride } from "@/lib/copy-store";
import { EDIT_COOKIE, verifySession } from "@/lib/edit-session";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const isDev = process.env.NODE_ENV === "development";

/** The editor posts the page it was on; the locale is its first segment. */
function localeOf(page: string): Locale {
  const first = page.split("/").filter(Boolean)[0];
  return first && isLocale(first) ? first : DEFAULT_LOCALE;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseEdits(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  if (isDev) {
    // Unchanged: rewrite the string literal in lib/content/*.ts.
    const result = await applyToSource(parsed.page, parsed.edits);
    return Response.json({ ok: true, mode: "source", ...result });
  }

  const jar = await cookies();
  if (!verifySession(jar.get(EDIT_COOKIE)?.value, process.env.EDIT_PASSWORD)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const locale = localeOf(parsed.page);
  const applied: { from: string; to: string; previous: string | null }[] = [];
  try {
    for (const [from, to] of Object.entries(parsed.edits)) {
      const { previous } = await setOverride(locale, from, to);
      applied.push({ from, to, previous });
    }
  } catch {
    return Response.json({ error: "Override store unavailable" }, { status: 503 });
  }

  revalidatePath("/", "layout");
  return Response.json({ ok: true, mode: "live", applied, unresolved: [] });
}
```

Keep the current file-rewriting body — the literal matching, the `unresolved`
parking in `content-edits.json`, and the write queue — as a function named
`applyToSource(page, edits)` in the same file, unchanged in behaviour.

- [ ] **Step 6: Verify both modes**

Run: `pnpm dev`, edit text in the browser, confirm `lib/content/*.ts` still
changes and the response reports `"mode": "source"`. Then `git checkout` the
content file.

Run: `npx next build && npx next start`, then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/edits \
  -H 'Content-Type: application/json' -d '{"path":"/da","edits":{"a":"b"}}'
```

Expected: `401` — production writes without a session are refused.

- [ ] **Step 7: Commit**

```bash
git add app/api/edits/route.ts app/api/edits/payload.ts test/edits-payload.test.ts
git commit -m "Accept authenticated copy edits in production"
```

---

### Task 7: Unlocking and the editor shell

**Files:**
- Create: `app/api/edit-session/route.ts`
- Create: `components/dev/EditorShell.tsx`
- Modify: `components/dev/EditCapture.tsx`
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `passwordMatches`, `signSession`, `verifySession`, `EDIT_COOKIE`, `HINT_COOKIE`, `SESSION_DAYS` (Task 3).
- Produces: `GET /api/edit-session` → `{ editable: boolean }`; `POST /api/edit-session` with `{ password }` → sets cookies.

- [ ] **Step 1: Write the session endpoint**

Create `app/api/edit-session/route.ts`:

```ts
import { cookies } from "next/headers";

import {
  EDIT_COOKIE,
  HINT_COOKIE,
  SESSION_DAYS,
  passwordMatches,
  signSession,
  verifySession,
} from "@/lib/edit-session";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/* Guessing protection for a single shared password. Per-instance and
   deliberately simple: enough to make an online guessing attack impractical
   without pulling in a rate-limiting service. */
const attempts = new Map<string, { count: number; since: number }>();

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const seen = attempts.get(ip);
  if (!seen || now - seen.since > WINDOW_MS) {
    attempts.set(ip, { count: 1, since: now });
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_ATTEMPTS;
}

export async function GET() {
  const jar = await cookies();
  const editable =
    process.env.NODE_ENV === "development" ||
    verifySession(jar.get(EDIT_COOKIE)?.value, process.env.EDIT_PASSWORD);
  return Response.json({ editable });
}

export async function POST(request: Request) {
  const secret = process.env.EDIT_PASSWORD;
  if (!secret) {
    return Response.json({ error: "Editing is not configured" }, { status: 500 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(ip)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  let password = "";
  try {
    ({ password } = (await request.json()) as { password?: string });
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!passwordMatches(password ?? "", secret)) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const jar = await cookies();
  jar.set(EDIT_COOKIE, signSession(expiresAt, secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  /* Carries no authority: it only saves every other visitor a request. */
  jar.set(HINT_COOKIE, "1", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Write the shell**

Create `components/dev/EditorShell.tsx`. It owns three things: deciding whether
this visitor may edit, turning the body editable, and showing which destination
edits are heading for.

```tsx
"use client";

import { useEffect, useState } from "react";

import EditCapture from "@/components/dev/EditCapture";
import { HINT_COOKIE } from "@/lib/edit-session";

export default function EditorShell({ dev }: { dev: boolean }) {
  const [editable, setEditable] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const hinted = document.cookie.split("; ").some((c) => c.startsWith(`${HINT_COOKIE}=`));
    const wants = new URLSearchParams(window.location.search).has("edit");
    /* Ordinary visitors have neither a session hint nor ?edit, and never
       reach the network on this account. */
    if (!dev && !hinted && !wants) return;

    let live = true;
    fetch("/api/edit-session")
      .then((r) => r.json())
      .then((data: { editable: boolean }) => {
        if (!live) return;
        if (data.editable) setEditable(true);
        else if (wants) setAsking(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dev]);

  useEffect(() => {
    if (!editable) return;
    document.body.contentEditable = "true";
    document.body.spellcheck = true;
    return () => {
      document.body.contentEditable = "false";
    };
  }, [editable]);

  if (asking) return <PasswordPrompt onUnlocked={() => window.location.reload()} />;
  if (!editable) return null;

  return (
    <>
      <EditCapture />
      <span
        contentEditable={false}
        className="fixed bottom-3 left-3 z-[200] rounded-full bg-accent px-3 py-1 text-xs text-accent-ink"
      >
        {dev ? "editing source" : "editing live site"}
      </span>
    </>
  );
}

function PasswordPrompt({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/edit-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) onUnlocked();
    else setError(res.status === 429 ? "Too many attempts. Wait 10 minutes." : "Wrong password.");
  }

  return (
    <form
      onSubmit={submit}
      contentEditable={false}
      className="fixed bottom-3 left-3 z-[200] flex gap-2 rounded-full bg-bg px-3 py-2 shadow"
    >
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Edit password"
        className="bg-transparent text-sm outline-none"
        autoFocus
      />
      <button type="submit" className="text-sm font-medium">
        Unlock
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
```

- [ ] **Step 3: Mount it**

In `app/[locale]/layout.tsx`, replace the dev-gated `EditCapture` line with:

```tsx
        <EditorShell dev={process.env.NODE_ENV === "development"} />
```

and swap the import from `EditCapture` to `EditorShell`.

- [ ] **Step 4: Keep the badge out of the saved text**

In `components/dev/EditCapture.tsx`, add a guard to `editedElement()` so the
badge and prompt are never treated as page copy:

```ts
  if (el.closest("[contenteditable='false']")) return null;
```

- [ ] **Step 5: Verify**

Run: `npx next build && npx next start` with `EDIT_PASSWORD` set.

- Visit `/da` — the body must not be editable, and the network tab must show no
  request to `/api/edit-session`.
- Visit `/da?edit` — the password prompt appears; a wrong password is refused;
  six wrong attempts return 429.
- Enter the right password — the page reloads, the badge reads "editing live
  site", and typing then clicking away updates the copy for a fresh incognito
  visitor.

- [ ] **Step 6: Commit**

```bash
git add app/api/edit-session components/dev/EditorShell.tsx components/dev/EditCapture.tsx "app/[locale]/layout.tsx"
git commit -m "Gate live editing behind a password-unlocked session"
```

---

### Task 8: Export overrides back to source

**Files:**
- Create: `app/api/edits/export/route.ts`

**Interfaces:**
- Consumes: `getOverrides` (Task 2), `verifySession`, `EDIT_COOKIE` (Task 3), `listHistory` (Task 2).
- Produces: `GET /api/edits/export` → a JSON document of current overrides per locale.

This is the answer to the drift the spec names as this design's main long-term
cost: it makes the live copy recoverable into source at any time.

- [ ] **Step 1: Write the endpoint**

Create `app/api/edits/export/route.ts`:

```ts
import { cookies } from "next/headers";

import { getOverrides, listHistory } from "@/lib/copy-store";
import { EDIT_COOKIE, verifySession } from "@/lib/edit-session";
import { LOCALES } from "@/lib/i18n";

/** Everything the live site says that its source files do not, so it can be
    pasted back into lib/content when the two have drifted far enough to
    bother. Editor-only: the overrides themselves are public, but the history
    of who changed what and when is not worth handing out. */
export async function GET() {
  const jar = await cookies();
  if (!verifySession(jar.get(EDIT_COOKIE)?.value, process.env.EDIT_PASSWORD)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const overrides: Record<string, Record<string, string>> = {};
  for (const locale of LOCALES) {
    overrides[locale] = await getOverrides(locale);
  }

  return Response.json({ overrides, history: await listHistory(200) }, {
    headers: { "Content-Disposition": 'attachment; filename="copy-overrides.json"' },
  });
}
```

- [ ] **Step 2: Verify**

With a valid session: `curl -b "odatone_edit=<token>" http://localhost:3000/api/edits/export`
Expected: JSON with an `overrides` key per locale and a `history` array.
Without the cookie: `401`.

- [ ] **Step 3: Commit**

```bash
git add app/api/edits/export/route.ts
git commit -m "Add an override export for pulling live copy back into source"
```

---

### Task 9: End-to-end verification and documentation

**Files:**
- Create: `scripts/verify-live-editing.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write the end-to-end script**

Create `scripts/verify-live-editing.mjs`, adapting the CDP harness used to
diagnose the original bug: launch headless Chrome against a production build
with `EDIT_PASSWORD` set and a scratch Redis database, then assert in order:

1. `/da` is not editable and issues no `/api/edit-session` request.
2. `/da?edit` with a wrong password is refused.
3. `/da?edit` with the right password makes `document.body.isContentEditable`
   true.
4. Typing into an `h1` and clicking away issues one `POST /api/edits` that
   returns `{ "mode": "live" }`.
5. A fresh request to `/da` contains the new text.
6. With the Redis env vars removed, `/da` still renders and shows the original
   text from `lib/content`.

- [ ] **Step 2: Run it**

Run: `node scripts/verify-live-editing.mjs`
Expected: all six assertions pass.

- [ ] **Step 3: Document it**

Add a "Editing copy" section to `README.md` covering: editing locally rewrites
`lib/content/*.ts` and shows as a git diff; editing on the deployed site needs
`/da?edit` and the `EDIT_PASSWORD`, goes live immediately for all visitors, and
drifts from source until exported via `/api/edits/export`.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-live-editing.mjs README.md
git commit -m "Verify live copy editing end to end and document it"
```

---

## Prerequisites the implementer cannot do alone

These need the Vercel account owner and block Tasks 2, 6 and 7 in production:

1. `vercel link` in this repo — it is not linked (`.vercel/` is absent).
2. `vercel integration add upstash` — provisions the database and injects
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. `vercel env add EDIT_PASSWORD production` — the shared editing password.
4. `vercel env pull .env.local --yes` — to develop against the same store.

Tasks 1, 3 and 5 have no such dependency and can proceed immediately.
