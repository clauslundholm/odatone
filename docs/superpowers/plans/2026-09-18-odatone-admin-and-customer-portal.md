# Odatone Admin Backend and Customer Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Odatone a system of record — real customer accounts, authentication for staff and customers, enforced tenant isolation — and the `/admin` screens that make it visible, so signup stops discarding customers.

**Architecture:** Supabase Postgres holds customers, locations, plans, subscriptions and invoices; Supabase Auth serves both audiences from one instance, separated by a role on `profiles`. Row-level security is the tenancy boundary and is tested in SQL, not assumed. `proxy.ts` refreshes sessions and gates the two route prefixes. Plan *data* moves into Postgres while the pricing *arithmetic* stays in `lib/pricing.ts`, shared by the marketing site and admin, guarded by a parity test.

**Tech Stack:** Next.js 16.3.3 (App Router, Turbopack), React 19.2.8, TypeScript 5, Tailwind v4, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.116.0, Supabase CLI 2.117.0 (pgTAP), Node's built-in `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-18-odatone-admin-and-customer-portal-design.md`

## Global Constraints

These apply to every task. They are not repeated per task.

- **Next 16 renamed `middleware.ts` to `proxy.ts`.** The file exports `proxy`, not `middleware`. Never create `middleware.ts`.
- **Never call `supabase.auth.getSession()` in server code.** It reads the cookie without verifying its signature. Use `getClaims()`, and call it early in the handler, before the response is committed.
- **Cookie handlers must implement `getAll` and `setAll`.** The `get`/`set`/`remove` trio is deprecated in `@supabase/ssr` 0.12 and miss edge cases that cause random logouts.
- **`setAll` receives a second argument of response headers.** They must be applied. Without them Vercel's CDN can cache a response carrying `Set-Cookie` and serve one customer's session token to another.
- **Do not enable `cacheComponents` in `next.config.ts`.** Plans use `unstable_cache` + `revalidateTag`, matching `lib/copy-server.ts`. The `use cache` directive requires `cacheComponents: true`, which changes rendering for all 25 existing marketing pages and is out of scope.
- **Money is stored as integer øre.** Never a float column. Currency is DKK.
- **Localised text is `jsonb` shaped `Record<'da'|'en', string>`**, matching the existing `L10n` type in `lib/i18n.ts`.
- **`lib/supabase/admin.ts` must never be imported by a client component.** It holds the service-role key.
- **Tests run with `npm test` (`node --test test/`).** SQL tests run with `npx supabase test db`.
- **Commit messages are prose in the repository's existing style** — a short imperative summary line, a blank line, then paragraphs explaining *why*. Not Conventional Commits. End with the `Co-Authored-By` trailer used by the other commits on this branch.
- **`/admin` is English only.** `/my-odatone` is bilingual (da/en) via the existing `L10n` pattern.

## File Structure

**New — Supabase access (one responsibility each, no component builds its own client):**

| File | Responsibility |
| --- | --- |
| `lib/supabase/env.ts` | Resolve and validate credentials. Pure, unit-tested. |
| `lib/supabase/server.ts` | Server components and server actions, user session |
| `lib/supabase/client.ts` | Browser components |
| `lib/supabase/admin.ts` | Service-role client. Signup only. |
| `lib/supabase/proxy.ts` | Session-refresh helper called by `proxy.ts` |

**New — domain logic (pure, testable without a database):**

| File | Responsibility |
| --- | --- |
| `lib/money.ts` | øre ↔ kroner, VAT, invoice totals |
| `lib/plans-server.ts` | Cached plan reads, `PLANS_TAG`, revalidation |
| `lib/tenancy.ts` | `Role`, `Session` types and role predicates |

**New — database:**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0001_core.sql` | customers, locations, profiles |
| `supabase/migrations/0002_commerce.sql` | plans, addons, subscriptions, invoices, audit_log |
| `supabase/migrations/0003_tenancy.sql` | `SECURITY DEFINER` helpers and RLS policies |
| `supabase/seed.sql` | The three plans and the streaming add-on |
| `supabase/tests/tenancy.test.sql` | pgTAP isolation tests — the security boundary |

**New — routes and UI:**

```
proxy.ts                              session refresh + gating
app/admin/layout.tsx                  shell
app/admin/page.tsx                    dashboard
app/admin/login/page.tsx              staff login
app/admin/customers/page.tsx          list
app/admin/customers/[id]/page.tsx     detail
app/admin/products/page.tsx           plans and add-ons
app/admin/actions.ts                  admin server actions
app/my-odatone/layout.tsx             shell (bilingual)
app/my-odatone/login/page.tsx         customer login
app/my-odatone/page.tsx               account summary
components/admin/                     AppShell, SideNav, TopBar, Kpi,
                                      TableCard, Meter, Badge, EmptyState, Toast
```

**Modified:**

| File | Change |
| --- | --- |
| `app/globals.css` | Add `--c-ok` and `--c-bad` in both themes |
| `app/actions.ts` | `submitSignup` persists instead of logging |
| `lib/pricing.ts` | `PLANS` becomes the seed; `plan()` reads from the database layer |
| `package.json` | Supabase dependencies, `test:db` script |

---

### Task 1: Provision Supabase and resolve credentials

The repository already solves this problem once, in `lib/copy-store.ts`: credentials arrive under different names depending on how the database was created, so the code accepts every spelling and treats "absent" as a normal state rather than throwing. Supabase gets the same treatment.

**Files:**
- Create: `lib/supabase/env.ts`
- Test: `test/supabase-env.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveSupabaseEnv(source?: Record<string, string | undefined>): SupabaseEnv | null` and `resolveServiceKey(source?): string | null`, where `type SupabaseEnv = { url: string; anonKey: string }`. Tasks 7, 9, 13 and 14 build clients from these.

- [ ] **Step 1: Provision the integration**

```bash
vercel link          # if the worktree is not linked yet
vercel integration add supabase --yes --no-claim
```

If the CLI hands off to the dashboard or a browser to finish the handshake, **stop and ask the user to complete it**, then continue. Choose an **EU region** — the customers are Danish businesses and the spec requires it.

- [ ] **Step 2: Pull the variables and record their real names**

```bash
vercel env pull --yes
grep -o '^[A-Z_]*SUPABASE[A-Z_]*' .env.local | sort -u
```

Write the names down. Step 4's implementation must list the ones actually present first. Never print the values.

- [ ] **Step 3: Write the failing test**

Tests import with a relative path and an explicit `.ts` extension — `node --test` resolves files directly and does not read the `@/` alias from `tsconfig.json`.

```ts
// test/supabase-env.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSupabaseEnv, resolveServiceKey } from "../lib/supabase/env.ts";

test("reads the public spelling", () => {
  const env = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  });
  assert.deepEqual(env, { url: "https://x.supabase.co", anonKey: "anon-key" });
});

test("falls back to the unprefixed spelling", () => {
  const env = resolveSupabaseEnv({
    SUPABASE_URL: "https://y.supabase.co",
    SUPABASE_ANON_KEY: "other-key",
  });
  assert.deepEqual(env, { url: "https://y.supabase.co", anonKey: "other-key" });
});

test("accepts the publishable-key spelling", () => {
  const env = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://z.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-key",
  });
  assert.equal(env?.anonKey, "pub-key");
});

test("absent credentials are a normal state, not an error", () => {
  assert.equal(resolveSupabaseEnv({}), null);
});

test("a half-configured environment is treated as absent", () => {
  assert.equal(resolveSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }), null);
});

