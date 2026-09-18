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
