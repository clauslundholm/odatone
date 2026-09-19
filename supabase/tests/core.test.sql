begin;
select plan(10);

select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'locations', 'locations table exists');
select has_table('public', 'profiles', 'profiles table exists');

/* Task 15 fix round 2: lib/gdpr.ts's CUSTOMER_PII_COLUMNS is a
   hand-maintained list of the columns on `customers` that hold personal
   data, and test/gdpr.test.ts already holds anonymisedCustomer's own keys
   accountable to it. But both of those live in the same TypeScript file,
   so the only drift they can ever catch is between two lists that were
   never checked against the actual schema at all -- which is exactly how
   0005_customer_phone.sql's `phone` shipped without erasure ever
   scrubbing it: nothing connected "a column was added to customers" to
   "someone decided whether it's personal data."

   This closes that gap from the schema side, where SQL can actually see
   it. It lists every column on `customers` today, split into the two
   things a column can be -- personal data (the same seven names as
   lib/gdpr.ts's CUSTOMER_PII_COLUMNS) or not (with a one-line reason
   each) -- and compares that combined list against
   information_schema.columns. A migration that adds any column to
   `customers` and puts it in neither list fails this test, with a message
   that says exactly what decision is missing, until someone consciously
   adds it to one side or the other. Proven live in fix round 2: a scratch
   `alter table customers add column ...` made this fail with the new
   column named as neither classified nor exempted, before being reverted;
   see task-15-report.md for the exact failure text. */
select results_eq(
  $$ select column_name::text collate "C" from information_schema.columns
     where table_schema = 'public' and table_name = 'customers'
     order by column_name $$,
  $$ values
       ('name'::text collate "C"),  -- personal: the business/contact name
       ('billing_email'),       -- personal: contact email
       ('cvr'),                 -- personal: Danish business registration number
       ('address'),             -- personal: street address
       ('postcode'),            -- personal: part of the address
       ('city'),                -- personal: part of the address
       ('phone'),               -- personal: direct contact number (0005_customer_phone.sql)
       ('id'),                  -- not personal: surrogate key, needed to keep an erased row traceable to itself
       ('country'),             -- not personal: every row is 'DK' today; even a real value only ever names a jurisdiction
       ('status'),              -- not personal: operational lifecycle state
       ('created_at'),          -- not personal: operational
       ('updated_at'),          -- not personal: operational
       ('billing_email_lower')  -- not personal: generated from billing_email (0008_customer_email_lower_column.sql); tombstoning billing_email already tombstones this
     order by 1 $$,
  'every column on customers must be classified: personal data (add it to CUSTOMER_PII_COLUMNS in lib/gdpr.ts, and to anonymisedCustomer''s tombstone) or explicitly not (add it to this test''s non-PII list here, with a reason) -- an unclassified column is exactly how customers.phone shipped without erasure scrubbing it'
);

-- profiles.id references auth.users(id), so the two profiles rows below each
-- need a backing auth.users row. Only the columns the tenancy assertions
-- actually need are set; every other auth.users column is nullable or has
-- a default in this Supabase version.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'nocustomer@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'staff@example.test');

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

-- 0004_audit_triggers.sql's fix round: customers had no audit trigger at
-- all. It has one now, but unlike plans_audit/addons_audit it must never
-- store a customer's actual PII, in either direction, because
-- eraseCustomer (app/admin/customers/[id]/gdpr-actions.ts) relies on this
-- audit trail never becoming a second place a name or email outlives its
-- own erasure.
insert into customers (id, name, billing_email) values
  ('00000000-0000-0000-0000-0000000000c1', 'Audit Test Co', 'audit@example.test');

update customers set billing_email = 'changed@example.test' where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select count(*)::int from audit_log where entity = 'customer' and entity_id = '00000000-0000-0000-0000-0000000000c1'),
  2,
  'customers_audit logs both the insert and the billing_email change'
);

select is(
  (select (before ->> 'billing_email') from audit_log
     where entity = 'customer' and entity_id = '00000000-0000-0000-0000-0000000000c1' and action = 'UPDATE'),
  '[redacted]',
  'a customer''s real billing_email never lands in audit_log''s before column'
);

select is(
  (select (after ->> 'billing_email') from audit_log
     where entity = 'customer' and entity_id = '00000000-0000-0000-0000-0000000000c1' and action = 'UPDATE'),
  '[redacted]',
  'a customer''s real billing_email never lands in audit_log''s after column either'
);

-- Same no-op guard log_plan_change() already had: re-saving a customer
-- with nothing actually changed (only updated_at moves) must not write a
-- second, identical audit row.
update customers set updated_at = now() where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select count(*)::int from audit_log where entity = 'customer' and entity_id = '00000000-0000-0000-0000-0000000000c1'),
  2,
  'a no-op customer save (only updated_at moves) writes no new audit_log row'
);

select * from finish();
rollback;