test("the service key is read separately and never from a public name", () => {
  assert.equal(resolveServiceKey({ SUPABASE_SERVICE_ROLE_KEY: "svc" }), "svc");
  assert.equal(resolveServiceKey({ SUPABASE_SECRET_KEY: "secret" }), "secret");
  assert.equal(resolveServiceKey({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leaked" }), null);
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/supabase/env.ts'`

- [ ] **Step 5: Implement**

```ts
// lib/supabase/env.ts
/* Credentials arrive under different names depending on how the project was
   created: the Vercel Marketplace integration, the Supabase dashboard and the
   newer publishable/secret key scheme all spell them differently. Whichever is
   present wins, exactly as lib/copy-store.ts does for Upstash. */

export type SupabaseEnv = { url: string; anonKey: string };

type Source = Record<string, string | undefined>;

const pick = (src: Source, ...names: string[]): string | null => {
  for (const n of names) {
    const v = src[n];
    if (v) return v;
  }
  return null;
};

/** Null is a normal state — locally, and on any deploy made before the
    integration was added. Callers decide what that means rather than crashing
    a render. A half-configured environment counts as absent: a URL without a
    key cannot produce a working client. */
export function resolveSupabaseEnv(source: Source = process.env): SupabaseEnv | null {
  const url = pick(source, "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = pick(
    source,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  return url && anonKey ? { url, anonKey } : null;
}

/* Deliberately refuses any NEXT_PUBLIC_ name. A service-role key under a public
   name would be inlined into the client bundle by the compiler, and this
   function is the last place that mistake can be caught. */
export function resolveServiceKey(source: Source = process.env): string | null {
  return pick(source, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS, six new tests.

- [ ] **Step 7: Add the dependencies and the database test script**

```bash
npm install @supabase/ssr@0.12.7 @supabase/supabase-js@2.116.0
npm install --save-dev supabase@2.117.0
npm pkg set scripts.test:db="supabase test db"
```

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/env.ts test/supabase-env.test.ts package.json package-lock.json
git commit
```

Message: `Resolve Supabase credentials under whichever name they arrive`, explaining that the integration, the dashboard and the publishable-key scheme spell them differently, that absent is a normal state rather than a crash, and that the service key refuses public names because the compiler would inline one into the browser bundle.

---

### Task 2: Core schema — customers, locations, profiles

**Files:**
- Create: `supabase/migrations/0001_core.sql`
- Test: `supabase/tests/core.test.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `customers`, `locations`, `profiles`; enums `customer_status`, `user_role`. Tasks 3, 4, 10, 11 and 13 read and write them.

- [ ] **Step 1: Start the local stack**

```bash
npx supabase init     # only if supabase/ does not exist yet
npx supabase start
```

This downloads containers on first run and takes a few minutes.

- [ ] **Step 2: Write the failing test**

```sql
-- supabase/tests/core.test.sql
begin;
select plan(5);

select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'locations', 'locations table exists');
select has_table('public', 'profiles', 'profiles table exists');

-- Staff belong to no customer; customer users must belong to one. The check
-- constraint is the only thing keeping a staff account from being silently
-- scoped to a tenant, so it is asserted directly.
select throws_ok(
  $$ insert into profiles (id, customer_id, role, full_name)
     values ('00000000-0000-0000-0000-000000000001', null, 'owner', 'No Customer') $$,
  '23514',
  null,
  'an owner without a customer is rejected'
);

select lives_ok(
  $$ insert into profiles (id, customer_id, role, full_name)
     values ('00000000-0000-0000-0000-000000000002', null, 'staff_admin', 'Staff') $$,
  'a staff_admin without a customer is accepted'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run test:db`
Expected: FAIL — `relation "customers" does not exist`

- [ ] **Step 4: Write the migration**

```sql
-- supabase/migrations/0001_core.sql
create extension if not exists "uuid-ossp";

create type customer_status as enum ('pending', 'active', 'suspended', 'cancelled');
create type user_role as enum ('owner', 'manager', 'staff_admin', 'staff_support');

create table customers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  cvr           text,
  billing_email text not null,
  address       text,
  postcode      text,
  city          text,
  country       text not null default 'DK',
  status        customer_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- venue_type and hours_band mirror VenueTypeId and HoursBand in lib/rates.ts.
-- They are text rather than enums so adding a venue type stays a code change
-- and does not need a migration.
create table locations (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  address     text,
  postcode    text,
  city        text,
  venue_type  text not null,
  m2          integer not null check (m2 > 0),
  hours_band  text not null default 'normal',
  created_at  timestamptz not null default now()
);

create index locations_customer_id_idx on locations (customer_id);

-- One row per auth user. Staff have no customer; customer users must have one.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  role        user_role not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  constraint profiles_tenancy_ck check (
    (role in ('staff_admin', 'staff_support') and customer_id is null)
    or
    (role in ('owner', 'manager') and customer_id is not null)
  )
);

create index profiles_customer_id_idx on profiles (customer_id);
```

- [ ] **Step 5: Apply and run the tests**

```bash
npx supabase db reset    # replays every migration and seed from scratch
npm run test:db
```

Expected: PASS, 5 assertions.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_core.sql supabase/tests/core.test.sql
git commit
```

Message: `Give Odatone somewhere to keep a customer`, explaining that a customer is the paying business, locations are what billing counts, and the check constraint on `profiles` is what stops a staff account from being silently scoped to one tenant.

---

### Task 3: Commercial schema and the plan seed

**Files:**
- Create: `supabase/migrations/0002_commerce.sql`, `scripts/plans-seed.mjs`
- Generated: `supabase/seed.sql`
- Test: `supabase/tests/commerce.test.sql`, `test/plans-seed.test.ts`

**Interfaces:**
- Consumes: `customers` from Task 2.
- Produces: tables `plans`, `addons`, `subscriptions`, `subscription_addons`, `invoices`, `audit_log`; enums `billing_term`, `subscription_status`, `invoice_status`, `invoice_source`. Tasks 6, 10, 11, 12 and 13 read them.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/commerce.test.sql
begin;
select plan(4);

select has_table('public', 'plans', 'plans table exists');
select has_table('public', 'invoices', 'invoices table exists');

-- The seed must reproduce lib/pricing.ts exactly. If these drift, the public
-- pricing page changes silently, which is what the parity test in Task 6 exists
-- to prevent — this is the database half of that guarantee.
select results_eq(
  'select id, monthly_ore, max_m2 from plans order by sort',
  $$ values ('small'::text, 14900, 100), ('medium', 19900, 300), ('main', 24900, null) $$,
  'seeded plans match lib/pricing.ts'
);

-- A seeded invoice must never be mistaken for a real one once Stripe lands.
select col_not_null('public', 'invoices', 'source', 'invoices.source is required');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:db`
Expected: FAIL — `relation "plans" does not exist`

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/0002_commerce.sql
create type billing_term        as enum ('monthly', 'annual');
create type subscription_status as enum ('pending', 'trialing', 'active', 'past_due', 'cancelled');
create type invoice_status      as enum ('draft', 'open', 'paid', 'overdue', 'void');
create type invoice_source      as enum ('seed', 'stripe');

-- id matches PlanId in lib/pricing.ts ('small' | 'medium' | 'main') so the two
-- cannot drift apart. Money is integer øre; tagline and features are L10n
-- objects, the same Record<'da'|'en', string> shape the rest of the site uses.
create table plans (
  id          text primary key,
  name        text not null,
  monthly_ore integer not null check (monthly_ore >= 0),
  max_m2      integer,
  tagline     jsonb not null,
  features    jsonb not null default '[]'::jsonb,
  sort        integer not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table addons (
  id          text primary key,
  name        jsonb not null,
  monthly_ore integer not null check (monthly_ore >= 0),
  active      boolean not null default true
);

create table subscriptions (
  id                 uuid primary key default uuid_generate_v4(),
  customer_id        uuid not null references customers(id) on delete cascade,
  plan_id            text not null references plans(id),
  billing            billing_term not null default 'monthly',
  status             subscription_status not null default 'pending',
  started_at         timestamptz,
  current_period_end timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index subscriptions_customer_id_idx on subscriptions (customer_id);

create table subscription_addons (
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  addon_id        text not null references addons(id),
  primary key (subscription_id, addon_id)
);

-- source distinguishes seeded rows from real ones, so slice 4 can find every
-- placeholder it must replace and nobody ever reads a fake total as revenue.
create table invoices (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid not null references customers(id) on delete cascade,
  number       text not null unique,
  issued_at    timestamptz not null default now(),
  due_at       timestamptz,
  period_start date,
  period_end   date,
  subtotal_ore integer not null,
  vat_ore      integer not null,
  total_ore    integer not null,
  status       invoice_status not null default 'draft',
  source       invoice_source not null,
  created_at   timestamptz not null default now()
);

create index invoices_customer_id_idx on invoices (customer_id);

-- Prices become operational in Task 12, so who changed what stops being a
-- nicety. Rows are written by triggers and server actions, never by hand.
create table audit_log (
  id        bigserial primary key,
  actor_id  uuid references profiles(id) on delete set null,
  action    text not null,
  entity    text not null,
  entity_id text,
  before    jsonb,
  after     jsonb,
  at        timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity, entity_id);
```

- [ ] **Step 4: Generate the seed from `lib/pricing.ts`**

The repository already has this pattern on the `mobile-app` branch, where `scripts/filter-golden.mjs` generates a fixture from live code and the test suite fails until it is regenerated. It is not on this branch, so treat it as precedent rather than something to read. `PLANS` stays the single definition of a plan; the SQL is generated from it, so the two cannot drift and nobody hand-copies prices.

```js
// scripts/plans-seed.mjs
/* Generates supabase/seed.sql from PLANS in lib/pricing.ts. Run it after any
   change to a plan; test/plans-seed.test.ts fails until you do. */
import { writeFileSync } from "node:fs";
import { PLANS } from "../lib/pricing.ts";
import { STREAMING_MONTHLY_DEFAULT } from "../lib/rates.ts";

const json = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;
const text = (v) => `'${String(v).replace(/'/g, "''")}'`;

const rows = PLANS.map(
  (p, i) =>
    `(${text(p.id)}, ${text(p.name)}, ${Math.round(p.monthly * 100)}, ` +
    `${p.maxM2 === null ? "null" : p.maxM2}, ${json(p.tagline)}, ${json(p.features)}, ${i + 1}, true)`,
).join(",\n");

writeFileSync(
  new URL("../supabase/seed.sql", import.meta.url),
  `-- GENERATED by scripts/plans-seed.mjs - do not edit by hand.
insert into plans (id, name, monthly_ore, max_m2, tagline, features, sort, active) values
${rows}
on conflict (id) do nothing;

insert into addons (id, name, monthly_ore, active) values
('streaming', '{"da":"Streaming","en":"Streaming"}', ${STREAMING_MONTHLY_DEFAULT * 100}, true)
on conflict (id) do nothing;
`,
);
```

Run it:

```bash
node scripts/plans-seed.mjs
```

- [ ] **Step 4b: Add the golden test that keeps them in sync**

```ts
// test/plans-seed.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { PLANS } from "../lib/pricing.ts";

test("the committed seed matches lib/pricing.ts", () => {
  const url = new URL("../supabase/seed.sql", import.meta.url);
  const before = readFileSync(url, "utf8");
  execFileSync("node", ["scripts/plans-seed.mjs"], { cwd: process.cwd() });
  assert.equal(
    readFileSync(url, "utf8"),
    before,
    "supabase/seed.sql is stale - run `node scripts/plans-seed.mjs` and commit the result",
  );
});

test("every plan's price survives the round trip to øre", () => {
  for (const p of PLANS) {
    assert.equal(Math.round(p.monthly * 100) / 100, p.monthly, p.id);
  }
});
```

Run `npm test` — PASS.

- [ ] **Step 5: Apply and run the tests**

```bash
npx supabase db reset
npm run test:db
```

Expected: PASS. If `results_eq` fails, the seed does not match `lib/pricing.ts` — fix the seed, not the test.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_commerce.sql scripts/plans-seed.mjs supabase/seed.sql supabase/tests/commerce.test.sql test/plans-seed.test.ts
git commit
```

Message: `Move the plans into the database without changing them`, explaining that plan ids match `PlanId` so the two cannot drift, that money is integer øre, and that `invoices.source` exists so a seeded row can never be read as revenue.

---

### Task 4: Tenancy — row-level security, written test-first

This is the security boundary of a multi-tenant system. **Write the tests before the policies.** A policy that silently allows everything passes every test you write afterwards, because you will unconsciously write tests that match what you built.

**Files:**
- Create: `supabase/migrations/0003_tenancy.sql`
- Test: `supabase/tests/tenancy.test.sql`

**Interfaces:**
- Consumes: every table from Tasks 2 and 3.
- Produces: SQL functions `auth_customer_id() -> uuid` and `is_staff() -> boolean`; RLS enabled on all tenant tables. Every later task depends on these being correct.

- [ ] **Step 1: Write the failing isolation tests**

```sql
-- supabase/tests/tenancy.test.sql
begin;
select plan(8);

-- Two customers, one user each, plus one member of staff.
insert into customers (id, name, billing_email) values
  ('11111111-1111-1111-1111-111111111111', 'Café A', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'Café B', 'b@example.test');

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'owner-b@example.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'staff@odatone.test');

insert into profiles (id, customer_id, role, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'Owner A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', 'Owner B'),
  ('cccccccc-0000-0000-0000-000000000003', null, 'staff_admin', 'Staff');

insert into locations (customer_id, name, venue_type, m2) values
  ('11111111-1111-1111-1111-111111111111', 'A Main', 'cafe', 80),
  ('22222222-2222-2222-2222-222222222222', 'B Main', 'cafe', 90);

-- Owner A --------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from customers),
  1,
  'owner A sees exactly one customer — their own'
);

select is(
  (select count(*)::int from locations),
  1,
  'owner A sees only their own location'
);

select is(
  (select count(*)::int from customers where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'owner A cannot read customer B even by id'
);

-- A denied UPDATE is not an error under RLS; it simply matches no rows. So the
-- assertion is on the row count affected, which is the behaviour that matters.
with attempted as (
  update customers set name = 'Hijacked'
  where id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'owner A cannot update customer B');

with attempted as (
  delete from locations
  where customer_id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'owner A cannot delete customer B''s locations');

-- Staff ----------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from customers), 2, 'staff see every customer');

-- Anonymous ------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select is(
  (select count(*)::int from plans where active),
  3,
  'the pricing page can read active plans without a session'
);

select is((select count(*)::int from customers), 0, 'anonymous readers see no customers');

select * from finish();
rollback;
```

- [ ] **Step 2: Run and watch them fail**

Run: `npm run test:db`
Expected: FAIL. Without RLS every count returns *every* row, so the isolation assertions fail. **Confirm the failures are the isolation ones** — if they pass now, the test is not testing anything.

- [ ] **Step 3: Write the policies**

```sql
-- supabase/migrations/0003_tenancy.sql

/* SECURITY DEFINER is not optional. A policy on profiles that selects from
   profiles re-enters the policy and recurses; running the lookup as the
   definer breaks that cycle. search_path is pinned because a SECURITY DEFINER
   function with a mutable search_path is a privilege-escalation hole. */
create or replace function auth_customer_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
as $$ select customer_id from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('staff_admin', 'staff_support')
  )
$$;

alter table customers           enable row level security;
alter table locations           enable row level security;
alter table profiles            enable row level security;
alter table plans               enable row level security;
alter table addons              enable row level security;
alter table subscriptions       enable row level security;
alter table subscription_addons enable row level security;
alter table invoices            enable row level security;
alter table audit_log           enable row level security;

-- customers ------------------------------------------------------------
create policy customers_read on customers for select
  using (id = auth_customer_id() or is_staff());

create policy customers_staff_write on customers for all
  using (is_staff()) with check (is_staff());

-- An owner may correct their own company details; a manager may not.
create policy customers_owner_update on customers for update
  using (
    id = auth_customer_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  )
  with check (id = auth_customer_id());

-- locations ------------------------------------------------------------
create policy locations_read on locations for select
  using (customer_id = auth_customer_id() or is_staff());

create policy locations_staff_write on locations for all
  using (is_staff()) with check (is_staff());

create policy locations_owner_write on locations for all
  using (
    customer_id = auth_customer_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  )
  with check (customer_id = auth_customer_id());

-- profiles -------------------------------------------------------------
create policy profiles_read_own on profiles for select
  using (id = auth.uid() or is_staff());

-- Only staff change roles. Without this a manager could promote themselves.
create policy profiles_staff_write on profiles for all
  using (is_staff()) with check (is_staff());

-- subscriptions, addons on them, invoices ------------------------------
create policy subscriptions_read on subscriptions for select
  using (customer_id = auth_customer_id() or is_staff());

create policy subscriptions_staff_write on subscriptions for all
  using (is_staff()) with check (is_staff());

create policy subscription_addons_read on subscription_addons for select
  using (exists (
    select 1 from subscriptions s
    where s.id = subscription_id and (s.customer_id = auth_customer_id() or is_staff())
  ));

create policy subscription_addons_staff_write on subscription_addons for all
  using (is_staff()) with check (is_staff());

create policy invoices_read on invoices for select
  using (customer_id = auth_customer_id() or is_staff());

create policy invoices_staff_write on invoices for all
  using (is_staff()) with check (is_staff());

-- plans and addons -----------------------------------------------------
/* Anonymous read of active rows is deliberate: the public pricing page is
   prerendered without a session and must still see prices. */
create policy plans_public_read on plans for select
  using (active or is_staff());

create policy plans_admin_write on plans for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'));

create policy addons_public_read on addons for select
  using (active or is_staff());

create policy addons_admin_write on addons for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'));

-- audit_log ------------------------------------------------------------
-- Readable by staff, writable by nobody through the API. Rows arrive via
-- server actions running as the service role, so the record cannot be edited
-- by the person it is recording.
create policy audit_read on audit_log for select using (is_staff());
```

- [ ] **Step 4: Run the tests**

```bash
npx supabase db reset
npm run test:db
```

Expected: PASS — 8 tenancy assertions plus the earlier suites.

- [ ] **Step 5: Prove the tests can still fail**

Temporarily change `customers_read` to `using (true)`, re-run `npm run test:db`, and confirm the isolation assertions fail. **Revert it.** A security test you have never seen fail is not evidence of anything.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_tenancy.sql supabase/tests/tenancy.test.sql
git commit
```

Message: `Make tenant isolation something we have tested`, explaining that the helpers must be `SECURITY DEFINER` with a pinned `search_path` or a policy on profiles recurses, that a denied UPDATE matches no rows rather than raising, and that the policies were verified by watching the tests fail with them removed.

---

### Task 5: Money in øre

`quote()` in `lib/pricing.ts` works in kroner and rounds with `round2`. It is not changed — the marketing site depends on its exact output, and Task 6 asserts that. This task adds the integer layer that invoices and stored prices need.

**Files:**
- Create: `lib/money.ts`
- Test: `test/money.test.ts`

**Interfaces:**
- Consumes: `VAT_PCT` from `lib/pricing.ts`.
- Produces: `toOre(kroner: number): number`, `toKroner(ore: number): number`, `vatOre(subtotalOre: number): number`, `invoiceTotals(subtotalOre: number): { subtotalOre: number; vatOre: number; totalOre: number }`, `formatDkk(ore: number, locale: Locale): string`. Tasks 6, 10, 11, 12 and 13 use them.

- [ ] **Step 1: Write the failing test**

```ts
// test/money.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { toOre, toKroner, vatOre, invoiceTotals, formatDkk } from "../lib/money.ts";

test("converts kroner to øre without float drift", () => {
  assert.equal(toOre(149), 14900);
  assert.equal(toOre(199.99), 19999);
  // 0.1 + 0.2 territory: 8.115 * 100 is 811.4999... in binary floating point.
  assert.equal(toOre(8.115), 812);
});

test("converts back", () => {
  assert.equal(toKroner(14900), 149);
});

test("VAT is 25 percent, rounded to whole øre", () => {
  assert.equal(vatOre(14900), 3725);
  assert.equal(vatOre(1), 0);
  assert.equal(vatOre(2), 1);
});

test("invoice totals always add up", () => {
  const t = invoiceTotals(14900);
  assert.equal(t.subtotalOre + t.vatOre, t.totalOre);
});

test("invoice totals add up for every awkward subtotal", () => {
  for (let subtotal = 0; subtotal < 5000; subtotal += 7) {
    const t = invoiceTotals(subtotal);
    assert.equal(t.subtotalOre + t.vatOre, t.totalOre, `subtotal ${subtotal}`);
  }
});

test("formats Danish and English", () => {
  assert.match(formatDkk(14900, "da"), /149/);
  assert.match(formatDkk(14900, "en"), /149/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/money.ts'`

- [ ] **Step 3: Implement**

```ts
// lib/money.ts
import { VAT_PCT } from "./pricing.ts";
import type { Locale } from "./i18n";

/* Money is integer øre everywhere it is stored or added up. Kroner exist only
   at the two edges: the pricing maths in lib/pricing.ts, which predates this
   and the marketing site depends on, and the strings people read. */

/** Rounds half away from zero. Math.round(-0.5) is -0, which would make a
    credit note off by an øre. */
const round = (n: number): number => (n < 0 ? -Math.round(-n) : Math.round(n));

export function toOre(kroner: number): number {
  /* toFixed before multiplying: 8.115 * 100 is 811.4999999999999 in binary
     floating point, which rounds down to the wrong answer. */
  return round(Number((kroner * 100).toFixed(4)));
}

export function toKroner(ore: number): number {
  return ore / 100;
}

export function vatOre(subtotalOre: number): number {
  return round((subtotalOre * VAT_PCT) / 100);
}

/** The total is derived, never independently rounded — that is how an invoice
    ends up a øre short of the sum of its own lines. */
export function invoiceTotals(subtotalOre: number) {
  const vat = vatOre(subtotalOre);
  return { subtotalOre, vatOre: vat, totalOre: subtotalOre + vat };
}

export function formatDkk(ore: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: ore % 100 === 0 ? 0 : 2,
  }).format(toKroner(ore));
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, six new tests.

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts test/money.test.ts
git commit
```

Message: `Count money in whole øre`, explaining that kroner survive only at the edges, why `toFixed` precedes the multiply, and that the total is derived rather than rounded separately so an invoice never disagrees with the sum of its lines.

---

### Task 6: Serve plans from the database, provably unchanged

Task 3 made the seed generated and guarded by a golden test. This task makes the running site read the database rather than the constant, without changing a single number a visitor sees.

**Files:**
- Create: `lib/plans-server.ts`
- Modify: `components/pages/PricingPage.tsx`

**Interfaces:**
- Consumes: `createClient` (Task 7), `plans` table (Task 3), `toKroner` (Task 5).
- Produces: `PLANS_TAG = "plans"`, `activePlans(): Promise<Plan[]>`, `planById(id: PlanId): Promise<Plan>`, `revalidatePlans(): void`. Tasks 10, 11 and 12 use them.

> **Do Task 7 before this one.** This task consumes `createClient`, which Task 7 produces. Execution order is 1, 2, 3, 4, 5, 7, 6, 8 … 15.

- [ ] **Step 1: Write the cached reader**

This mirrors `lib/copy-server.ts` deliberately — same `unstable_cache` + tag shape, so the codebase has one caching pattern rather than two.

- [ ] **Step 2: Point the pricing page at it**

In `components/pages/PricingPage.tsx` (and anywhere else importing `PLANS` for display), replace the static import with `await activePlans()`. **Do not change `quote()`, `volumeTier()` or `planForM2()`** — the arithmetic stays where it is.

- [ ] **Step 3: Verify the public site is byte-identical**

```bash
npm run build
```

Expected: the build output still lists the marketing routes as prerendered (`○`), not dynamic (`ƒ`). If any became dynamic, the cache wrapper is not covering a read. Then open `/da/priser` and `/en/pricing` and confirm the three prices read 149, 199 and 249.

- [ ] **Step 4: Commit**

```bash
git add lib/plans-server.ts components/pages/PricingPage.tsx
git commit
```

Message: `Read plan prices from the database without moving the maths`, explaining that `PLANS` remains the single definition and the seed is generated from it, that the cached read keeps 25 pages prerendered, and that an unreachable database falls back to the compiled-in plans rather than showing a visitor no prices.

---

### Task 7: Session refresh and route gating in proxy.ts

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `lib/tenancy.ts`
- Test: `test/tenancy.test.ts`

**Interfaces:**
- Consumes: `resolveSupabaseEnv`, `resolveServiceKey` (Task 1).
- Produces: `createClient()` (server), `createBrowserClient()`, `createAdminClient()`, `updateSession(request)`, and from `lib/tenancy.ts`: `type Role`, `isStaffRole(role)`, `isCustomerRole(role)`, `landingFor(role)`. Tasks 9–15 use them.

- [ ] **Step 1: Write the failing test for the pure part**

```ts
// test/tenancy.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { isStaffRole, isCustomerRole, landingFor } from "../lib/tenancy.ts";

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
```

Run `npm test` — FAIL, module missing.

- [ ] **Step 2: Implement the pure part**

```ts
// lib/tenancy.ts
export type Role = "owner" | "manager" | "staff_admin" | "staff_support";

const STAFF: Role[] = ["staff_admin", "staff_support"];

export const isStaffRole = (role: Role): boolean => STAFF.includes(role);
export const isCustomerRole = (role: Role): boolean => !isStaffRole(role);
export const landingFor = (role: Role): string => (isStaffRole(role) ? "/admin" : "/my-odatone");
```

Run `npm test` — PASS.

- [ ] **Step 3: Write the three clients**

```ts
// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseEnv } from "./env";

/** A new client per request. Never share one across requests: the cache headers
    that keep a Set-Cookie response out of the CDN are delivered only with the
    first cookie write. */
export async function createClient() {
  const env = resolveSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const store = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Components cannot write cookies. proxy.ts refreshes the
             session, so this is safe to swallow — and only here. */
        }
      },
    },
  });
}
```

```ts
// lib/supabase/client.ts
"use client";
import { createBrowserClient as create } from "@supabase/ssr";
import { resolveSupabaseEnv } from "./env";

export function createBrowserClient() {
  const env = resolveSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!env) throw new Error("Supabase is not configured");
  return create(env.url, env.anonKey);
}
```

Read the two variables by their full literal names — Next inlines `process.env.NEXT_PUBLIC_*` at build time only when it can see the whole expression, so a dynamic lookup yields `undefined` in the browser.

```ts
// lib/supabase/admin.ts
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { resolveSupabaseEnv, resolveServiceKey } from "./env";

/* Bypasses RLS. The ONLY legitimate caller is signup, where an anonymous
   visitor must create a customer and so has no session to authorise against.
   The "server-only" import above turns any client-component import of this
   file into a build error. */
export function createAdminClient() {
  const env = resolveSupabaseEnv();
  const key = resolveServiceKey();
  if (!env || !key) throw new Error("Supabase service role is not configured");
  return createSupabaseClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

```bash
npm install server-only
```

- [ ] **Step 4: Write the session refresh helper**

```ts
// lib/supabase/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseEnv } from "./env";
import { isStaffRole, type Role } from "../tenancy";

const ADMIN = "/admin";
const PORTAL = "/my-odatone";
const PUBLIC = [`${ADMIN}/login`, `${PORTAL}/login`];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = resolveSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        /* Without these, Vercel's CDN may cache a response carrying Set-Cookie
           and hand one customer's session token to the next visitor. */
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  /* getClaims, not getSession: getSession reads the cookie without verifying
     its signature. Called here, before any response is generated, so a refresh
     completing later is not lost. */
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const guarded = path.startsWith(ADMIN) || path.startsWith(PORTAL);

  if (!guarded || PUBLIC.some((p) => path.startsWith(p))) return response;

  if (!data?.claims?.sub) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith(ADMIN) ? `${ADMIN}/login` : `${PORTAL}/login`;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.claims.sub).single();

  const role = profile?.role as Role | undefined;
  const staffArea = path.startsWith(ADMIN);

  /* A customer who finds /admin gets 404, not 403. There is no reason to
     confirm the backend exists. */
  if (!role || (staffArea && !isStaffRole(role)) || (!staffArea && isStaffRole(role))) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  return response;
}
```

- [ ] **Step 5: Write proxy.ts**

```ts
// proxy.ts  — Next 16 renamed middleware.ts to proxy.ts; the export is `proxy`.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/my-odatone/:path*"],
};
```

The matcher covers only the two portals, so the 25 marketing pages keep prerendering untouched.

- [ ] **Step 6: Verify**

```bash
npm run build     # must not warn about middleware.ts
npm run dev
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin
```

Expected: `307` to `/admin/login?next=/admin`. Confirm the build still marks the marketing routes prerendered.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/ lib/tenancy.ts proxy.ts test/tenancy.test.ts package.json package-lock.json
git commit
```

Message: `Refresh sessions and gate the two portals in proxy.ts`, noting the Next 16 rename, that `getClaims` verifies the signature where `getSession` does not, that the cache headers handed to `setAll` must be applied or the CDN can leak a session, and that the wrong audience gets 404 rather than 403.

---

### Task 8: The admin shell and its design tokens

Structure comes from the reference artifact (dark frame around a rounded panel); colour comes from the tokens already in `app/globals.css`. The artifact's blue accent and 12px radii are **not** carried over.

**Files:**
- Modify: `app/globals.css`
- Create: `components/admin/AppShell.tsx`, `SideNav.tsx`, `TopBar.tsx`, `Kpi.tsx`, `TableCard.tsx`, `Meter.tsx`, `Badge.tsx`, `EmptyState.tsx`, `lib/meter.ts`
- Test: `test/meter.test.ts`

**Interfaces:**
- Consumes: `formatDkk` (Task 5).
- Produces: `meterSegments(used: number, limit: number | null): { inPct: number; overPct: number }`; the components above. Tasks 9–14 render them.

- [ ] **Step 1: Write the failing test for the meter maths**

```ts
// test/meter.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { meterSegments } from "../lib/meter.ts";

test("under the limit fills proportionally", () => {
  assert.deepEqual(meterSegments(50, 100), { inPct: 50, overPct: 0 });
});

test("at the limit is full but not over", () => {
  assert.deepEqual(meterSegments(100, 100), { inPct: 100, overPct: 0 });
});

test("over the limit splits into in and over", () => {
  // 150 of a 100 limit: the bar is the whole 150, two thirds within.
  assert.deepEqual(meterSegments(150, 100), { inPct: 67, overPct: 33 });
});

test("an unbounded plan is never over", () => {
  assert.deepEqual(meterSegments(5000, null), { inPct: 100, overPct: 0 });
});

test("zero and nonsense do not produce NaN", () => {
  assert.deepEqual(meterSegments(0, 100), { inPct: 0, overPct: 0 });
  assert.deepEqual(meterSegments(50, 0), { inPct: 0, overPct: 100 });
});
```

Run `npm test` — FAIL.

- [ ] **Step 2: Implement**

```ts
// lib/meter.ts
/** Splits a usage bar into the part within the plan's bound and the part past
    it. Percentages are of the whole bar, so they always sum to 0 or 100 and a
    caller can render them as two flexed segments. */
export function meterSegments(used: number, limit: number | null) {
  if (limit === null) return { inPct: used > 0 ? 100 : 0, overPct: 0 };
  if (limit <= 0) return { inPct: 0, overPct: used > 0 ? 100 : 0 };
  if (used <= 0) return { inPct: 0, overPct: 0 };
  if (used <= limit) return { inPct: Math.round((used / limit) * 100), overPct: 0 };
  const inPct = Math.round((limit / used) * 100);
  return { inPct, overPct: 100 - inPct };
}
```

Run `npm test` — PASS.

- [ ] **Step 3: Add the two missing status tokens**

`app/globals.css` defines `--c-warn` but no success or danger colour. Add them beside it in **both** themes, matching the existing block's structure — do not invent a new one:

```css
/* light */
--c-ok:  #1d8448;
--c-ok-soft:  rgba(29, 132, 72, 0.10);
--c-bad: #c23b3b;
--c-bad-soft: rgba(194, 59, 59, 0.10);

/* dark */
--c-ok:  #56c587;
--c-ok-soft:  rgba(86, 197, 135, 0.13);
--c-bad: #f27d7d;
--c-bad-soft: rgba(242, 125, 125, 0.13);
```

Then expose them to Tailwind alongside the existing `--color-*` aliases:

```css
--color-ok: var(--c-ok);
--color-ok-soft: var(--c-ok-soft);
--color-bad: var(--c-bad);
--color-bad-soft: var(--c-bad-soft);
```

- [ ] **Step 4: Build the shell**

`AppShell` is a grid of a fixed 248px frame and a rounded panel, collapsing to a top bar with a drawer below 900px. Use Tailwind classes against the tokens (`bg-surface`, `text-ink-2`, `border-line`, `rounded-[var(--radius-md)]`). The frame uses the dark surface tokens in both themes — it is chrome, not content.

```tsx
// components/admin/AppShell.tsx
export function AppShell({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid h-dvh grid-cols-[248px_minmax(0,1fr)] max-[900px]:grid-cols-1">
      <nav className="flex min-h-0 flex-col gap-1 overflow-auto bg-[#0b0b0c] p-3 pt-4 text-[#a1a1a6] max-[900px]:hidden">
        {nav}
      </nav>
      <main className="m-2 ml-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] bg-surface max-[900px]:m-2">
        {children}
      </main>
    </div>
  );
}
```

`Kpi` renders a label and a value at 28px/600 with `tabular-nums`. `Badge` maps a status to `ok` / `warn` / `bad` / neutral using the tokens from Step 3. `TableCard` wraps a `<table>` in a bordered card with an overflow-x scroller and a `min-w-[700px]` table, so a wide table scrolls rather than crushing its columns. `Meter` renders the two segments from `meterSegments` — `--c-accent` within the bound, `--c-warn` past it. `EmptyState` centres a card on a dotted canvas.

- [ ] **Step 5: Check both themes**

Run the app and view `/admin` in light and dark. The frame stays dark in both; the panel follows the theme. Nothing may hard-code a hex outside Step 3's tokens.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/admin/ lib/meter.ts test/meter.test.ts
git commit
```

Message: `Give the portals a shell built from Odatone's own tokens`, explaining that structure came from the reference design but colour did not, and that `--c-ok` and `--c-bad` were added to the token set rather than hard-coded into badges.

---

### Task 9: Staff login

**Files:**
- Create: `app/admin/login/page.tsx`, `app/admin/login/actions.ts`, `app/admin/layout.tsx`
- Test: manual, plus the gating check from Task 7

**Interfaces:**
- Consumes: `createClient` (Task 7), `landingFor` (Task 7), `Button`/`Field` from `components/ui`.
- Produces: `signIn(formData): Promise<{ error?: string }>`, `signOut(): Promise<void>`.

- [ ] **Step 1: Write the server actions**

```ts
// app/admin/login/actions.ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { landingFor, type Role } from "@/lib/tenancy";

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  /* One message for a wrong password and an unknown address alike: telling them
     apart turns the form into a way to discover who has an account. */
  if (error || !data.user) return { error: "invalid" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();
  if (!profile) return { error: "invalid" };

  redirect(landingFor(profile.role as Role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 2: Build the form**

A client component using `useActionState(signIn, {})`, reusing `components/ui/Field.tsx` and `Button.tsx`. On `error === "invalid"` show one message: *"That email and password don't match."* English only. Centre it on the dotted canvas from Task 8; no sidebar on this route.

- [ ] **Step 3: Seed a staff account to test with**

```bash
npx supabase db reset
```

Then in Supabase Studio (`http://localhost:54323`) create a user, and insert the profile:

```sql
insert into profiles (id, customer_id, role, full_name)
values ('<the new auth user id>', null, 'staff_admin', 'Test Staff');
```

- [ ] **Step 4: Verify by hand**

Sign in with the wrong password (one generic message), then the right one (lands on `/admin`). Visit `/admin` in a private window and confirm the redirect to `/admin/login?next=/admin`. Sign in as a **customer** user and confirm `/admin` renders 404, not a permission error.

- [ ] **Step 5: Commit**

```bash
git add app/admin/
git commit
```

Message: `Let staff sign in`, explaining that a wrong password and an unknown address return the same message so the form cannot be used to enumerate accounts.

---

### Task 10: The dashboard

**Files:**
- Create: `app/admin/page.tsx`, `lib/admin/stats.ts`
- Test: `test/admin-stats.test.ts`

**Interfaces:**
- Consumes: `quote` (`lib/pricing.ts`), `toOre` (Task 5), `activePlans` (Task 6).
- Produces: `mrrOre(subscriptions: SubscriptionForMrr[]): number` where `type SubscriptionForMrr = { planId: PlanId; billing: Billing; locations: number; status: SubscriptionStatus }`. Task 11 reuses it per customer.

- [ ] **Step 1: Write the failing test**

```ts
// test/admin-stats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { mrrOre } from "../lib/admin/stats.ts";
import { quote } from "../lib/pricing.ts";
import { toOre } from "../lib/money.ts";

test("monthly recurring revenue uses the shared quote maths", () => {
  const subs = [{ planId: "small" as const, billing: "monthly" as const, locations: 1, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote("small", "monthly", 1).monthlyExVat));
});

test("an annual subscription contributes its monthly equivalent", () => {
  const subs = [{ planId: "main" as const, billing: "annual" as const, locations: 3, status: "active" as const }];
  assert.equal(mrrOre(subs), toOre(quote("main", "annual", 3).monthlyExVat));
});

test("only active and trialing subscriptions count", () => {
  const base = { planId: "small" as const, billing: "monthly" as const, locations: 1 };
  assert.equal(mrrOre([{ ...base, status: "cancelled" as const }]), 0);
  assert.equal(mrrOre([{ ...base, status: "pending" as const }]), 0);
  assert.ok(mrrOre([{ ...base, status: "trialing" as const }]) > 0);
});

test("no subscriptions is zero, not NaN", () => {
  assert.equal(mrrOre([]), 0);
});
```

- [ ] **Step 2: Run it and watch it fail**, then implement:

```ts
// lib/admin/stats.ts
import { quote, type Billing, type PlanId } from "../pricing.ts";
import { toOre } from "../money.ts";

export type SubscriptionStatus = "pending" | "trialing" | "active" | "past_due" | "cancelled";
export type SubscriptionForMrr = {
  planId: PlanId; billing: Billing; locations: number; status: SubscriptionStatus;
};

const EARNING: SubscriptionStatus[] = ["active", "trialing", "past_due"];

/* Normalised to a month so an annual customer is comparable to a monthly one,
   and computed with the same quote() the pricing page uses — two implementations
   of this arithmetic would disagree the first time a discount changed. */
export function mrrOre(subs: SubscriptionForMrr[]): number {
  return subs
    .filter((s) => EARNING.includes(s.status))
    .reduce((sum, s) => sum + toOre(quote(s.planId, s.billing, s.locations).monthlyExVat), 0);
}
```

Run `npm test` — PASS.

- [ ] **Step 3: Build the page**

A server component reading counts and subscriptions through `createClient()`. Four `Kpi` tiles: customers, active subscriptions, MRR (`formatDkk(mrrOre(...), "en")`), and pending signups. Pending signups uses the `warn` variant and links to `/admin/customers?status=pending`. Below, the five most recent customers in a `TableCard`.

- [ ] **Step 4: Verify**

With an empty database every tile reads 0 and the table shows the empty state — not a crash. Add a customer in Studio and confirm the counts move.

- [ ] **Step 5: Commit**

Message: `Show the shape of the business on one screen`, explaining that MRR normalises annual terms to a month and reuses `quote()` so admin and the pricing page cannot disagree.

---

### Task 11: Customers — list and detail

**Files:**
- Create: `app/admin/customers/page.tsx`, `app/admin/customers/[id]/page.tsx`, `lib/admin/customers.ts`
- Test: `test/admin-customers.test.ts`

**Interfaces:**
- Consumes: `mrrOre` (Task 10), `meterSegments` (Task 8), `planById` (Task 6), `formatDkk` and `invoiceTotals` (Task 5).
- Produces: `customerRows(raw: RawCustomer[]): CustomerRow[]` and `locationFit(m2: number, maxM2: number | null): "within" | "over"`.

- [ ] **Step 1: Write the failing test**

```ts
// test/admin-customers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { locationFit } from "../lib/admin/customers.ts";

test("a location inside the plan's bound fits", () => {
  assert.equal(locationFit(80, 100), "within");
  assert.equal(locationFit(100, 100), "within");
});

test("a location past the bound is over", () => {
  assert.equal(locationFit(101, 100), "over");
});

test("an unbounded plan always fits", () => {
  assert.equal(locationFit(9000, null), "within");
});
```

Run `npm test` — FAIL, then implement `locationFit` in `lib/admin/customers.ts`:

```ts
export function locationFit(m2: number, maxM2: number | null): "within" | "over" {
  return maxM2 === null || m2 <= maxM2 ? "within" : "over";
}
```

Run `npm test` — PASS.

- [ ] **Step 2: Build the list**

A `TableCard` of company, CVR (mono), locations, plan, status `Badge`, and MRR right-aligned with `tabular-nums`. Rows link to the detail page. A status filter reads `?status=` so the dashboard's pending-signups tile can link straight into it. Empty database shows the `EmptyState`, not a blank table.

- [ ] **Step 3: Build the detail page**

Sections: the customer's details; its locations, each with a `Meter` of `m2` against the plan's `maxM2` and an `over` badge where `locationFit` says so; its users and roles; its subscription; and its invoices.

**Invoices in this slice are seeded.** Render a plain notice above the table — *"Seeded data. Billing arrives with Stripe."* — driven by `source === 'seed'`, so nobody mistakes the figures for revenue.

- [ ] **Step 4: Seed the invoices this page renders**

Nothing creates invoices yet, so without this the table is permanently empty and `invoiceTotals` from Task 5 has no caller. A dev-only script gives every active customer twelve months of plausible history, computed with the shared maths rather than typed in.

```js
// scripts/seed-invoices.mjs
/* Development data only. Every row is written with source = 'seed' so slice 4
   can find and replace them, and so nobody reads these totals as revenue. */
import { createClient } from "@supabase/supabase-js";
import { quote } from "../lib/pricing.ts";
import { toOre, invoiceTotals } from "../lib/money.ts";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: subs } = await db
  .from("subscriptions")
  .select("customer_id, plan_id, billing, status")
  .in("status", ["active", "trialing", "past_due"]);

for (const sub of subs ?? []) {
  const { count } = await db
    .from("locations").select("*", { count: "exact", head: true })
    .eq("customer_id", sub.customer_id);

  const subtotal = toOre(quote(sub.plan_id, sub.billing, count ?? 1).monthlyExVat);
  const totals = invoiceTotals(subtotal);

  for (let month = 11; month >= 0; month--) {
    const issued = new Date();
    issued.setMonth(issued.getMonth() - month, 1);
    await db.from("invoices").insert({
      customer_id: sub.customer_id,
      number: `SEED-${sub.customer_id.slice(0, 8)}-${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}`,
      issued_at: issued.toISOString(),
      period_start: issued.toISOString().slice(0, 10),
      subtotal_ore: totals.subtotalOre,
      vat_ore: totals.vatOre,
      total_ore: totals.totalOre,
      status: month === 0 ? "open" : "paid",
      source: "seed",
    });
  }
}
```

Run it, then confirm on a customer's page that the totals add up and every row is labelled seeded:

```bash
node --env-file=.env.local scripts/seed-invoices.mjs
```

- [ ] **Step 5: Verify with a customer over its plan**

Insert a customer on `small` (100 m²) with a 140 m² location. The meter must show two segments and the badge must read over. This is the upsell case the layout exists for.

- [ ] **Step 6: Commit**

Message: `Show a customer and whether their venues still fit their plan`, explaining that the meter makes outgrowing a plan visible, and that seeded invoices are labelled so nobody reads them as revenue.

---

### Task 12: Products — editing a plan changes the public site

**Files:**
- Create: `app/admin/products/page.tsx`, `app/admin/products/actions.ts`
- Create: `supabase/migrations/0004_audit_triggers.sql`

**Interfaces:**
- Consumes: `activePlans`, `revalidatePlans`, `PLANS_TAG` (Task 6), `toOre` (Task 5).
- Produces: `updatePlan(formData): Promise<{ error?: string }>`.

- [ ] **Step 1: Write the audit trigger**

```sql
-- supabase/migrations/0004_audit_triggers.sql
create or replace function log_plan_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_op, 'plan', coalesce(new.id, old.id),
          to_jsonb(old), to_jsonb(new));
  return new;
end $$;

create trigger plans_audit
  after insert or update or delete on plans
  for each row execute function log_plan_change();
```

- [ ] **Step 2: Write the server action**

```ts
// app/admin/products/actions.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePlans } from "@/lib/plans-server";
import { toOre } from "@/lib/money";

export async function updatePlan(_prev: unknown, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const monthly = Number(formData.get("monthly"));
  const maxM2raw = String(formData.get("maxM2") ?? "").trim();

  if (!id) return { error: "missing-id" };
  if (!Number.isFinite(monthly) || monthly < 0) return { error: "price" };

  const supabase = await createClient();
  /* No service role here: the staff_admin policy from Task 4 is what authorises
     this, so a staff_support account is refused by the database rather than by
     a check in this file that someone could forget to write. */
  const { error } = await supabase
    .from("plans")
    .update({
      monthly_ore: toOre(monthly),
      max_m2: maxM2raw === "" ? null : Number(maxM2raw),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "save" };

  revalidatePlans();
  return {};
}
```

- [ ] **Step 3: Build the editor**

One card per plan: name, price in kroner (converted to øre on save), m² bound (blank = unbounded), tagline and features in both languages, active toggle. Show the add-on in the same shape. Include a plain line of warning above the form: *"These prices are live on odatone.com."* — because they now are.

- [ ] **Step 4: Verify the loop end to end**

1. Open `/da/priser` and note the Small Venue price.
2. In `/admin/products` change it to 159 and save.
3. Reload `/da/priser` — it reads 159 without a deploy.
4. `select * from audit_log order by at desc limit 1;` shows the before and after.
5. Set it back to 149.

**The golden test is not affected by any of this**, and must not be expected to fail: it compares `supabase/seed.sql` to `PLANS`, which are both repository files. Editing a row in the database touches neither.

The hazard runs the other way, and it is worth writing down. `npx supabase db reset` re-applies `seed.sql`, so a live price edited in admin is **silently reverted to the seeded value** on the next reset. The seed is a bootstrap; the database is the live value. Record that in `README.md` under the admin section, because the next person to reset a local database while testing will otherwise lose a change and not know why.

- [ ] **Step 5: Verify a staff_support account cannot save**

Sign in as `staff_support` and submit the form. The database must refuse it. If the save succeeds, the `plans_admin_write` policy is wrong — fix the policy, not the UI.

- [ ] **Step 6: Commit**

Message: `Let staff change a price without a deploy`, explaining that authorisation is the RLS policy rather than a check in the action, that every change is audited, and that the golden test diverging afterwards is expected because the seed is a bootstrap and the database is live.

---

### Task 13: Signup stops throwing customers away

**Files:**
- Modify: `app/actions.ts`
- Create: `lib/signup.ts`
- Test: `test/signup.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` (Task 7), `VenueProfile` (`lib/profile.ts`), `toOre` (Task 5).
- Produces: `buildSignup(formData: FormData): { ok: true; value: SignupInput } | { ok: false; errors: FieldErrors }`.

- [ ] **Step 1: Write the failing test for the pure part**

```ts
// test/signup.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSignup } from "../lib/signup.ts";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const VALID = {
  name: "Jens Hansen", company: "Café Nord", email: "jens@nord.test",
  plan: "small", billing: "monthly", locations: "1", m2: "80", venueType: "cafe",
};

test("accepts a complete signup", () => {
  const r = buildSignup(form(VALID));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.customer.name, "Café Nord");
    assert.equal(r.value.locations.length, 1);
    assert.equal(r.value.locations[0].m2, 80);
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
```

- [ ] **Step 2: Run it, watch it fail, then implement `lib/signup.ts`**

It validates with `EMAIL_RE` from `lib/forms.ts`, checks `plan` against `PlanId`, clamps `locations` to at least 1, and returns a plain object. **No price ever comes from the form** — it is looked up from the plan on the server. Keep the same `ActionResult`/`FieldErrors` shape the UI already expects, so `components/signup/SignupFlow.tsx` needs no change.

- [ ] **Step 3: Persist and invite**

```ts
// in app/actions.ts — submitSignup
const built = buildSignup(formData);
if (!built.ok) return { ok: false, errors: built.errors };

/* The service role is required here and only here: an anonymous visitor has no
   session for RLS to authorise against. Everything it writes was validated
   above; nothing from the form reaches a price column. */
const admin = createAdminClient();

const { data: customer, error } = await admin
  .from("customers")
  .insert({ name: built.value.customer.name, billing_email: built.value.customer.email, status: "pending" })
  .select("id").single();
if (error || !customer) return { ok: false, errors: { email: "server" } };

await admin.from("locations").insert(
  built.value.locations.map((l) => ({ customer_id: customer.id, ...l })),
);
await admin.from("subscriptions").insert({
  customer_id: customer.id, plan_id: built.value.planId,
  billing: built.value.billing, status: "pending",
});

/* An invite rather than a password: no password for this account ever passes
   through Odatone's servers. A failed invite must not orphan the customer, so
   it is logged and the signup still succeeds — staff can re-invite from admin. */
const { data: invited, error: inviteError } =
  await admin.auth.admin.inviteUserByEmail(built.value.customer.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/my-odatone/login`,
  });

