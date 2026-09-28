# Odatone Billing and Customer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Odatone can issue, number, document and track its own Danish invoices from `/admin`, and customers can read their billing history and edit their own details in `/my-odatone`.

**Architecture:** Invoices are Odatone's records, not a payment provider's. A `SECURITY DEFINER` Postgres function issues them in one transaction behind a locked counter row, so numbering is gapless; a trigger freezes the row afterwards. The PDF is rendered once at issue time and stored, because an issued Danish invoice must not change. No money moves in this slice.

**Tech Stack:** Next.js 16.3.3 (App Router, Turbopack), Supabase (Postgres, RLS, Storage), TypeScript, Tailwind v4, `@react-pdf/renderer`, `node --test`, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-28-odatone-billing-and-portal-design.md`

## Global Constraints

- This is **not** the Next.js in your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing routing, caching or request-API code. `middleware.ts` is `proxy.ts` here and exports `proxy`.
- Server-side Supabase auth uses `supabase.auth.getClaims()`, **never** `getSession()` — `getSession` does not verify the JWT signature.
- `@supabase/ssr` cookie handling uses `getAll`/`setAll`, never `get`/`set`/`remove`.
- Money is always an **integer number of øre**. Never a float, never kroner, in any column, argument or return value. Convert at the edges with `toOre`/`toKroner` from `lib/money.ts`.
- Ids are `gen_random_uuid()`. The `uuid-ossp` extension is not installed and `uuid_generate_v4()` fails on the hosted project.
- VAT is 25% on everything. Every customer is Danish.
- Invoice numbers are `YYYY-NNNN`, gapless. A Postgres sequence is forbidden: sequences skip on rollback.
- There are no draft invoices. A row exists only once it is numbered and `open`.
- `/admin` is English only. `/my-odatone` is bilingual through `lib/content/portal.ts` using `L10n = Record<"da" | "en", string>`.
- Never commit real credentials. `.env.example` holds blank placeholders only.
- Sign commits truthfully as whichever model you actually are.
- New migrations start at `0010`. The highest existing is `0009_customer_plan_visibility.sql`.

## Review Focus

These are the failure modes the spec implies that a naive task-by-task reading would leave untested. Each line's test is added to the task that owns the code.

1. **Two staff issue an invoice for the same customer at the same moment** — must produce two consecutive numbers with no gap and no duplicate, or one invoice and one clean error. Never two invoices sharing a number. *(Task 3)*
2. **A customer with zero `locations` rows** — `quote()` clamps locations to a minimum of 1, so a naive call invoices a phantom location. Issuing must refuse instead. *(Tasks 2 and 3)*
3. **Re-issuing a period that already has an invoice** — must be refused, not silently duplicated. Staff clicking twice is the common case, not an exotic one. *(Task 3)*
4. **An invoice whose PDF upload failed (`pdf_path is null`)** — the download route must say so, not 500, and the invoice must stay regenerable. *(Tasks 5 and 9)*
5. **A company name or address long enough to overflow the PDF's fixed layout** — must wrap or truncate, never overlap the amounts column. *(Task 4)*

---

## File Structure

**Create**
| Path | Responsibility |
| --- | --- |
| `supabase/migrations/0010_invoice_lines.sql` | `invoice_lines`, `invoice_counters`, new `invoices` columns, RLS, immutability triggers |
| `supabase/migrations/0011_invoice_source_odatone.sql` | the `odatone` value on `invoice_source` |
| `supabase/migrations/0012_issue_invoice.sql` | `issue_invoice()` |
| `supabase/migrations/0013_invoice_storage.sql` | the private `invoices` storage bucket |
| `supabase/tests/invoicing.test.sql` | pgTAP: numbering, immutability, RLS |
| `lib/invoicing.ts` | pure: build lines from a subscription, total them, format a number |
| `lib/invoice-issuer.ts` | Odatone's own legal details for the PDF |
| `lib/invoice-pdf.tsx` | the react-pdf document |
| `lib/invoice-pdf-store.ts` | render + upload + set `pdf_path` |
| `test/invoicing.test.ts` | node tests for `lib/invoicing.ts` |
| `app/admin/billing/page.tsx` | every invoice, filterable |
| `app/admin/customers/[id]/invoice-actions.ts` | `issueInvoice`, `markInvoicePaid`, `voidInvoice` |
| `components/admin/InvoiceActions.tsx` | the three dialogs |
| `app/api/invoices/[id]/pdf/route.ts` | authorised PDF download |
| `app/my-odatone/billing/page.tsx` | the customer's invoices |
| `app/my-odatone/settings/page.tsx` | the customer's editable details |
| `app/my-odatone/settings/actions.ts` | `updateBillingDetails` |
| `components/portal/PortalShell.tsx` | the portal's nav, now that there are three pages |

**Modify**
| Path | Change |
| --- | --- |
| `components/admin/AdminSideNav.tsx` | a Billing nav row |
| `components/admin/icons.tsx` | `ReceiptGlyph`, `SlidersGlyph` already exists |
| `app/admin/customers/[id]/page.tsx` | wire the three invoice actions |
| `app/my-odatone/page.tsx` | use `PortalShell` instead of its inline nav |
| `lib/content/portal.ts` | billing and settings copy |
| `package.json` | `@react-pdf/renderer` |

---

## Task 1: Invoice data model

**Files:**
- Create: `supabase/migrations/0010_invoice_lines.sql`
- Create: `supabase/tests/invoicing.test.sql`

**Interfaces:**
- Consumes: `invoices`, `customers`, `profiles` from `0002_commerce.sql`/`0001_core.sql`; `auth_customer_id()`, `is_staff()` from `0003_tenancy.sql`.
- Produces: table `invoice_lines (id, invoice_id, position, description, quantity, unit_ore, amount_ore)`; table `invoice_counters (year, next_number)`; `invoices` columns `paid_at`, `payment_method`, `payment_reference`, `void_reason`, `pdf_path`, `issued_by`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0010_invoice_lines.sql`:

