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

select * from finish();
rollback;
