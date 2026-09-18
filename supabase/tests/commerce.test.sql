begin;
select plan(6);

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

-- total_ore = subtotal_ore + vat_ore is exactly the contract invoiceTotals()
-- will promise in Task 5 — an invoice can never disagree with the sum of its
-- own parts, and none of the three money columns may go negative.
insert into customers (id, name, billing_email) values
  ('00000000-0000-0000-0000-0000000000f1', 'Constraint Test Co', 'constraints@example.test');

select throws_ok(
  $$ insert into invoices (customer_id, number, subtotal_ore, vat_ore, total_ore, source)
     values ('00000000-0000-0000-0000-0000000000f1', 'INV-NEG', -100, 0, -100, 'seed') $$,
  '23514',
  null,
  'a negative invoice total is rejected'
);

select throws_ok(
  $$ insert into invoices (customer_id, number, subtotal_ore, vat_ore, total_ore, source)
     values ('00000000-0000-0000-0000-0000000000f1', 'INV-MISMATCH', 10000, 2500, 20000, 'seed') $$,
  '23514',
  null,
  'an invoice total that disagrees with subtotal + vat is rejected'
);

select * from finish();
rollback;
