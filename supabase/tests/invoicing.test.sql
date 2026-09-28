begin;
select plan(18);

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

select * from finish();
rollback;