```sql
/* An invoice needs itemising: which plan, how many locations, which period.
   Until now `invoices` carried only three totals, which is not something you
   can put in front of a Danish customer's bookkeeper. */

create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  position    integer not null,
  description text not null,
  quantity    integer not null check (quantity > 0),
  unit_ore    integer not null check (unit_ore >= 0),
  /* Generated, not a check constraint: there is no second place to write it,
     so a line can never disagree with its own arithmetic. Same reasoning as
     customers.billing_email_lower in 0008. */
  amount_ore  integer generated always as (quantity * unit_ore) stored,
  unique (invoice_id, position)
);

create index if not exists invoice_lines_invoice_id_idx on invoice_lines (invoice_id);

/* Danish invoice numbering must be gapless. A Postgres sequence is the wrong
   tool: nextval() is non-transactional and skips on rollback. A plain counter
   row locked `for update` inside the issuing transaction is not. */
create table if not exists invoice_counters (
  year        integer primary key,
  next_number integer not null default 1
);

alter table invoices add column if not exists paid_at           timestamptz;
alter table invoices add column if not exists payment_method    text;
alter table invoices add column if not exists payment_reference text;
alter table invoices add column if not exists void_reason       text;
alter table invoices add column if not exists pdf_path          text;
alter table invoices add column if not exists issued_by         uuid references profiles(id);

/* invoice_status carries `draft` and `overdue`. Neither is written by this
   slice, and that is deliberate rather than forgotten: there are no draft
   invoices (a row exists only once it is numbered, which is what makes the
   numbering gapless by construction), and nothing here automates dunning --
   overdue is computed for display from `due_at < now()` on an open invoice.
   Slice 4 gives `overdue` a writer. */

/* "Required when voiding" enforced, not remembered. */
alter table invoices drop constraint if exists invoices_void_reason_ck;
alter table invoices add constraint invoices_void_reason_ck
  check (status <> 'void' or void_reason is not null);

/* ------------------------------------------------------------------
   Immutability. An issued invoice is a legal document; it does not change.
   Only its payment state does.

   NOT security definer, and it exempts no role -- the same correction
   0003_tenancy.sql's guard_customer_status carries. `current_user` inside a
   definer function reports the function's OWNER, so a definer trigger that
   tries to exempt a role silently exempts everyone.
   ------------------------------------------------------------------ */
create or replace function guard_invoice_immutable() returns trigger
language plpgsql as $$
begin
  if new.number       is distinct from old.number
  or new.customer_id  is distinct from old.customer_id
  or new.issued_at    is distinct from old.issued_at
  or new.due_at       is distinct from old.due_at
  or new.period_start is distinct from old.period_start
  or new.period_end   is distinct from old.period_end
  or new.subtotal_ore is distinct from old.subtotal_ore
  or new.vat_ore      is distinct from old.vat_ore
  or new.total_ore    is distinct from old.total_ore
  or new.source       is distinct from old.source
  or new.issued_by    is distinct from old.issued_by
  then
    raise exception 'invoice % is issued and cannot be amended; void it and issue a new one', old.number
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

drop trigger if exists invoices_immutable on invoices;
create trigger invoices_immutable before update on invoices
  for each row execute function guard_invoice_immutable();

/* An issued invoice's lines are as fixed as its total. */
create or replace function guard_invoice_lines_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'invoice lines cannot be changed once issued'
    using errcode = 'restrict_violation';
end $$;

/* This also makes an invoice undeletable: `invoices` cascades to its lines,
   and the cascade fires this trigger. That is intended. lib/gdpr.ts already
   anonymises a customer rather than deleting them, for exactly the reason
   named there -- Danish bookkeeping law requires the records be kept -- and
   neither `customers` nor `invoices` has a DELETE policy. A legal document
   should be hard to destroy. */
drop trigger if exists invoice_lines_immutable on invoice_lines;
create trigger invoice_lines_immutable before update or delete on invoice_lines
  for each row execute function guard_invoice_lines_immutable();

/* ------------------------------------------------------------------
   RLS: mirrors invoices_read / invoices_staff_write exactly, keyed through
   invoice_id. A customer sees their own lines and nobody else's.
   ------------------------------------------------------------------ */
alter table invoice_lines enable row level security;

drop policy if exists invoice_lines_read on invoice_lines;
create policy invoice_lines_read on invoice_lines for select
  using (exists (
    select 1 from invoices i
    where i.id = invoice_lines.invoice_id
      and (i.customer_id = auth_customer_id() or is_staff())
  ));

drop policy if exists invoice_lines_staff_write on invoice_lines;
create policy invoice_lines_staff_write on invoice_lines for all
  using (is_staff()) with check (is_staff());

/* invoice_counters is machinery, not data anyone reads. Only the issuing
   function (service_role, SECURITY DEFINER) touches it. */
alter table invoice_counters enable row level security;
```

- [ ] **Step 2: Write the pgTAP test**

Create `supabase/tests/invoicing.test.sql`:

```sql
begin;
select plan(12);

insert into customers (id, name, billing_email) values
  ('cccc0000-0000-0000-0000-000000000001', 'Café A', 'a@example.test'),
  ('cccc0000-0000-0000-0000-000000000002', 'Café B', 'b@example.test');

-- Numbered in 1999 deliberately. invoice_counters is keyed on the CURRENT
-- year, so a fixture numbered 2026-0001 would collide with the first number
-- issue_invoice hands out in this same file, and the unique constraint on
-- invoices.number would fail as what looks like a numbering bug.
insert into invoices (id, customer_id, number, subtotal_ore, vat_ore, total_ore, status, source)
values ('1111aaaa-0000-0000-0000-000000000001',
        'cccc0000-0000-0000-0000-000000000001',
        '1999-0001', 10000, 2500, 12500, 'open', 'seed');

insert into invoice_lines (invoice_id, position, description, quantity, unit_ore)
values ('1111aaaa-0000-0000-0000-000000000001', 1, 'Medium Stage', 2, 5000);

-- amount_ore is generated
select is(
  (select amount_ore from invoice_lines where invoice_id = '1111aaaa-0000-0000-0000-000000000001'),
  10000, 'amount_ore is quantity * unit_ore, generated');

select has_column('public', 'invoice_lines', 'amount_ore', 'invoice_lines.amount_ore exists');
select has_table('public', 'invoice_counters', 'invoice_counters exists');

-- immutability: amounts frozen, payment state not
select throws_ok(
  $$ update invoices set subtotal_ore = 999 where number = '1999-0001' $$,
  'restrict_violation', null,
  'an issued invoice cannot have its subtotal amended');

select throws_ok(
  $$ update invoices set number = '2026-9999' where number = '1999-0001' $$,
  'restrict_violation', null,
  'an issued invoice cannot be renumbered');

select lives_ok(
  $$ update invoices set status = 'paid', paid_at = now(), payment_method = 'bank_transfer'
     where number = '1999-0001' $$,
  'payment state may still be recorded');

select throws_ok(
  $$ update invoice_lines set quantity = 5 where position = 1 $$,
  'restrict_violation', null,
  'an issued invoice line cannot be changed');

select throws_ok(
  $$ delete from invoice_lines where position = 1 $$,
  'restrict_violation', null,
  'an issued invoice line cannot be deleted');

-- voiding requires a reason
select throws_ok(
  $$ update invoices set status = 'void' where number = '1999-0001' $$,
  '23514', null,
  'voiding without a reason violates invoices_void_reason_ck');

select lives_ok(
  $$ update invoices set status = 'void', void_reason = 'issued in error'
     where number = '1999-0001' $$,
  'voiding with a reason is allowed');

-- RLS is on
select is(
  (select relrowsecurity from pg_class where relname = 'invoice_lines'),
  true, 'invoice_lines has row level security enabled');

select is(
  (select relrowsecurity from pg_class where relname = 'invoice_counters'),
  true, 'invoice_counters has row level security enabled');

select * from finish();
rollback;
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx supabase test db`
Expected: FAIL — `relation "invoice_lines" does not exist`.

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`
Expected: all migrations apply with no error.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx supabase test db`
Expected: PASS, 12 of 12 in `invoicing.test.sql`, and the existing 69 still green.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0010_invoice_lines.sql supabase/tests/invoicing.test.sql
git commit -m "Add invoice lines, numbering counter and immutability"
```

---

## Task 2: Building invoice lines

**Files:**
- Create: `lib/invoicing.ts`
- Create: `test/invoicing.test.ts`

**Interfaces:**
- Consumes: `quote`, `type Plan`, `type Billing` from `lib/pricing.ts`; `toOre`, `vatOre` from `lib/money.ts`.
- Produces:
  - `type InvoiceLineDraft = { position: number; description: string; quantity: number; unitOre: number }`
  - `buildInvoiceLines(input: BuildLinesInput): InvoiceLineDraft[]`
  - `type BuildLinesInput = { plan: Plan; billing: Billing; locations: number; periodStart: string; periodEnd: string }`
  - `lineTotals(lines: InvoiceLineDraft[]): { subtotalOre: number; vatOre: number; totalOre: number }`
  - `formatInvoiceNumber(year: number, n: number): string`

- [ ] **Step 1: Write the failing test**

Create `test/invoicing.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInvoiceLines, lineTotals, formatInvoiceNumber } from "../lib/invoicing.ts";
import { PLANS, quote } from "../lib/pricing.ts";
import { toOre } from "../lib/money.ts";

