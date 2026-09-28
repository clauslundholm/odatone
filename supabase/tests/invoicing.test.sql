begin;
-- 24 before this branch's final fix round; +2 for the allowlist immutability
-- guard (created_at, id), +4 for invoice_lines RLS (both customer directions
-- plus the staff arm), +3 for "a rolled-back issue consumes no number".
select plan(33);

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
  '23001', null,
  'an issued invoice cannot have its subtotal amended');

select throws_ok(
  $$ update invoices set number = '2026-9999' where number = '1999-0001' $$,
  '23001', null,
  'an issued invoice cannot be renumbered');

-- guard_invoice_immutable (0010_invoice_lines.sql) is an ALLOWLIST over the
-- whole row, not an enumeration of the frozen columns. These two are the
-- assertions that tell the difference: created_at and id were never in the
-- old denylist, so both were quietly amendable on an issued invoice while
-- every other assertion in this file stayed green -- and every column a
-- later slice adds (the next one adds payment columns) would have arrived
-- unguarded the same way, silently. Under an allowlist a new column is
-- frozen by default, and these two prove the allowlist is what is running.
select throws_ok(
  $$ update invoices set created_at = '2000-01-01T00:00:00Z' where number = '1999-0001' $$,
  '23001', null,
  'an issued invoice cannot have its created_at rewritten');

select throws_ok(
  $$ update invoices set id = '1111aaaa-0000-0000-0000-0000000000ff' where number = '1999-0001' $$,
  '23001', null,
  'an issued invoice cannot have its primary key rewritten');

select lives_ok(
  $$ update invoices set status = 'paid', paid_at = now(), payment_method = 'bank_transfer'
     where number = '1999-0001' $$,
  'payment state may still be recorded');

select throws_ok(
  $$ update invoice_lines set quantity = 5 where position = 1 $$,
  '23001', null,
  'an issued invoice line cannot be changed');

select throws_ok(
  $$ delete from invoice_lines where position = 1 $$,
  '23001', null,
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

-- ---------------------------------------------------------------------
-- invoice_lines RLS: the policy, not just the switch.
--
-- The assertion above proves only that row level security is ENABLED on the
-- table. It says nothing about whether invoice_lines_read is CORRECT:
-- dropping its is_staff() arm, or the `invoice_lines.` qualification on
-- invoice_id (which is what ties the subquery to the outer row rather than
-- to itself), would leave every other assertion in this file green while
-- every customer read every other customer's line items. The spec's
-- obligation is "a customer can read their own invoice lines and not another
-- customer's", so both directions are asserted here, from an actual customer
-- session -- impersonated the way supabase/tests/tenancy.test.sql does it,
-- with the `authenticated` role plus a request.jwt.claims sub, which is what
-- auth.uid() and therefore auth_customer_id() read.
--
-- Café C exists only for this: customer 0002's invoice count is asserted
-- exactly further down, so the "someone else's invoice" fixture cannot be
-- hung off either of the two customers already in play.
-- ---------------------------------------------------------------------
insert into customers (id, name, billing_email) values
  ('cccc0000-0000-0000-0000-000000000003', 'Café C', 'c@example.test');

insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001', 'owner-a@invoicing.test'),
  ('aaaa1111-0000-0000-0000-000000000003', 'owner-c@invoicing.test'),
  ('aaaa1111-0000-0000-0000-0000000000ff', 'staff@invoicing.test');

insert into profiles (id, customer_id, role, full_name) values
  ('aaaa1111-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'owner', 'Owner A'),
  ('aaaa1111-0000-0000-0000-000000000003', 'cccc0000-0000-0000-0000-000000000003', 'owner', 'Owner C'),
  ('aaaa1111-0000-0000-0000-0000000000ff', null, 'staff_admin', 'Staff');

insert into invoices (id, customer_id, number, subtotal_ore, vat_ore, total_ore, status, source)
values ('1111cccc-0000-0000-0000-000000000003',
        'cccc0000-0000-0000-0000-000000000003',
        '1999-0003', 20000, 5000, 25000, 'open', 'seed');

insert into invoice_lines (invoice_id, position, description, quantity, unit_ore)
values ('1111cccc-0000-0000-0000-000000000003', 1, 'Main Stage', 1, 20000);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaa1111-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::integer from invoice_lines
    where invoice_id = '1111aaaa-0000-0000-0000-000000000001'),
  1, 'a customer can read their own invoice lines');

select is(
  (select count(*)::integer from invoice_lines
    where invoice_id = '1111cccc-0000-0000-0000-000000000003'),
  0, 'a customer cannot read another customer''s invoice lines');

-- Asserted unfiltered as well: the two reads above could both pass a policy
-- that happened to leak rows only when nothing narrowed the query.
select is(
  (select count(*)::integer from invoice_lines),
  1, 'an unfiltered read returns the customer''s own lines and nothing else');

