# Odatone billing and customer portal — design

**Status:** approved in conversation 2026-09-28; awaiting implementation plan.

**Scope:** Slice 3 of the five named in
`docs/superpowers/specs/2026-09-18-odatone-admin-and-customer-portal-design.md`
— Odatone's own billing records, end to end, plus the customer portal's
billing and settings screens.

**Explicitly not this spec:** taking money. No card, no Stripe, no charge.
That is slice 4, and nothing here is throwaway when it arrives: slice 4 adds
a payment rail to invoices this slice already issues.

**Depends on:** slice 1 (schema, RLS, both logins, admin core), already shipped.

---

## Why this shape

The original roadmap put the portal in slice 3 and *all* billing in slice 4,
on the assumption that Stripe would issue the invoices. It will not. Odatone
issues its own invoices and Stripe, when it arrives, is only the card rail.

That single decision moves invoice generation out of slice 4 entirely, because
generating an invoice no longer needs a payment provider. It is why this spec
can ship a complete billing system while the Stripe account does not yet
exist.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| Who issues the invoice | Odatone. Stripe (slice 4) only charges. | Keeps numbering, VAT and the document Danish and under Odatone's control. |
| When is one created | A staff member clicks **Issue invoice**. | No scheduled job to get wrong at this volume. Automation later needs no data change. |
| Draft invoices | None. A row exists only once it is numbered and open. | Makes gapless numbering structural rather than maintained. The preview is computed in memory. |
| Numbering | `YYYY-NNNN`, gapless, from a locked counter row. | Danish law requires gapless. A Postgres sequence is wrong: sequences skip on rollback. |
| VAT | 25% on everything. | Every customer is Danish (`customers.country` defaults to `DK`). |
| The document | A PDF, generated at issue and stored. | Customers and their bookkeepers file the PDF; it is the invoice. |
| PDF renderer | `@react-pdf/renderer` | Runs in a plain Node function. Headless Chrome would keep screen and PDF identical but costs a browser binary and a cold start on a rarely-pressed button. |
| Immutability | Enforced by a trigger, not convention. | An issued invoice must not change. Regenerating on download would let a template edit silently rewrite history. |
| Customer self-service | Billing details and invoice history. Plan changes go through Odatone. | No accidental downgrades, no proration rules to design yet. The card half arrives in slice 4. |

## Data model

### `invoice_lines` (new)

```sql
create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  position    integer not null,
  description text not null,
  quantity    integer not null check (quantity > 0),
  unit_ore    integer not null check (unit_ore >= 0),
  -- Generated, not checked: a line can never disagree with its own
  -- arithmetic because there is no second place to write it. Same reasoning
  -- as billing_email_lower in 0008.
  amount_ore  integer generated always as (quantity * unit_ore) stored,
  unique (invoice_id, position)
);

create index if not exists invoice_lines_invoice_id_idx on invoice_lines (invoice_id);
```

`invoices.subtotal_ore` must equal the sum of its lines. That cannot be a
Postgres check constraint (a check cannot aggregate across rows), so it is
guaranteed by construction instead: `issue_invoice` writes the header and its
lines in one statement from one computed result, and the immutability trigger
below stops either side drifting afterwards.

### `invoice_counters` (new)

```sql
create table if not exists invoice_counters (
  year        integer primary key,
  next_number integer not null default 1
);
```

### `invoices` (columns added)

| Column | Type | Meaning |
| --- | --- | --- |
| `paid_at` | `timestamptz` | When payment was recorded. Null until paid. |
| `payment_method` | `text` | `bank_transfer` today; `card` in slice 4. |
| `payment_reference` | `text` | Bank reference, or the Stripe payment intent later. |
| `void_reason` | `text` | Voiding never deletes. Required by a check constraint: `status <> 'void' or void_reason is not null`, so "required" is enforced rather than remembered. |
| `pdf_path` | `text` | Object path in the `invoices` storage bucket. Null only if generation failed. |
| `issued_by` | `uuid references profiles(id)` | Who issued it. |

### Enum values deliberately left unused