if (!inviteError && invited?.user) {
  await admin.from("profiles").insert({
    id: invited.user.id, customer_id: customer.id,
    role: "owner", full_name: built.value.customer.name,
  });
} else {
  console.error("[odatone] invite failed", { customer: customer.id });
}

return { ok: true };
```

- [ ] **Step 4: Verify**

Complete the signup flow on `/da/tilmeld`. Confirm in Studio that a customer, its locations and a `pending` subscription exist, that the invite appears in Inbucket (`http://localhost:54324`), and that the new customer shows on `/admin/customers`. Submit an invalid email and confirm nothing is written.

- [ ] **Step 5: Commit**

Message: `Keep the customers who sign up`, explaining that the service role is used here because an anonymous visitor has no session to authorise against, that no price is ever read from the form, and that a failed invite leaves the customer for staff to re-invite rather than losing the signup.

---

### Task 14: The customer portal's front door

**Files:**
- Create: `app/my-odatone/layout.tsx`, `app/my-odatone/login/page.tsx`, `app/my-odatone/page.tsx`

**Interfaces:**
- Consumes: `createClient`, `landingFor` (Task 7), `activePlans` (Task 6), `formatDkk`, `meterSegments`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Build the login**

The same action shape as Task 9 but **bilingual** — read the locale from the existing `L10n` pattern rather than hard-coding English. Same single error message for wrong password and unknown address.