-- The other arm of the same policy. Without this, dropping `is_staff()` from
-- invoice_lines_read would break every admin invoice view in the product
-- while the two customer assertions above -- and every other test on this
-- branch -- stayed green.
set local "request.jwt.claims" to '{"sub":"aaaa1111-0000-0000-0000-0000000000ff","role":"authenticated"}';

select is(
  (select count(*)::integer from invoice_lines),
  2, 'staff read every customer''s invoice lines');

reset role;
reset "request.jwt.claims";

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

-- ---------------------------------------------------------------------
-- "a rolled-back issue consumes no number" (spec, Testing).
--
-- This is the property that makes gaplessness survive a failure, and it is
-- the entire reason 0010_invoice_lines.sql uses a locked counter ROW rather
-- than a Postgres sequence: nextval() is non-transactional, so an issue that
-- rolled back would take its number with it and leave a hole that Danish
-- bookkeeping law does not allow. `update invoice_counters set next_number =
-- next_number + 1` does roll back. A savepoint is how that is observed from
-- inside pgTAP's own enclosing transaction.
--
-- Deliberately no assertion between the savepoint and the rollback: the call
-- either succeeds (and is then undone) or raises and fails the whole file
-- loudly. The assertions are all taken afterwards, where nothing about them
-- can itself be rolled back.
-- ---------------------------------------------------------------------
savepoint rolled_back_issue;

select issue_invoice('cccc0000-0000-0000-0000-000000000002',
  '2026-01-01', '2026-02-01', 14, null,
  '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb);

rollback to savepoint rolled_back_issue;

select is(
  (select count(*)::integer from invoices where customer_id = 'cccc0000-0000-0000-0000-000000000002'),
  0, 'a rolled-back issue leaves no invoice row behind');

select is(
  (select count(*)::integer from invoice_counters where year = extract(year from now())::integer),
  0, 'the year''s counter is rolled back with it, so no number was consumed');

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

-- the header comment on issue_invoice says it exists to prevent a numbered
-- header with no lines -- assert the lines actually landed, not just the
-- header's totals.
select is(
  (select count(*)::integer from invoice_lines l
     join invoices i on i.id = l.invoice_id
    where i.customer_id = 'cccc0000-0000-0000-0000-000000000002'
      and i.period_start = '2026-03-01'),
  1, 'the first invoice has exactly one line');

select is(
  (select (l.quantity = 1 and l.unit_ore = 19900 and l.amount_ore = 19900)
     from invoice_lines l
     join invoices i on i.id = l.invoice_id
    where i.customer_id = 'cccc0000-0000-0000-0000-000000000002'
      and i.period_start = '2026-03-01'),
  true, 'the line carries the quantity, unit price and amount it was issued with');

select is(
  (select sum(l.amount_ore)::integer from invoice_lines l
     join invoices i on i.id = l.invoice_id
    where i.customer_id = 'cccc0000-0000-0000-0000-000000000002'
      and i.period_start = '2026-03-01'),
  (select subtotal_ore from invoices
    where customer_id = 'cccc0000-0000-0000-0000-000000000002'
      and period_start = '2026-03-01'),
  'the line amounts sum to the invoice subtotal');

select is(
  (select left(number, 5) from invoices
    where customer_id = 'cccc0000-0000-0000-0000-000000000002'
      and period_start = '2026-03-01'),
  extract(year from now())::text || '-',
  'the issued number is prefixed with the current year');

-- The other half of the rolled-back-issue property: the number the undone
-- call took is handed straight back, so this issue -- the second call to
-- issue_invoice in this file -- is still 0001 and not 0002.
select is(
  (select right(number, 4) from invoices
    where customer_id = 'cccc0000-0000-0000-0000-000000000002'
      and period_start = '2026-03-01'),
  '0001', 'the issue after a rolled-back one still takes 0001 -- no gap');

-- the same period twice is refused, not silently duplicated -- and refused
-- with the specific "already invoiced" code, not just any error
select throws_ok(
  $$ select issue_invoice('cccc0000-0000-0000-0000-000000000002',
       '2026-03-01', '2026-04-01', 14, null,
       '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb) $$,
  'P0104', null,
  'issuing the same period twice is refused');

-- a null period defeats the "period end after period start" comparison
-- (NULL <= x is NULL, not false) and would otherwise mint an invoice with
-- no idempotency key at all
select throws_ok(
  $$ select issue_invoice('cccc0000-0000-0000-0000-000000000002',
       null, '2026-06-01', 14, null,
       '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb) $$,
  'P0101', null,
  'a null period is refused');

-- a negative due_days would back-date the due date to before the invoice
-- was even issued
select throws_ok(
  $$ select issue_invoice('cccc0000-0000-0000-0000-000000000002',
       '2026-07-01', '2026-08-01', -1, null,
       '[{"position":1,"description":"Test Medium","quantity":1,"unitOre":19900}]'::jsonb) $$,
  'P0101', null,
  'a negative due_days is refused');

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

select * from finish();
rollback;