`invoice_status` already carries `draft` and `overdue`. Neither is written by
this slice: there are no draft rows, and nothing here automates dunning.
Overdue is *computed* for display from `due_at < now()` on an `open` invoice.
The migration says so, so the next reader does not think they were forgotten.

## Issuing an invoice

`issue_invoice(customer_id, period_start, period_end, due_days)` — a
`SECURITY DEFINER` function with `set search_path = public, pg_temp`, EXECUTE
revoked from `public`, `anon` and `authenticated`, granted only to
`service_role`. The same shape as `0007_apply_signup_order.sql`.

1. Lock this year's counter row `for update`, inserting it if absent.
2. Re-read the customer's subscription and locations under that lock. The
   subscription must exist and be `active`, `trialing` or `past_due`; a
   `pending` or `cancelled` one raises and issues nothing. A customer with
   more than one subscription row uses the most recent by `created_at`, the
   same rule `latestSubscription` already applies in the portal and admin.
3. Compute the lines (see below) and the totals.
4. Insert the invoice with `number = to_char(year) || '-' || lpad(next, 4, '0')`
   and status `open`.
5. Insert the lines.
6. Bump `next_number`.
7. Return the invoice id and number.

Steps 1–7 are one transaction, so a failure anywhere leaves no number consumed
and no partial invoice.

The PDF is **not** made here — it is rendered in Node after the function
returns, then uploaded, then `pdf_path` is set. If that fails the invoice still
exists and is regenerable from its own frozen rows. A missing PDF is
recoverable; a gap in the numbering is not.

### Where the lines come from

`lib/invoicing.ts`, a new pure module:

```ts
export type InvoiceLineDraft = {
  position: number;
  description: string;
  quantity: number;
  unitOre: number;
};

export function buildInvoiceLines(input: {
  plan: Plan;
  billing: Billing;
  locations: number;
  periodStart: string;
  periodEnd: string;
  locale: Locale;
}): InvoiceLineDraft[];
```

It calls `quote()` from `lib/pricing.ts` rather than re-deriving anything.
`quote()` already applies the volume tiers and the annual discount and already
backs both the public pricing page and the admin MRR figure; a second
implementation would disagree the first time a discount changed.

One line per subscription. Quantity is the number of locations. The unit price
is what one location costs **for the period being invoiced** — `perLocation`
for a monthly term, `perLocation × 12` for an annual one. Getting this wrong is
easy and expensive: `quote()`'s `perLocation` is always a *monthly* rate, so
billing an annual subscription at `perLocation` would undercharge by a factor
of twelve. The description names the plan, the term and the period. Add-ons
become further lines when `subscription_addons` has rows.

**The lines are authoritative for the total, not `quote()`.** `quote()` rounds
to two decimal kroner at each step, so `toOre(perLocation) × locations` can
differ from `toOre(monthlyExVat)` by a few øre on some location counts.
`invoices.subtotal_ore` is therefore defined as the sum of its lines, VAT is
`vatOre()` of that sum, and the total is the sum of those two — so the document
always adds up in the reader's hand, which is the property that matters on an
invoice. A test pins the largest divergence this can produce against `quote()`
so it is a known, bounded quantity rather than a surprise.

Pure and synchronous, so it is covered by `node --test` without a database.

## Immutability

```sql
create or replace function guard_invoice_immutable() returns trigger ...
```

A `before update` trigger on `invoices` that raises unless every changed column
is one of `status`, `paid_at`, `payment_method`, `payment_reference`,
`void_reason`, `pdf_path`. Amounts, `number`, `customer_id`, `issued_at`,
`period_start` and `period_end` are frozen the moment the row exists.

`invoice_lines` gets a matching `before update or delete` trigger: an issued
invoice's lines are as fixed as its total.

Like `guard_customer_status` in `0003_tenancy.sql`, this trigger is **not**
`SECURITY DEFINER`, and it exempts no role. The earlier ruling that a definer
trigger could check `current_user` was wrong — `current_user` inside a definer
function reports the function's owner — and that mistake is not repeated here.

## Security

`invoices_read` and `invoices_staff_write` already exist in `0003_tenancy.sql`
and need no change. `invoice_lines` gets policies mirroring them exactly, keyed
through `invoice_id`:

```sql
create policy invoice_lines_read on invoice_lines for select
  using (exists (select 1 from invoices i
                 where i.id = invoice_id
                   and (i.customer_id = auth_customer_id() or is_staff())));

create policy invoice_lines_staff_write on invoice_lines for all
  using (is_staff()) with check (is_staff());
```

PDFs live in a **private** Supabase Storage bucket named `invoices`, at
`<customer_id>/<invoice_id>.pdf`. No storage RLS policy is relied on: the
bucket is private, and every download goes through a server route that
authorises the reader against `invoices_read` first and then mints a
short-lived signed URL. Authorisation stays in one place rather than being
half in Postgres and half in storage rules.

## Admin surfaces

**`/admin/billing`** — a new nav row. Every invoice, newest first: number,
customer, issued, due, total, status. Filterable by status, with overdue
computed from `due_at`. Paginated through the existing `fetchAllRows` helper,
which already handles PostgREST's 1000-row cap.

**`/admin/customers/[id]`** — the existing invoice section gains **Issue
invoice**, and per-row **Mark paid** and **Void**. All three open in the
`Modal` component built for products.

**Issue invoice dialog** — pick the period (defaulting to the subscription's
current one) and the payment terms; see the exact lines, subtotal, VAT and
total that will be written; confirm. The preview is computed by the same
`buildInvoiceLines` the function uses, so what is shown is what is issued.

**Mark paid dialog** — date, method, reference.
**Void dialog** — a required reason.

Who may do what: issuing, marking paid and voiding are writes to `invoices`,
which `invoices_staff_write` admits for any staff role. This slice does not
narrow that to `staff_admin` — support staff chasing a payment is the normal
case — and the spec records it as a decision rather than an oversight.

## Portal surfaces

**`/my-odatone/billing`** — the customer's invoices, with status and a PDF
download. Current plan, what it costs and when it next renews.

**`/my-odatone/settings`** — billing email, CVR, address, phone. The existing
`customers_owner_update` policy already restricts this to the `owner` role, so
a `manager` sees the same screen read-only with no new policy work. The
company *name* is not editable here: it is what the invoices already issued
say, and changing it is a conversation with Odatone.

Both are bilingual through `lib/content/portal.ts`, like every other portal
screen. The sidebar grows from one row to three: Oversigt, Fakturering,
Indstillinger.

## The PDF

`@react-pdf/renderer` in a Node route. Layout, top to bottom: the Odatone
wordmark; "Faktura" with the number and dates; seller and buyer blocks side by
side; the line table with quantity, unit price and amount; subtotal, "Moms
25%", total; payment terms and bank details; a footer carrying Odatone's CVR.

Danish characters need no font work — react-pdf's built-in Helvetica covers
æ, ø and å.

### Seller details are an input, not a decision

`lib/invoice-issuer.ts` exports one frozen object: Odatone's legal name, CVR,
address, bank registration and account number, IBAN, and default payment
terms. **These values are not known at the time of writing.** The module ships
with clearly marked placeholders and a comment stating that the generated PDF
is not a legally valid Danish invoice until they are replaced. Implementation
is complete without them; the product is not.

## Testing

**`node --test`** — `buildInvoiceLines` against every plan, both billing terms,
the volume-tier boundaries and multi-location cases; invoice number
formatting; the existing `invoiceTotals` contract extended to lines.

**pgTAP** — that two concurrent `issue_invoice` calls produce consecutive
numbers with no gap and no duplicate; that the immutability trigger rejects an
amount change and permits a status change; that a customer can read their own
invoice lines and not another customer's; that a rolled-back issue consumes no
number.

**Driven end to end** against the local stack: a staff member issues an
invoice, the PDF lands in storage, the customer signs in, sees it, downloads
it, and the bytes open as a PDF.

## Deferred

Credit notes. Dunning and payment reminders. Bookkeeping export (e-conomic,
Dinero). Partial payments. Multi-currency. EU reverse charge and non-Danish
VAT. Automatic period rollover. Customer-initiated plan changes and
cancellation. All of `draft` and `overdue` as written statuses.