- [ ] **Step 2: Build the account summary**

A server component: company name, current plan and what it includes, subscription status, and the customer's locations with the same `Meter`. Nothing editable.

Add one honest line at the foot: *"Billing, settings and statistics are coming."* This page exists so the invite from Task 13 has somewhere real to land — it is not a preview of slice 3, and pretending otherwise would be worse than saying so.

- [ ] **Step 3: Verify the boundary for real**

Sign in as owner A and confirm the summary shows only customer A. Then, in the browser console on that page, attempt to read another customer:

```js
// Expect an empty array — RLS refuses it even with a valid session.
const { data } = await supabase.from("customers").select("*");
console.log(data.length); // 1
```

This exercises the same policies the pgTAP tests cover, but through a real session, which is the thing that actually ships.

- [ ] **Step 4: Commit**

Message: `Give an invited customer somewhere to land`, explaining that the summary is deliberately small because the portal proper is slice 3, and that it exists so an invite is not a dead end.

---

### Task 15: Export and erasure

**Files:**
- Create: `app/admin/customers/[id]/gdpr-actions.ts`, `lib/gdpr.ts`
- Test: `test/gdpr.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` (Task 7).
- Produces: `anonymisedCustomer(id: string): Record<string, string>`, `exportCustomer(id): Promise<Blob>`, `eraseCustomer(id): Promise<{ error?: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// test/gdpr.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { anonymisedCustomer } from "../lib/gdpr.ts";

test("every identifying field is replaced", () => {
  const t = anonymisedCustomer("abc123");
  for (const field of ["name", "billing_email", "address", "postcode", "city", "cvr"]) {
    assert.ok(field in t, `${field} must be overwritten`);
    assert.ok(!String(t[field]).includes("@example"), "no original value survives");
  }
});

test("the tombstone is stable and traceable to the record", () => {
  assert.deepEqual(anonymisedCustomer("abc123"), anonymisedCustomer("abc123"));
  assert.ok(anonymisedCustomer("abc123").name.includes("abc123"));
});

test("the email stays syntactically valid so constraints still hold", () => {
  assert.match(anonymisedCustomer("abc123").billing_email, /^[^@]+@[^@]+\.[a-z]+$/);
});
```

