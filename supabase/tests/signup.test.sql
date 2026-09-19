begin;
select plan(13);

-- Task 13's fix rounds 3-5 built the entire duplicate-signup/reuse defence
-- on two things: a generated, stored `billing_email_lower` column matched
-- with a plain `.eq()` (never `like`/`ilike`, which PostgREST's own
-- wildcard rewrite made exploitable), and `apply_signup_order`, a
-- SECURITY DEFINER function that re-checks every eligibility condition
-- under its own row lock rather than trusting the application's earlier
-- read. This file exists because a green suite did not, before this,
-- catch a revert of either — the single most dangerous code path in this
-- codebase had no pgTAP coverage at all.

-- ---------------------------------------------------------------------
-- billing_email_lower: generated, stored, and the thing the unique
-- constraint actually protects.
-- ---------------------------------------------------------------------

select has_column('public', 'customers', 'billing_email_lower',
  'customers.billing_email_lower exists');

select is(
  (select is_generated from information_schema.columns
   where table_schema = 'public' and table_name = 'customers'
     and column_name = 'billing_email_lower'),
  'ALWAYS',
  'billing_email_lower is a generated column, not a plain one the app could forget to maintain'
);

select is(
  (select generation_expression from information_schema.columns
   where table_schema = 'public' and table_name = 'customers'
     and column_name = 'billing_email_lower'),
  'lower(billing_email)',
  'billing_email_lower is generated from lower(billing_email) specifically'
);

-- A generated column cannot be written to directly — Postgres itself
-- enforces this (428C9), not application code, but it is worth pinning:
-- if a future migration ever changed this to a plain, trigger-maintained
-- column instead, this is the test that would need to change with it.
select throws_ok(
  $$ insert into customers (id, name, billing_email, billing_email_lower)
     values ('00000000-0000-0000-0000-0000000000e1', 'Direct Write Co', 'direct@example.test', 'direct@example.test') $$,
  '428C9',
  null,
  'writing billing_email_lower directly is rejected — only Postgres itself may set it'
);

-- The behaviour the whole fix exists for: two customers whose billing
-- emails differ only in case collide on the unique index. This is the
-- fact fix round 3 needed and fix round 4 found the WRONG way to enforce
-- (via .ilike(), which PostgREST's own "*" -> "%" rewrite made
-- exploitable) — the column plus a plain index is the right way, and this
-- is what a regression back to a case-sensitive plain `billing_email`
-- index would fail.
insert into customers (id, name, billing_email) values
  ('00000000-0000-0000-0000-0000000000e2', 'Mixed Case Co', 'Mixed@Case.test');

select throws_ok(
  $$ insert into customers (id, name, billing_email)
     values ('00000000-0000-0000-0000-0000000000e3', 'Mixed Case Co 2', 'mixed@case.test') $$,
  '23505',
  null,
  'a billing email differing only in case is rejected as a duplicate'
);

-- ---------------------------------------------------------------------
-- apply_signup_order: SECURITY DEFINER, and every eligibility condition
-- re-checked under its own lock, not trusted from the caller.
-- ---------------------------------------------------------------------

select has_function('public', 'apply_signup_order',
  array['uuid','text','text','text','text','text','text','text','billing_term','jsonb'],
  'apply_signup_order exists with its expected signature');

select is_definer('public', 'apply_signup_order',
  array['uuid','text','text','text','text','text','text','text','billing_term','jsonb'],
  'apply_signup_order is SECURITY DEFINER — it must re-check everything itself, since it does not run as its caller'
);

-- An eligible customer: pending, no invoice, no owner. The success path
-- every reuse (and now every first-time create too, since fix round 4)
-- depends on.
insert into customers (id, name, billing_email, status) values
  ('00000000-0000-0000-0000-0000000000e4', 'Eligible Co', 'eligible@example.test', 'pending');

select lives_ok(
  $$ select apply_signup_order(
       '00000000-0000-0000-0000-0000000000e4', 'Eligible Co Renamed', null, null, null, null, null,
       'small', 'monthly',
       '[{"name":"Loc 1","venue_type":"cafe","m2":50,"hours_band":"normal"}]'::jsonb
     ) $$,
  'apply_signup_order succeeds for an eligible (pending, uninvoiced, unowned) customer'
);

select results_eq(
  $$ select name from customers where id = '00000000-0000-0000-0000-0000000000e4' $$,
  $$ values ('Eligible Co Renamed'::text) $$,
  'a successful call actually applies the new name'
);

-- Not pending.
update customers set status = 'active' where id = '00000000-0000-0000-0000-0000000000e4';

select throws_ok(
  $$ select apply_signup_order(
       '00000000-0000-0000-0000-0000000000e4', 'x', null, null, null, null, null,
       'small', 'monthly', '[]'::jsonb
     ) $$,
  'P0001',
  null,
  'apply_signup_order refuses a customer that is no longer pending'
);

-- Already invoiced.
update customers set status = 'pending' where id = '00000000-0000-0000-0000-0000000000e4';
insert into invoices (customer_id, number, subtotal_ore, vat_ore, total_ore, source) values
  ('00000000-0000-0000-0000-0000000000e4', 'INV-SIGNUP-TEST', 1000, 250, 1250, 'seed');

select throws_ok(
  $$ select apply_signup_order(
       '00000000-0000-0000-0000-0000000000e4', 'x', null, null, null, null, null,
       'small', 'monthly', '[]'::jsonb
     ) $$,
  'P0001',
  null,
  'apply_signup_order refuses a customer that already has an invoice'
);

-- Already owned. This is fix round 5's own finding: rounds 3 and 4 checked
-- status and invoices under the lock but not this — a pending, uninvoiced
-- customer that already had an owner profile still had its name, CVR,
-- every location and its subscription silently replaced.
delete from invoices where customer_id = '00000000-0000-0000-0000-0000000000e4';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e5', 'owner-e4@example.test');
insert into profiles (id, customer_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000e4', 'owner', 'Existing Owner');

select throws_ok(
  $$ select apply_signup_order(
       '00000000-0000-0000-0000-0000000000e4', 'Attacker Co', null, null, null, null, null,
       'small', 'monthly', '[]'::jsonb
     ) $$,
  'P0001',
  null,
  'apply_signup_order refuses a customer that already has an owner'
);

select results_eq(
  $$ select name from customers where id = '00000000-0000-0000-0000-0000000000e4' $$,
  $$ values ('Eligible Co Renamed'::text) $$,
  'the refused call left the owned customer''s name untouched'
);

select * from finish();
rollback;
