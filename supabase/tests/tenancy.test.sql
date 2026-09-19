begin;
select plan(22);

-- Two customers: an owner and a manager at Café A, an owner at Café B, plus
-- one staff_admin and one staff_support member of staff. The manager and
-- staff_support accounts exist specifically to prove that "any staff" and
-- "any authenticated tenant member" are not the same authority as "owner"
-- or "staff_admin".
insert into customers (id, name, billing_email) values
  ('11111111-1111-1111-1111-111111111111', 'Café A', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'Café B', 'b@example.test');

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'owner-b@example.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'staff@odatone.test'),
  ('dddddddd-0000-0000-0000-000000000004', 'manager-a@example.test'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'support@odatone.test');

insert into profiles (id, customer_id, role, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'Owner A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', 'Owner B'),
  ('cccccccc-0000-0000-0000-000000000003', null, 'staff_admin', 'Staff Admin'),
  ('dddddddd-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'manager', 'Manager A'),
  ('eeeeeeee-0000-0000-0000-000000000005', null, 'staff_support', 'Staff Support');

insert into locations (customer_id, name, venue_type, m2) values
  ('11111111-1111-1111-1111-111111111111', 'A Main', 'cafe', 80),
  ('22222222-2222-2222-2222-222222222222', 'B Main', 'cafe', 90);

-- One inactive plan alongside the three seeded active ones, so that "the
-- pricing page sees active plans" and "staff see everything" are actually
-- different assertions instead of both being true by coincidence.
insert into plans (id, name, monthly_ore, max_m2, tagline, features, sort, active) values
  ('legacy', 'Legacy Plan', 9900, 50, '{"da":"Udgået","en":"Discontinued"}', '[]'::jsonb, 99, false);

-- Café A is still paying for a plan staff have since deactivated — the
-- scenario 0009_customer_plan_visibility.sql's extra plans_public_read
-- clause exists for, and Task 14's account summary must price correctly
-- rather than silently falling back to a compiled price the database no
-- longer agrees with.
insert into subscriptions (customer_id, plan_id, billing, status) values
  ('11111111-1111-1111-1111-111111111111', 'legacy', 'monthly', 'active');

-- Owner A --------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from customers),
  1,
  'owner A sees exactly one customer — their own'
);

select is(
  (select count(*)::int from locations),
  1,
  'owner A sees only their own location'
);

select is(
  (select count(*)::int from customers where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'owner A cannot read customer B even by id'
);

-- A denied UPDATE is not an error under RLS; it simply matches no rows. So the
-- assertion is on the row count affected, which is the behaviour that matters.
with attempted as (
  update customers set name = 'Hijacked'
  where id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'owner A cannot update customer B');

with attempted as (
  delete from locations
  where customer_id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'owner A cannot delete customer B''s locations');

-- Positive controls: assertions 4 and 5 above are denial-only. Without these,
-- deleting customers_owner_update and locations_owner_write entirely would
-- still pass every assertion so far.
with attempted as (
  update customers set name = 'Café A Renamed'
  where id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is((select count(*)::int from attempted), 1, 'owner A can update their own customer row');

with attempted as (
  insert into locations (id, customer_id, name, venue_type, m2)
  values ('a1a1a1a1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A Annex', 'cafe', 40)
  returning 1
)
select is((select count(*)::int from attempted), 1, 'owner A can insert a location for their own customer');

with attempted as (
  update locations set m2 = 45
  where id = 'a1a1a1a1-0000-0000-0000-000000000001'
  returning 1
)
select is((select count(*)::int from attempted), 1, 'owner A can update their own location');

-- A with check violation is different from a using-only denial: the row is
-- already matched (it is owner A's own location), but the resulting row
-- would belong to customer B, so Postgres raises instead of matching zero
-- rows.
select throws_ok(
  $$ update locations set customer_id = '22222222-2222-2222-2222-222222222222'
     where id = 'a1a1a1a1-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'owner A cannot reassign their own location to customer B'
);

with attempted as (
  delete from locations
  where id = 'a1a1a1a1-0000-0000-0000-000000000001'
  returning 1
)
select is((select count(*)::int from attempted), 1, 'owner A can delete their own location');

-- customers.status is how staff record a suspension for non-payment. Row
-- level security has no column granularity, so this must be enforced by the
-- guard_customer_status trigger, which raises rather than silently
-- filtering — the row is otherwise fully owner A's to update.
select throws_ok(
  $$ update customers set status = 'active'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'owner A cannot change their own customer''s status'
);

-- 0009_customer_plan_visibility.sql: an inactive plan is visible to a
-- customer session only via their own subscription, not to every customer
-- generally.
select is(
  (select count(*)::int from plans),
  4,
  'owner A can read their own subscription''s plan even though it is inactive'
);

-- Owner B --------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from plans),
  3,
  'owner B cannot see the legacy plan — it is not on any of their subscriptions'
);

-- Service role -----------------------------------------------------------
-- The service role bypasses RLS but not triggers, and the session-less
-- server admin client has no JWT claims, so is_staff() is false under it.
-- The guard must carve out this role explicitly, or the trigger that
-- correctly blocks an owner would also block the service-role client a
-- later task uses to cancel a customer, and a future billing integration
-- that suspends for non-payment through the same client.
set local role service_role;

with attempted as (
  update customers set status = 'cancelled'
  where id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is((select count(*)::int from attempted), 1, 'the service role can change a customer''s status');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

-- Manager A --------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}';

-- On INSERT, Postgres consults only with check (there is no existing row for
-- using to filter). A manager who is correctly blocked from deleting a
-- location must also be blocked from creating one, because m2 and location
-- count both drive billing.
select throws_ok(
  $$ insert into locations (customer_id, name, venue_type, m2)
     values ('11111111-1111-1111-1111-111111111111', 'Manager Rogue', 'cafe', 10) $$,
  '42501',
  null,
  'a manager cannot insert a location'
);

-- Staff (staff_admin) ------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from customers), 2, 'staff see every customer');

select is(
  (select count(*)::int from plans),
  4,
  'staff can see the inactive plan too'
);

-- Staff (staff_support) ------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}';

-- is_staff() is true for staff_support, so profiles_staff_write's using
-- clause lets this update proceed to the with check stage. There, only
-- is_staff_admin() (or staff editing an owner/manager row) is accepted, so
-- a support account promoting itself to staff_admin is rejected with a with
-- check violation, not a silent no-op.
select throws_ok(
  $$ update profiles set role = 'staff_admin'
     where id = 'eeeeeeee-0000-0000-0000-000000000005' $$,
  '42501',
  null,
  'a staff_support account cannot promote itself to staff_admin'
);

-- plans_admin_write requires is_staff_admin(), which is false for
-- staff_support, so the row is never matched — this is a using-only denial
-- and affects zero rows rather than raising.
with attempted as (
  update plans set monthly_ore = 1
  where id = 'small'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'a staff_support account cannot change a plan''s price');

-- Anonymous ------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select is(
  (select count(*)::int from plans),
  3,
  'the pricing page can read only the active plans without a session'
);

select is((select count(*)::int from customers), 0, 'anonymous readers see no customers');

-- A schema guard so a later task cannot add a table and forget RLS.
select is(
  (select count(*)::int from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every table in public has row level security enabled'
);

select * from finish();
rollback;