- [ ] **Step 2: Run it, watch it fail, then implement**

```ts
// lib/gdpr.ts
/* Erasure anonymises rather than deletes. Danish bookkeeping law requires
   accounting records be kept five years, and an invoice with no customer is
   not a record of anything. The tombstone keeps the invoice attributable to a
   case without naming a person. Confirm with whoever owns compliance before
   launch — this is the reading the spec adopts, not settled advice. */
export function anonymisedCustomer(id: string): Record<string, string> {
  return {
    name: `Slettet kunde ${id}`,
    billing_email: `erased+${id}@odatone.invalid`,
    cvr: "",
    address: "",
    postcode: "",
    city: "",
  };
}
```

Run `npm test` — PASS.

- [ ] **Step 3: Write the two actions**

`exportCustomer` gathers every row referencing the customer — the customer, locations, profiles, subscription, invoices, and its audit entries — into one JSON download.

`eraseCustomer` applies the tombstone, deletes the auth users via `admin.auth.admin.deleteUser`, sets the customer `cancelled`, **keeps every invoice row**, and writes an `audit_log` entry recording the erasure.

- [ ] **Step 4: Wire the UI**

On the customer detail page, a section headed *Personal data* with an Export button and a Delete button. Delete requires typing the company name to confirm — it is irreversible and it is somebody's account.

- [ ] **Step 5: Verify**

Export a customer and read the JSON. Erase a test customer, then confirm: its invoices still exist with their totals; its name appears nowhere; its users can no longer sign in; and the erasure is in `audit_log`.

- [ ] **Step 6: Commit**

Message: `Export and erase a customer's personal data`, explaining that erasure anonymises because invoices fall under a five-year retention duty, that the tombstone keeps records attributable without naming anyone, and that the reading still needs a compliance sign-off.

---

## Done when

- `npm test` and `npm run test:db` both pass.
- `npm run build` still marks the 25 marketing routes prerendered.
- A signup creates a customer, its locations and a pending subscription, and sends an invite.
- Staff sign in at `/admin` and see every customer; a customer signing in at `/my-odatone` sees only their own, verified through a real session and not only in pgTAP.
- A customer reaching `/admin` gets 404.
- Editing a price in `/admin/products` changes `/da/priser` without a deploy, and the change is in `audit_log`.

## Deliberately not built

`/my-odatone` product, billing, settings and stats screens; admin users, profile, settings and stats; Stripe and any real charge; playback telemetry; the real music catalogue; folding the copy-editor password into staff auth; a transactional email provider. Each is a later slice with its own spec.
