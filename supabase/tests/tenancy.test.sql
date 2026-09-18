begin;
select plan(8);

-- Two customers, one user each, plus one member of staff.
insert into customers (id, name, billing_email) values
  ('11111111-1111-1111-1111-111111111111', 'Café A', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'Café B', 'b@example.test');

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'owner-b@example.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'staff@odatone.test');

insert into profiles (id, customer_id, role, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'Owner A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', 'Owner B'),
  ('cccccccc-0000-0000-0000-000000000003', null, 'staff_admin', 'Staff');

insert into locations (customer_id, name, venue_type, m2) values
  ('11111111-1111-1111-1111-111111111111', 'A Main', 'cafe', 80),
  ('22222222-2222-2222-2222-222222222222', 'B Main', 'cafe', 90);

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

-- Staff ----------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from customers), 2, 'staff see every customer');

-- Anonymous ------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select is(
  (select count(*)::int from plans where active),
  3,
  'the pricing page can read active plans without a session'
);

select is((select count(*)::int from customers), 0, 'anonymous readers see no customers');

select * from finish();
rollback;
