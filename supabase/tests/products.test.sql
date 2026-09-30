/* Creating and deleting plans and add-ons from /admin/products.
 *
 * Before this, `plans` and `addons` were only ever UPDATEd: the three plans
 * and the one add-on arrived in a seed migration and nothing could add or
 * remove one. So `plans_admin_write` and `addons_admin_write` had never had
 * their INSERT or DELETE halves exercised, and neither had `plans_audit` /
 * `addons_audit` for those operations — the audit function reads
 * `coalesce(new.id, old.id)`, and on a DELETE `new` is null, which nothing
 * had ever run.
 *
 * Two behaviours in particular are asserted here because the application code
 * depends on telling them apart (app/admin/products/actions.ts):
 *
 *   - An INSERT refused by RLS RAISES 42501, because plans_admin_write has an
 *     explicit `with check`.
 *   - A DELETE refused by RLS affects ZERO ROWS and raises nothing, because
 *     that is a `using`-clause denial.
 *
 * If a future migration made either behave like the other, the action would
 * silently report the wrong outcome — a create that claims success, or a
 * delete whose refusal is reported as a generic database error.
 */
begin;
select plan(13);

insert into customers (id, name, billing_email) values
  ('11111111-1111-1111-1111-111111111111', 'Café A', 'a@example.test');

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'staff-admin@odatone.test'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'support@odatone.test');

insert into profiles (id, customer_id, role, full_name) values
  ('cccccccc-0000-0000-0000-000000000003', null, 'staff_admin', 'Staff Admin'),
  ('eeeeeeee-0000-0000-0000-000000000005', null, 'staff_support', 'Staff Support');

-- A customer on the seeded 'small' plan and on the seeded 'streaming'
-- add-on. These are the referenced rows the delete must refuse, and they are
-- the reason "delete only what nothing references" needs testing at all.
insert into subscriptions (id, customer_id, plan_id, billing, status) values
  ('c3c3c3c3-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'small', 'monthly', 'active');

insert into subscription_addons (subscription_id, addon_id) values
  ('c3c3c3c3-0000-0000-0000-000000000001', 'streaming');

-- staff_admin -----------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

with created as (
  insert into plans (id, name, monthly_ore, max_m2, tagline, features, sort, active)
  values ('arena', 'Arena Stage', 49900, null, '{"da":"Til arenaen.","en":"For the arena."}', '[]'::jsonb, 10, true)
  returning 1
)
select is((select count(*)::int from created), 1, 'a staff_admin account can create a plan');

-- The audit trigger fires on INSERT as well as UPDATE. `before` is null for a
-- create, which is what distinguishes it from an edit in the log.
select is(
  (select count(*)::int from audit_log
   where entity = 'plan' and entity_id = 'arena' and action = 'INSERT'
     and before is null and after ->> 'name' = 'Arena Stage'),
  1,
  'creating a plan writes an INSERT audit row naming the actor''s change'
);

-- The created plan is priced from the database like any other, and is
-- readable back by the account that made it (plans_public_read admits staff).
select is(
  (select monthly_ore from plans where id = 'arena'),
  49900,
  'a created plan is readable at the price it was created with'
);

-- Deleting a plan nothing references: allowed, and audited.
with removed as (
  delete from plans where id = 'arena' returning 1
)
select is((select count(*)::int from removed), 1, 'a staff_admin account can delete a plan nothing references');

/* The path nothing had ever run: log_plan_change reads
   `coalesce(new.id, old.id)`, and on a DELETE `new` is null. A create-then-
   delete with no audit row for the delete would mean a plan could be removed
   from the price list leaving no record that it ever existed. */
select is(
  (select count(*)::int from audit_log
   where entity = 'plan' and entity_id = 'arena' and action = 'DELETE'
     and after is null and before ->> 'name' = 'Arena Stage'),
  1,
  'deleting a plan writes a DELETE audit row carrying the row that was removed'
);

/* The foreign key, not the application's count, is what actually protects a
   customer's subscription. subscriptions.plan_id is `not null references
   plans(id)` with no `on delete` clause (0002_commerce.sql), so this raises
   rather than cascading or nulling — if it ever stopped raising, deleting a
   plan would either destroy live subscriptions or leave them pointing at
   nothing. */
select throws_ok(
  $$ delete from plans where id = 'small' $$,
  '23503',
  null,
  'deleting a plan a subscription references is refused by the foreign key'
);

-- Add-ons, same two shapes ---------------------------------------------
with created as (
  insert into addons (id, name, monthly_ore, active)
  values ('live-sets', '{"da":"Live-sæt","en":"Live sets"}', 9900, true)
  returning 1
)
select is((select count(*)::int from created), 1, 'a staff_admin account can create an add-on');

select is(
  (select count(*)::int from audit_log
   where entity = 'addon' and entity_id = 'live-sets' and action = 'INSERT'),
  1,
  'creating an add-on is audited as an addon, not as a plan'
);

with removed as (
  delete from addons where id = 'live-sets' returning 1
)
select is((select count(*)::int from removed), 1, 'a staff_admin account can delete an add-on nothing references');

select throws_ok(
  $$ delete from addons where id = 'streaming' $$,
  '23503',
  null,
  'deleting an add-on a subscription references is refused by the foreign key'
);

-- staff_support ---------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}';

/* RAISES, and this is the half of the pair app/admin/products/actions.ts
   reads an error code for. plans_admin_write carries `with check
   (is_staff_admin())` as well as `using`, and a with-check violation is an
   error, not a filtered-out row. */
select throws_ok(
  $$ insert into plans (id, name, monthly_ore, max_m2, tagline, features, sort, active)
     values ('sneak', 'Sneak', 100, null, '{"da":"x","en":"x"}', '[]'::jsonb, 50, true) $$,
  '42501',
  null,
  'a staff_support account cannot create a plan'
);

/* AFFECTS ZERO ROWS, and raises nothing — the other half of the pair. The
   `using` clause excludes the row from the DELETE's target set, which
   Postgres does not treat as an error, so the action can only detect this
   from an empty result. */
with attempted as (
  delete from plans where id = 'medium' returning 1
)
select is(
  (select count(*)::int from attempted),
  0,
  'a staff_support account cannot delete a plan, and the refusal affects zero rows rather than raising'
);

-- Anonymous -------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok(
  $$ insert into addons (id, name, monthly_ore, active)
     values ('anon-addon', '{"da":"x","en":"x"}', 100, true) $$,
  '42501',
  null,
  'an anonymous visitor cannot create an add-on'
);

select * from finish();
rollback;