const medium = PLANS.find((p) => p.id === "medium")!;

test("formats a gapless-looking invoice number", () => {
  assert.equal(formatInvoiceNumber(2026, 1), "2026-0001");
  assert.equal(formatInvoiceNumber(2026, 42), "2026-0042");
  assert.equal(formatInvoiceNumber(2026, 12345), "2026-12345");
});

test("one line per subscription, quantity is the location count", () => {
  const lines = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 2,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].position, 1);
  assert.equal(lines[0].quantity, 2);
});

test("an annual term bills twelve months, not one", () => {
  // quote()'s perLocation is always a MONTHLY rate. Billing an annual
  // subscription at perLocation would undercharge by a factor of twelve.
  const monthly = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 1,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  const annual = buildInvoiceLines({
    plan: medium, billing: "annual", locations: 1,
    periodStart: "2026-03-01", periodEnd: "2027-03-01",
  });
  const q = quote(medium, "annual", 1);
  assert.equal(annual[0].unitOre, toOre(q.perLocation * 12));
  // The bug this guards is "forgot to multiply by twelve", which would make
  // the annual unit equal to one annual-rate month. Do NOT assert a ratio
  // against the monthly unit: ANNUAL_DISCOUNT_PCT is 45, so an annual line is
  // ~6.6x a monthly one, not ~12x, and a ratio test silently encodes an
  // assumption about how deep the discount is.
  assert.notEqual(annual[0].unitOre, toOre(q.perLocation));
  assert.ok(annual[0].unitOre > monthly[0].unitOre);
});

test("the description names the plan and the period", () => {
  const [line] = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 3,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  assert.match(line.description, /Medium Stage/);
  assert.match(line.description, /2026-03-01/);
  assert.match(line.description, /2026-04-01/);
});

test("totals come from the lines, and always add up", () => {
  const lines = buildInvoiceLines({
    plan: medium, billing: "monthly", locations: 7,
    periodStart: "2026-03-01", periodEnd: "2026-04-01",
  });
  const t = lineTotals(lines);
  assert.equal(t.subtotalOre, lines[0].quantity * lines[0].unitOre);
  assert.equal(t.subtotalOre + t.vatOre, t.totalOre);
  assert.equal(t.vatOre, Math.round(t.subtotalOre * 0.25));
});

test("the line total never drifts far from quote()", () => {
  // quote() rounds to two decimal kroner at each step, so
  // toOre(perLocation) * n can differ from toOre(monthlyExVat) by a few øre.
  // The lines are authoritative -- an invoice must add up in the reader's
  // hand -- but the divergence must stay bounded and tiny.
  for (const plan of PLANS) {
    for (const billing of ["monthly", "annual"] as const) {
      for (let n = 1; n <= 40; n++) {
        const lines = buildInvoiceLines({
          plan, billing, locations: n,
          periodStart: "2026-03-01", periodEnd: "2026-04-01",
        });
        const q = quote(plan, billing, n);
        const drift = Math.abs(lineTotals(lines).subtotalOre - toOre(q.chargeExVat));
        assert.ok(drift <= n, `${plan.id}/${billing}/${n}: drift ${drift} øre exceeds ${n}`);
      }
    }
  }
});

