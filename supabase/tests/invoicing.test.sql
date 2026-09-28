begin;
select plan(24);

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
