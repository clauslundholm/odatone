begin;
select plan(5);

select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'locations', 'locations table exists');
select has_table('public', 'profiles', 'profiles table exists');

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

select * from finish();
rollback;