test("refuses a customer with no locations", () => {
  // quote() clamps locations to a minimum of 1, so calling it naively would
  // invoice a phantom location for a customer who has none.
  assert.throws(
    () => buildInvoiceLines({
      plan: medium, billing: "monthly", locations: 0,
      periodStart: "2026-03-01", periodEnd: "2026-04-01",
    }),
    /at least one location/i,
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/invoicing.test.ts`
Expected: FAIL — `Cannot find module '.../lib/invoicing.ts'`.

- [ ] **Step 3: Implement**

Create `lib/invoicing.ts`:

```ts
import { toOre, vatOre } from "./money.ts";
import { quote, type Billing, type Plan } from "./pricing.ts";

export type InvoiceLineDraft = {
  position: number;
  description: string;
  quantity: number;
  unitOre: number;
};

export type BuildLinesInput = {
  plan: Plan;
  billing: Billing;
  locations: number;
  /** ISO date, inclusive. */
  periodStart: string;
  /** ISO date, exclusive. */
  periodEnd: string;
};

/** `YYYY-NNNN`, zero-padded to four digits and allowed to grow past it. */
export function formatInvoiceNumber(year: number, n: number): string {
  return `${year}-${String(n).padStart(4, "0")}`;
}

const TERM_LABEL: Record<Billing, string> = {
  monthly: "monthly",
  annual: "annual",
};

/**
 * Turns a subscription into the lines of one invoice.
 *
 * Prices come from `quote()` rather than being re-derived here. That function
 * already applies the volume tiers and the annual discount, and already backs
 * both the public pricing page and the admin MRR figure; a second
 * implementation of the same arithmetic would disagree the first time a
 * discount changed.
 *
 * `quote()`'s `perLocation` is always a MONTHLY rate whatever the term, so an
 * annual invoice multiplies it by twelve. Missing that undercharges an annual
 * customer by a factor of twelve, which is the single most expensive mistake
 * available in this file.
 */
export function buildInvoiceLines(input: BuildLinesInput): InvoiceLineDraft[] {
  if (input.locations < 1) {
    /* quote() clamps to a minimum of one location, so passing zero through
       would bill a phantom location rather than fail. A customer with no
       locations has nothing to invoice; that is a caller error, not a
       zero-amount invoice. */
    throw new Error("cannot invoice a customer with at least one location missing");
  }

  const q = quote(input.plan, input.billing, input.locations);
  const months = input.billing === "annual" ? 12 : 1;

  return [
    {
      position: 1,
      description: `${input.plan.name} — ${TERM_LABEL[input.billing]} — ${input.periodStart} to ${input.periodEnd}`,
      quantity: input.locations,
      unitOre: toOre(q.perLocation * months),
    },
  ];
}

/**
 * The lines are authoritative for the invoice's total, not `quote()`.
 *
 * `quote()` rounds to two decimal kroner at each step, so its `chargeExVat`
 * can differ from the sum of the lines by a few øre. Between the two, the
 * lines win: an invoice has to add up in the reader's hand, and a document
 * whose stated total is not the sum of its own rows is one a bookkeeper will
 * reject.
 */
export function lineTotals(lines: InvoiceLineDraft[]): {
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
} {
  const subtotalOre = lines.reduce((sum, l) => sum + l.quantity * l.unitOre, 0);
  const vat = vatOre(subtotalOre);
  return { subtotalOre, vatOre: vat, totalOre: subtotalOre + vat };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test test/invoicing.test.ts`
Expected: PASS, 7 of 7.

- [ ] **Step 5: Commit**

```bash
git add lib/invoicing.ts test/invoicing.test.ts
git commit -m "Build invoice lines from a subscription"
```

---

## Task 3: Issuing an invoice in one transaction

**Files:**
- Create: `supabase/migrations/0011_invoice_source_odatone.sql`
- Create: `supabase/migrations/0012_issue_invoice.sql`
- Modify: `supabase/tests/invoicing.test.sql` (raise `plan(12)` to `plan(18)`, append)

**Interfaces:**
- Consumes: `invoice_counters`, `invoice_lines` from Task 1.
- Produces: `issue_invoice(p_customer_id uuid, p_period_start date, p_period_end date, p_due_days integer, p_issued_by uuid, p_lines jsonb) returns table (invoice_id uuid, invoice_number text)`.

The lines arrive as JSON from Node, already priced by `buildInvoiceLines` — the arithmetic stays in one tested place rather than being reimplemented in PL/pgSQL. The function's job is atomicity, numbering and the checks that must hold under a lock.

- [ ] **Step 1: Add the `odatone` source value, in its own migration**

`invoice_source` is `('seed', 'stripe')`. Neither describes an invoice Odatone
issued itself. This is a separate file because `alter type ... add value`
cannot be used by a statement in the same transaction that added it, and
Supabase applies each migration file in one transaction — put it with the
function and the function's first run fails.

Create `supabase/migrations/0011_invoice_source_odatone.sql`:

```sql
/* `source` distinguished a seeded placeholder from a real Stripe row. Odatone
   now issues its own, which is neither. Its own file: a value added by
   `alter type` is not usable by another statement inside the same
   transaction, and each migration file is one transaction. */
do $$ begin
  alter type invoice_source add value if not exists 'odatone';
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Write the issuing function**

Create `supabase/migrations/0012_issue_invoice.sql`:

```sql
/* Issuing an invoice is several writes that must all happen or none: take the
   next number, insert the header, insert the lines, bump the counter. Done as
   separate PostgREST calls, two staff clicking at the same moment can consume
   one number twice or leave a numbered header with no lines. Postgres does the
   whole thing in one transaction instead -- the same reasoning, and the same
   shape, as apply_signup_order in 0007.

   SECURITY DEFINER because it writes invoice_counters, which no role can
   reach through RLS. Postgres grants EXECUTE to PUBLIC by default, which
   would let any signed-in customer issue themselves an invoice for anyone;
   the revokes below are not optional. */
create or replace function issue_invoice(
  p_customer_id  uuid,
  p_period_start date,
  p_period_end   date,
  p_due_days     integer,
  p_issued_by    uuid,
  p_lines        jsonb
) returns table (invoice_id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year     integer := extract(year from now())::integer;
  v_next     integer;
  v_number   text;
  v_subtotal integer;
  v_vat      integer;
  v_id       uuid;
  v_status   subscription_status;
  v_locs     integer;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'an invoice needs at least one line';
  end if;
  if p_period_end <= p_period_start then
    raise exception 'period end must be after period start';
  end if;

  /* Serialise every concurrent issue behind this one row. Taken FIRST, before
     any read below, so the checks cannot be made stale by a call that got the
     lock ahead of us. */
  insert into invoice_counters (year, next_number) values (v_year, 1)
    on conflict (year) do nothing;
  select next_number into v_next from invoice_counters where year = v_year for update;

  /* Re-checked under the lock, never trusted from the caller's earlier read
     -- the TOCTOU lesson from apply_signup_order's fix round 4. */
  select s.status into v_status
    from subscriptions s
   where s.customer_id = p_customer_id
   order by s.created_at desc
   limit 1;

  if v_status is null then
    raise exception 'customer % has no subscription to invoice', p_customer_id;
  end if;
  if v_status not in ('active', 'trialing', 'past_due') then
    raise exception 'customer % has a % subscription, which is not billable', p_customer_id, v_status;
  end if;

  select count(*) into v_locs from locations where customer_id = p_customer_id;
  if v_locs = 0 then
    raise exception 'customer % has no locations to invoice', p_customer_id;
  end if;

  /* Staff clicking Issue twice is the common case, not an exotic one. */
  if exists (
    select 1 from invoices
     where customer_id = p_customer_id
       and period_start = p_period_start
       and period_end = p_period_end
       and status <> 'void'
  ) then
    raise exception 'customer % already has an invoice for % to %', p_customer_id, p_period_start, p_period_end;
  end if;

  select coalesce(sum((l->>'quantity')::integer * (l->>'unitOre')::integer), 0)
    into v_subtotal
    from jsonb_array_elements(p_lines) l;

  /* 25% VAT, rounded half-up to whole øre -- the same rule lib/money.ts's
     vatOre applies, restated here because this function must not depend on
     the application having computed it. */
  v_vat := round(v_subtotal * 0.25);
  v_number := v_year::text || '-' || lpad(v_next::text, 4, '0');

  insert into invoices (
    customer_id, number, issued_at, due_at, period_start, period_end,
    subtotal_ore, vat_ore, total_ore, status, source, issued_by
  ) values (
    p_customer_id, v_number, now(), now() + make_interval(days => p_due_days),
    p_period_start, p_period_end,
    v_subtotal, v_vat, v_subtotal + v_vat, 'open', 'odatone', p_issued_by
  ) returning id into v_id;

  insert into invoice_lines (invoice_id, position, description, quantity, unit_ore)
  select v_id,
         (l->>'position')::integer,
         l->>'description',
         (l->>'quantity')::integer,
         (l->>'unitOre')::integer
    from jsonb_array_elements(p_lines) l;

  update invoice_counters set next_number = next_number + 1 where year = v_year;

  invoice_id := v_id;
  invoice_number := v_number;
  return next;
end $$;

revoke all on function issue_invoice(uuid, date, date, integer, uuid, jsonb) from public;
revoke all on function issue_invoice(uuid, date, date, integer, uuid, jsonb) from anon;
revoke all on function issue_invoice(uuid, date, date, integer, uuid, jsonb) from authenticated;
grant execute on function issue_invoice(uuid, date, date, integer, uuid, jsonb) to service_role;
```

- [ ] **Step 3: Write the failing pgTAP additions**

In `supabase/tests/invoicing.test.sql`, change `select plan(12);` to `select plan(18);` and append before `select * from finish();`:

```sql
-- ---------------------------------------------------------------------
-- issue_invoice
-- ---------------------------------------------------------------------
insert into plans (id, name, monthly_ore, max_m2, tagline, features, sort)
  values ('t-medium', 'Test Medium', 19900, 300, '{"da":"x","en":"x"}', '[]', 99)
  on conflict (id) do nothing;

insert into subscriptions (customer_id, plan_id, billing, status)
  values ('cccc0000-0000-0000-0000-000000000002', 't-medium', 'monthly', 'active');

insert into locations (customer_id, name, venue_type, m2)
  values ('cccc0000-0000-0000-0000-000000000002', 'L1', 'retail', 100);

select lives_ok(
  $$ select issue_invoice('cccc0000-0000-0000-0000-000000000002',
       '2026-03-01', '2026-04-01', 14, null,
       '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb) $$,
  'issue_invoice issues for a billable customer');

select is(
  (select count(*)::integer from invoices where customer_id = 'cccc0000-0000-0000-0000-000000000002'),
  1, 'exactly one invoice was created');

select is(
  (select total_ore from invoices where customer_id = 'cccc0000-0000-0000-0000-000000000002'),
  24875, 'total is subtotal plus 25% VAT');

-- the same period twice is refused, not silently duplicated
select throws_ok(
  $$ select issue_invoice('cccc0000-0000-0000-0000-000000000002',
       '2026-03-01', '2026-04-01', 14, null,
       '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb) $$,
  null, null,
  'issuing the same period twice is refused');

-- numbering advances with no gap
select lives_ok(
  $$ select issue_invoice('cccc0000-0000-0000-0000-000000000002',
       '2026-04-01', '2026-05-01', 14, null,
       '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb) $$,
  'a second period issues');

select is(
  (select array_agg(right(number, 4) order by number)
     from invoices where customer_id = 'cccc0000-0000-0000-0000-000000000002'),
  array['0001','0002'],
  'numbers are consecutive with no gap');
```

- [ ] **Step 4: Run and watch it fail, then apply**

Run: `npx supabase test db`
Expected: FAIL — `function issue_invoice(...) does not exist`.

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, 18 of 18.

- [ ] **Step 5: Prove gaplessness under real concurrency**

The pgTAP file runs in one transaction and so cannot exercise two sessions. Write a throwaway script in the scratchpad that fires eight `issue_invoice` calls for eight distinct periods concurrently over PostgREST RPC, then asserts the resulting numbers are exactly `0001..0008` with no gap and no duplicate. Report the result in the task report; do not commit the script.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0011_invoice_source_odatone.sql supabase/migrations/0012_issue_invoice.sql supabase/tests/invoicing.test.sql
git commit -m "Issue invoices atomically behind a locked counter"
```

---

## Task 4: The invoice PDF

**Files:**
- Create: `lib/invoice-issuer.ts`
- Create: `lib/invoice-pdf.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `InvoiceLineDraft` from `lib/invoicing.ts`; `formatDkk` from `lib/money.ts`.
- Produces: `ISSUER` (frozen object); `renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer>`; `type InvoicePdfInput = { number: string; issuedAt: string; dueAt: string; periodStart: string; periodEnd: string; customer: { name: string; cvr: string | null; address: string | null; postcode: string | null; city: string | null; country: string }; lines: InvoiceLineDraft[]; subtotalOre: number; vatOre: number; totalOre: number }`.

- [ ] **Step 1: Install the renderer**

Run: `pnpm add @react-pdf/renderer`
Expected: added to `dependencies`. Do not add a browser-based alternative; this must run in a plain Node function.

- [ ] **Step 2: Write the issuer config**

Create `lib/invoice-issuer.ts`:

```ts
/**
 * Odatone's own legal details, as they must appear on a Danish invoice.
 *
 * THESE ARE PLACEHOLDERS. A generated invoice is NOT a legally valid Danish
 * invoice until every value below is replaced with Odatone's real
 * registration. A Danish invoice must carry the seller's name, address, CVR
 * number and payment details; an invoice missing them is not deductible for
 * the customer, which is the first thing their bookkeeper will notice.
 *
 * Deliberately a module rather than environment variables: these change
 * roughly never, they are not secret, and having them in git means a change
 * is reviewable and dated.
 */
export const ISSUER = Object.freeze({
  legalName: "PLACEHOLDER — Odatone ApS",
  cvr: "PLACEHOLDER — 00000000",
  address: "PLACEHOLDER — Gadenavn 1",
  postcode: "PLACEHOLDER — 0000",
  city: "PLACEHOLDER — By",
  country: "Danmark",
  email: "PLACEHOLDER — faktura@odatone.dk",
  bankName: "PLACEHOLDER — Bank",
  bankReg: "PLACEHOLDER — 0000",
  bankAccount: "PLACEHOLDER — 0000000000",
  iban: "PLACEHOLDER — DK0000000000000000",
  swift: "PLACEHOLDER — XXXXDKKK",
  /** Days from issue to due, used as the default in the issue dialog. */
  paymentTermsDays: 14,
});

/** True when the placeholders are still in place. The admin issue dialog
    warns on this rather than silently producing an unusable document. */
export const ISSUER_IS_PLACEHOLDER = Object.values(ISSUER).some(
  (v) => typeof v === "string" && v.startsWith("PLACEHOLDER"),
);
```

- [ ] **Step 3: Write the PDF document**

Create `lib/invoice-pdf.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

import { ISSUER } from "./invoice-issuer";
import { formatDkk } from "./money";
import type { InvoiceLineDraft } from "./invoicing";

export type InvoicePdfInput = {
  number: string;
  issuedAt: string;
  dueAt: string;
  periodStart: string;
  periodEnd: string;
  customer: {
    name: string;
    cvr: string | null;
    address: string | null;
    postcode: string | null;
    city: string | null;
    country: string;
  };
  lines: InvoiceLineDraft[];
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
};

/* Helvetica is built into react-pdf and covers æ, ø and å, so no font file
   needs shipping. Do not switch to a webfont without checking those three. */
const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#18181d" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#56565f" },
  row: { flexDirection: "row" },
  parties: { flexDirection: "row", justifyContent: "space-between", marginTop: 28, marginBottom: 28 },
  /* Fixed width with wrapping: a long company name must push its own block
     taller, never bleed into the amounts column beside it. */
  party: { width: "45%" },
  partyName: { fontFamily: "Helvetica-Bold", marginBottom: 3 },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#18181d", paddingBottom: 5, marginBottom: 5, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#e6e6eb" },
  cDesc: { width: "52%", paddingRight: 8 },
  cQty: { width: "10%", textAlign: "right" },
  cUnit: { width: "19%", textAlign: "right" },
  cAmt: { width: "19%", textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: "48%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: "#18181d", fontFamily: "Helvetica-Bold" },
  pay: { marginTop: 32, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#e6e6eb" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 28, fontSize: 8, color: "#8b8b95", textAlign: "center" },
});

const kr = (ore: number) => formatDkk(ore, "da");

function InvoiceDocument({ inv }: { inv: InvoicePdfInput }) {
  return (
    <Document title={`Faktura ${inv.number}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Faktura</Text>
        <Text style={s.muted}>Fakturanummer {inv.number}</Text>
        <Text style={s.muted}>Fakturadato {inv.issuedAt} · Betalingsfrist {inv.dueAt}</Text>
        <Text style={s.muted}>Periode {inv.periodStart} – {inv.periodEnd}</Text>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyName}>Sælger</Text>
            <Text>{ISSUER.legalName}</Text>
            <Text>{ISSUER.address}</Text>
            <Text>{ISSUER.postcode} {ISSUER.city}</Text>
            <Text>{ISSUER.country}</Text>
            <Text>CVR {ISSUER.cvr}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.partyName}>Kunde</Text>
            <Text>{inv.customer.name}</Text>
            {inv.customer.address && <Text>{inv.customer.address}</Text>}
            <Text>{[inv.customer.postcode, inv.customer.city].filter(Boolean).join(" ")}</Text>
            <Text>{inv.customer.country}</Text>
            {inv.customer.cvr && <Text>CVR {inv.customer.cvr}</Text>}
          </View>
        </View>

        <View style={s.thead}>
          <Text style={s.cDesc}>Beskrivelse</Text>
          <Text style={s.cQty}>Antal</Text>
          <Text style={s.cUnit}>Stykpris</Text>
          <Text style={s.cAmt}>Beløb</Text>
        </View>
        {inv.lines.map((l) => (
          <View style={s.tr} key={l.position} wrap={false}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cUnit}>{kr(l.unitOre)}</Text>
            <Text style={s.cAmt}>{kr(l.quantity * l.unitOre)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Subtotal</Text><Text>{kr(inv.subtotalOre)}</Text></View>
          <View style={s.totalRow}><Text>Moms 25%</Text><Text>{kr(inv.vatOre)}</Text></View>
          <View style={s.grand}><Text>I alt</Text><Text>{kr(inv.totalOre)}</Text></View>
        </View>

        <View style={s.pay}>
          <Text style={s.partyName}>Betaling</Text>
          <Text>Betales senest {inv.dueAt} til {ISSUER.bankName}.</Text>
          <Text>Reg. {ISSUER.bankReg} · Konto {ISSUER.bankAccount}</Text>
          <Text>IBAN {ISSUER.iban} · SWIFT {ISSUER.swift}</Text>
          <Text style={s.muted}>Anfør fakturanummer {inv.number} ved betaling.</Text>
        </View>

        <Text style={s.footer} fixed>
          {ISSUER.legalName} · CVR {ISSUER.cvr} · {ISSUER.email}
        </Text>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(inv: InvoicePdfInput): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument inv={inv} />);
}
```

- [ ] **Step 4: Prove it renders, and that long text wraps**

Write a throwaway script in the scratchpad that calls `renderInvoicePdf` twice — once with ordinary values, once with a 120-character company name and a 4-line address — writes both to the scratchpad, and asserts each buffer starts with `%PDF`. Open both and **look at them**: confirm the long name wraps inside its own column and does not overlap the customer block or the amounts. Report what you saw; do not commit the script.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml lib/invoice-issuer.ts lib/invoice-pdf.tsx
git commit -m "Render the invoice PDF"
```

---

## Task 5: Storing the PDF

**Files:**
- Create: `supabase/migrations/0013_invoice_storage.sql`
- Create: `lib/invoice-pdf-store.ts`

**Interfaces:**
- Consumes: `renderInvoicePdf`, `InvoicePdfInput` from Task 4; `createAdminClient` from `lib/supabase/admin.ts`.
- Produces: `storeInvoicePdf(invoiceId: string, customerId: string, input: InvoicePdfInput): Promise<string | null>` — returns the stored path, or `null` after logging if rendering or upload failed.

- [ ] **Step 1: Create the bucket**

Create `supabase/migrations/0013_invoice_storage.sql`:

```sql
/* Private. No storage RLS policy is relied on: every download goes through
   app/api/invoices/[id]/pdf/route.ts, which authorises the reader against the
   invoices table first and only then mints a short-lived signed URL. Keeping
   authorisation in one place beats splitting it between Postgres policies and
   storage rules. */
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Write the store helper**

Create `lib/invoice-pdf-store.ts`:

```ts
import "server-only";

import { renderInvoicePdf, type InvoicePdfInput } from "./invoice-pdf";
import { createAdminClient } from "./supabase/admin";

/**
 * Renders an invoice and files it under `<customer_id>/<invoice_id>.pdf`.
 *
 * Returns null rather than throwing. By the time this runs the invoice row
 * already exists with a real number, and a number, once consumed, cannot be
 * given back — so a failure here must not unwind the invoice. A missing PDF
 * is recoverable (regenerate it); a gap in the numbering is not.
 */
export async function storeInvoicePdf(
  invoiceId: string,
  customerId: string,
  input: InvoicePdfInput,
): Promise<string | null> {
  const path = `${customerId}/${invoiceId}.pdf`;
  try {
    const pdf = await renderInvoicePdf(input);
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("invoices")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (error) {
      console.error("[odatone] invoice pdf: upload failed", { invoiceId, error });
      return null;
    }
    const { error: pathError } = await admin
      .from("invoices").update({ pdf_path: path }).eq("id", invoiceId);
    if (pathError) {
      console.error("[odatone] invoice pdf: stored but pdf_path not set", { invoiceId, error: pathError });
      return null;
    }
    return path;
  } catch (error) {
    console.error("[odatone] invoice pdf: render failed", { invoiceId, error });
    return null;
  }
}
```

- [ ] **Step 3: Verify the bucket exists**

Run: `npx supabase db reset`
Then: `curl -s "http://127.0.0.1:54321/rest/v1/rpc/..."` is not applicable — instead query storage directly with the service key:
`psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select id, public from storage.buckets where id = 'invoices';"`
Expected: one row, `public = f`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0013_invoice_storage.sql lib/invoice-pdf-store.ts
git commit -m "Store issued invoice PDFs in a private bucket"
```

---

## Task 6: Issuing from /admin

**Files:**
- Create: `app/admin/customers/[id]/invoice-actions.ts`
- Create: `components/admin/InvoiceActions.tsx`
- Modify: `app/admin/customers/[id]/page.tsx`

**Interfaces:**
- Consumes: `buildInvoiceLines`, `lineTotals` (Task 2); `issue_invoice` RPC (Task 3); `storeInvoicePdf` (Task 5); `Modal` from `components/admin/Modal.tsx`; `resolvePlan`, `planMap` from `lib/admin/plans.ts`; `latestSubscription` from `lib/admin/customers.ts`.
- Produces: server actions `issueInvoice(prev, formData): Promise<ActionResult>`, and the client component `<IssueInvoiceDialog customerId planName defaultPeriodStart defaultPeriodEnd defaultDueDays />`.

- [ ] **Step 1: Write the action**

Create `app/admin/customers/[id]/invoice-actions.ts`. It must, in order: read the caller's claims and require a staff profile; read the customer's plan, billing term and location count through the **session** client under RLS; call `buildInvoiceLines`; call the `issue_invoice` RPC through the **service-role** client; then call `storeInvoicePdf`; then `revalidatePath`.

```ts
"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/forms";
import { buildInvoiceLines, lineTotals } from "@/lib/invoicing";
import { ISSUER } from "@/lib/invoice-issuer";
import { storeInvoicePdf } from "@/lib/invoice-pdf-store";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { latestSubscription } from "@/lib/admin/customers";
import type { PlanRow } from "@/lib/plans-row";
import type { Billing } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function issueInvoice(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const callerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : undefined;
  if (!callerId) return { ok: false, errors: { form: "forbidden" } };

  const { data: caller } = await supabase
    .from("profiles").select("role").eq("id", callerId).maybeSingle();
  /* Any staff role may issue: support chasing a payment is the normal case.
     invoices_staff_write (0003_tenancy.sql) says the same, and this check is
     here only because the RPC below runs as service_role and bypasses it. */
  if (caller?.role !== "staff_admin" && caller?.role !== "staff_support") {
    return { ok: false, errors: { form: "forbidden" } };
  }

  const customerId = String(formData.get("customerId") ?? "");
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  const dueDays = Number(formData.get("dueDays") ?? ISSUER.paymentTermsDays);
  if (!customerId || !periodStart || !periodEnd) return { ok: false, errors: { form: "invalid" } };
  if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) {
    return { ok: false, errors: { dueDays: "invalid" } };
  }

  const [{ data: customer }, { data: subs }, { data: locs }, { data: planRows }] = await Promise.all([
    supabase.from("customers")
      .select("id, name, cvr, address, postcode, city, country").eq("id", customerId).maybeSingle(),
    supabase.from("subscriptions")
      .select("plan_id, billing, status, created_at").eq("customer_id", customerId),
    supabase.from("locations").select("id").eq("customer_id", customerId),
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  if (!customer) return { ok: false, errors: { form: "invalid" } };
  const sub = latestSubscription((subs ?? []) as { plan_id: string; billing: string; status: string; created_at: string }[]);
  if (!sub) return { ok: false, errors: { form: "no-subscription" } };
  const locations = locs?.length ?? 0;
  if (locations === 0) return { ok: false, errors: { form: "no-locations" } };

  const plan = resolvePlan(sub.plan_id, planMap((planRows ?? []) as PlanRow[]), "issue invoice");

  let lines;
  try {
    lines = buildInvoiceLines({
      plan, billing: sub.billing as Billing, locations, periodStart, periodEnd,
    });
  } catch (error) {
    console.error("[odatone] issue invoice: could not build lines", error);
    return { ok: false, errors: { form: "invalid" } };
  }

  const admin = createAdminClient();
  const { data: issued, error: rpcError } = await admin.rpc("issue_invoice", {
    p_customer_id: customerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_days: dueDays,
    p_issued_by: callerId,
    p_lines: lines,
  });

  if (rpcError || !issued?.[0]) {
    console.error("[odatone] issue invoice: rpc failed", { customerId, error: rpcError });
    /* The function raises a readable message for the cases staff actually
       hit -- already invoiced for this period, no billable subscription -- so
       surface which one rather than a generic failure. */
    const message = String(rpcError?.message ?? "");
    if (message.includes("already has an invoice")) return { ok: false, errors: { form: "duplicate-period" } };
    if (message.includes("not billable")) return { ok: false, errors: { form: "no-subscription" } };
    return { ok: false, errors: { form: "service" } };
  }

  const { invoice_id: invoiceId, invoice_number: number } = issued[0];
  const totals = lineTotals(lines);
  const issuedAt = new Date().toISOString().slice(0, 10);
  const dueAt = new Date(Date.now() + dueDays * 86_400_000).toISOString().slice(0, 10);

  /* Deliberately not awaited inside a try that could roll anything back: the
     invoice exists and is numbered whatever happens here. */
  const path = await storeInvoicePdf(invoiceId, customerId, {
    number, issuedAt, dueAt, periodStart, periodEnd,
    customer: {
      name: customer.name, cvr: customer.cvr, address: customer.address,
      postcode: customer.postcode, city: customer.city, country: customer.country,
    },
    lines, ...totals,
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/billing");
  return path ? { ok: true } : { ok: true, message: "no-pdf" };
}
```

- [ ] **Step 2: Write the dialog**

Create `components/admin/InvoiceActions.tsx` exporting `IssueInvoiceDialog`. It renders a button that opens `Modal`, showing: period start and end date inputs (defaulted from the subscription's current period), a due-days number input defaulted to `ISSUER.paymentTermsDays`, a live preview table of the lines and totals computed client-side by the same `buildInvoiceLines`/`lineTotals`, and a warning banner when `ISSUER_IS_PLACEHOLDER` is true reading "Odatone's own CVR, address and bank details are still placeholders — this invoice's PDF will not be a valid Danish invoice." Submit calls `issueInvoice` through `useActionState`; on `ok` the dialog closes, matching the products dialog's behaviour.

- [ ] **Step 3: Wire it into the customer page**

In `app/admin/customers/[id]/page.tsx`, add `<IssueInvoiceDialog … />` to the invoices section header.

- [ ] **Step 4: Drive it**

Seed the local stack, sign in as staff, open a customer, issue an invoice. Confirm: the dialog preview matches the row that appears; the PDF exists in storage; issuing the same period again shows "already invoiced for this period" rather than creating a second row.

- [ ] **Step 5: Commit**

```bash
git add app/admin/customers/\[id\]/invoice-actions.ts components/admin/InvoiceActions.tsx app/admin/customers/\[id\]/page.tsx
git commit -m "Issue an invoice from the customer page"
```

---

## Task 7: Marking paid and voiding

**Files:**
- Modify: `app/admin/customers/[id]/invoice-actions.ts`
- Modify: `components/admin/InvoiceActions.tsx`

**Interfaces:**
- Produces: `markInvoicePaid(prev, formData)`, `voidInvoice(prev, formData)`; `<MarkPaidDialog invoiceId number />`, `<VoidInvoiceDialog invoiceId number />`.

- [ ] **Step 1: Add both actions**

Both read the caller's staff role the same way `issueInvoice` does, then write through the **session** client — not the service role. These are ordinary updates that `invoices_staff_write` already permits, so RLS should do the authorising; reaching for the service role here would bypass the policy for no reason.

`markInvoicePaid` sets `status = 'paid'`, `paid_at`, `payment_method` (one of `bank_transfer`, `card`, `other`) and `payment_reference`. It refuses when the invoice is already `paid` or `void`.

`voidInvoice` sets `status = 'void'` and a required `void_reason`, refusing an empty reason before the database's check constraint has to. It refuses to void a `paid` invoice: that needs a credit note, which is deferred.

- [ ] **Step 2: Add both dialogs and wire them per invoice row**

- [ ] **Step 3: Drive it**

Mark an invoice paid, confirm the row and the `/admin/billing` list both update. Void another with a reason. Confirm voiding without a reason is refused in the UI, and confirm directly against the database that amending an amount still raises.

- [ ] **Step 4: Commit**

```bash
git commit -am "Mark invoices paid and void them"
```

---

## Task 8: /admin/billing

**Files:**
- Create: `app/admin/billing/page.tsx`
- Modify: `components/admin/AdminSideNav.tsx`, `components/admin/icons.tsx`

**Interfaces:**
- Consumes: `fetchAllRows` from `lib/admin/paginate.ts`; `TableCard`, `Badge`, `statusTone`, `TopBar`, `AppShell`, `AdminSideNav`.
- Produces: the route, and `ReceiptGlyph` in `icons.tsx`.

- [ ] **Step 1: Add the glyph**

In `components/admin/icons.tsx`, add `ReceiptGlyph` in the same 16×16, 1.5px `currentColor` geometry as the others.

- [ ] **Step 2: Add the nav row**

In `components/admin/AdminSideNav.tsx`, add `{ href: "/admin/billing", label: "Billing", icon: <ReceiptGlyph className="h-[17px] w-[17px]" /> }` between Customers and Products.

- [ ] **Step 3: Build the page**

Every invoice joined to its customer's name, newest first, through `fetchAllRows` so the 1000-row PostgREST cap cannot silently truncate the list. Columns: number (monospace), customer (linking to the customer), issued, due, total, status. Status is `Badge` with `statusTone`, except that an `open` invoice whose `due_at` is in the past renders as "overdue" in the `bad` tone — **computed, never written**, because nothing in this slice automates dunning and the `overdue` enum value belongs to slice 4. A `?status=` query parameter filters, matching the existing `?status=pending` convention on `/admin/customers`.

- [ ] **Step 4: Drive it**

Issue several invoices across two customers, one with a past due date. Confirm the list, the overdue rendering, and the filter.

- [ ] **Step 5: Commit**

```bash
git add app/admin/billing components/admin/AdminSideNav.tsx components/admin/icons.tsx
git commit -m "Add the admin billing list"
```

---

## Task 9: Downloading the PDF

**Files:**
- Create: `app/api/invoices/[id]/pdf/route.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server.ts`; `createAdminClient`.
- Produces: `GET /api/invoices/:id/pdf` → 307 to a signed URL, or 401/404/409.

- [ ] **Step 1: Write the route**

Read the invoice through the **session** client. RLS does the authorising: `invoices_read` already admits the owning customer and any staff member, so a request for someone else's invoice returns no row and the route answers 404 — it must not answer 403, which would confirm the invoice exists.

If the row exists but `pdf_path` is null, answer **409** with a short JSON body saying the document is still being generated. It must not 500: a failed upload is a known, recoverable state, not a crash.

Otherwise mint a signed URL with the service-role client, valid 60 seconds, and 307 to it.

Read `node_modules/next/dist/docs/` on route handlers before writing this; params are async in this version.

- [ ] **Step 2: Drive it**

As staff, download an invoice — confirm the bytes start with `%PDF`. As the owning customer, the same. As a *different* customer, confirm 404. Null the `pdf_path` of one invoice directly in the database and confirm 409, not 500.

- [ ] **Step 3: Commit**

```bash
git add app/api/invoices
git commit -m "Serve invoice PDFs through an authorised signed URL"
```

---

## Task 10: The portal's billing page

**Files:**
- Create: `components/portal/PortalShell.tsx`, `app/my-odatone/billing/page.tsx`
- Modify: `app/my-odatone/page.tsx`, `lib/content/portal.ts`

**Interfaces:**
- Produces: `<PortalShell locale activeHref customerName roleLabel>{children}</PortalShell>` wrapping `AppShell` + `SideNav` + the workspace, theme, language and user chrome that `app/my-odatone/page.tsx` currently builds inline.

- [ ] **Step 1: Extract the shell**

`app/my-odatone/page.tsx` builds the whole sidebar inline. With three portal pages that becomes three copies, which is how the admin nav drifted before `AdminSideNav` existed. Move it to `components/portal/PortalShell.tsx` first, with the summary page as its only caller, and confirm the page renders identically before adding anything.

- [ ] **Step 2: Add the copy**

In `lib/content/portal.ts`, add a `billing` block: nav label, heading, the table headers, status labels, "Download PDF", an empty state, and the subscription summary labels. Danish first, both languages, as `L10n`.

- [ ] **Step 3: Build the page**

The customer's invoices newest first — number, period, due, total, status, and a download link to `/api/invoices/:id/pdf`. Above them, the current subscription: plan, term, price per period, next renewal. RLS scopes the read; the page passes no customer id of its own.

- [ ] **Step 4: Drive it**

Sign in as a customer with invoices. Confirm they see only their own, in both languages, and that the download works.

- [ ] **Step 5: Commit**

```bash
git add components/portal/PortalShell.tsx app/my-odatone lib/content/portal.ts
git commit -m "Add the customer billing page"
```

---

## Task 11: The portal's settings page

**Files:**
- Create: `app/my-odatone/settings/page.tsx`, `app/my-odatone/settings/actions.ts`
- Modify: `lib/content/portal.ts`, `components/portal/PortalShell.tsx`

**Interfaces:**
- Produces: `updateBillingDetails(prev, formData): Promise<ActionResult>`.

- [ ] **Step 1: Write the action**

Writes `billing_email`, `cvr`, `address`, `postcode`, `city`, `phone` on the caller's own customer through the **session** client. It passes no customer id: the row is found by `auth_customer_id()` through `customers_owner_update`, which already restricts the write to the `owner` role. A `manager` submitting the form matches zero rows — Postgres does not error for that — so the action detects the refusal with `.select("id")` and an empty result and reports it, exactly as `updatePlan` does for `plans_admin_write`.

The company **name** is not writable here. It is what already-issued invoices say.

Validate: billing email against `EMAIL_RE` from `lib/forms.ts`; CVR as exactly 8 digits or blank; every text field bounded at 200 characters, rejected rather than truncated.

- [ ] **Step 2: Build the page**

The form, plus a read-only row showing the company name with a note that Odatone changes it. For a `manager`, render every field disabled with a line saying only an owner can change billing details.

- [ ] **Step 3: Add the copy and the nav row**

- [ ] **Step 4: Drive it**

As an owner, change the billing email and confirm it persists and appears on the next issued invoice's PDF. As a manager, confirm the form is read-only and that submitting it anyway (via the browser console) is refused.

- [ ] **Step 5: Commit**

```bash
git add app/my-odatone/settings lib/content/portal.ts components/portal/PortalShell.tsx
git commit -m "Add the customer settings page"
```

---

## Done when

- `node --test test/` passes, including the new `test/invoicing.test.ts`.
- `npx supabase test db` passes, including the new `supabase/tests/invoicing.test.sql`.
- `npx tsc --noEmit` and `npx next build` are clean.
- A staff member can issue, mark paid and void an invoice, and see all of them at `/admin/billing`.
- A customer can see their invoices at `/my-odatone/billing`, download a PDF, and edit their details at `/my-odatone/settings`.
- `lib/invoice-issuer.ts` still holds placeholders, and the issue dialog says so.
