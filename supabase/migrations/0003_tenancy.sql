/* SECURITY DEFINER is not optional. A policy on profiles that selects from
   profiles re-enters the policy and recurses; running the lookup as the
   definer breaks that cycle. search_path is pinned because a SECURITY DEFINER
   function with a mutable search_path is a privilege-escalation hole. Column
   references inside these bodies are qualified so a later column added to
   any joined table cannot silently change what an unqualified name resolves
   to. */
create or replace function auth_customer_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
as $$ select customer_id from profiles where profiles.id = auth.uid() $$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role in ('staff_admin', 'staff_support')
  )
$$;

/* Distinct from is_staff() on purpose. is_staff() answers "is this caller
   any kind of staff", which is the right test for reading and administering
   customer-side data. It is the wrong test for anything that controls who
   gets to become staff or what staff-tier data (prices) says, because it
   tests the actor and not the row: using is_staff() in both the using and
   with check of a self-referential write policy lets a staff_support
   account edit its own row into role = 'staff_admin'. Only staff_admin may
   grant or hold staff-tier privileges. */
create or replace function is_staff_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'staff_admin'
  )
$$;

alter table customers           enable row level security;
alter table locations           enable row level security;
alter table profiles            enable row level security;
alter table plans               enable row level security;
alter table addons              enable row level security;
alter table subscriptions       enable row level security;
alter table subscription_addons enable row level security;
alter table invoices            enable row level security;
alter table audit_log           enable row level security;

-- customers ------------------------------------------------------------
create policy customers_read on customers for select
  using (id = auth_customer_id() or is_staff());

create policy customers_staff_write on customers for all
  using (is_staff()) with check (is_staff());

-- An owner may correct their own company details; a manager may not.
create policy customers_owner_update on customers for update
  using (
    id = auth_customer_id()
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner')
  )
  with check (id = auth_customer_id());

/* customers.status is how staff record a suspension for non-payment.
   Row-level security has no column granularity, and customers_owner_update
   otherwise grants the whole row, so without this guard an owner suspended
   for non-payment could PATCH their own status back to 'active'. A trigger
   is used instead of a column-level revoke because staff are also
   `authenticated` and a revoke on that role would take the ability away
   from them too. */
create or replace function guard_customer_status() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status and not is_staff() then
    raise exception 'only staff may change a customer''s status'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger customers_status_guard
  before update on customers
  for each row execute function guard_customer_status();

-- locations ------------------------------------------------------------
create policy locations_read on locations for select
  using (customer_id = auth_customer_id() or is_staff());

create policy locations_staff_write on locations for all
  using (is_staff()) with check (is_staff());

/* The owner test must appear in both using and with check. Postgres only
   consults with check on INSERT (there is no existing row for using to
   filter), so when the owner test lived in using alone a manager who was
   correctly blocked from deleting a location could still insert one — and
   m2 and location count both drive billing. */
create policy locations_owner_write on locations for all
  using (
    customer_id = auth_customer_id()
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner')
  )
  with check (
    customer_id = auth_customer_id()
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner')
  );

-- profiles -------------------------------------------------------------
create policy profiles_read_own on profiles for select
  using (id = auth.uid() or is_staff());

/* is_staff() tests the actor, not the row being written. Using it in both
   using and with check let a staff_support account PATCH its own row to
   role = 'staff_admin', which then unlocks plans_admin_write — the ability
   to rewrite the price of every plan for every customer. Staff may still
   administer customer-side profiles (owner, manager); only a staff_admin
   may create or alter a staff row. */
create policy profiles_staff_write on profiles for all
  using (is_staff())
  with check (
    is_staff_admin()
    or (is_staff() and role in ('owner', 'manager'))
  );

-- subscriptions, addons on them, invoices ------------------------------
create policy subscriptions_read on subscriptions for select
  using (customer_id = auth_customer_id() or is_staff());

create policy subscriptions_staff_write on subscriptions for all
  using (is_staff()) with check (is_staff());

-- subscription_id is qualified with the policy's own table so that a later
-- column of the same name on subscriptions cannot silently change which
-- table an unqualified reference resolves to.
create policy subscription_addons_read on subscription_addons for select
  using (exists (
    select 1 from subscriptions s
    where s.id = subscription_addons.subscription_id
      and (s.customer_id = auth_customer_id() or is_staff())
  ));

create policy subscription_addons_staff_write on subscription_addons for all
  using (is_staff()) with check (is_staff());

create policy invoices_read on invoices for select
  using (customer_id = auth_customer_id() or is_staff());

create policy invoices_staff_write on invoices for all
  using (is_staff()) with check (is_staff());

-- plans and addons -----------------------------------------------------
/* Anonymous read of active rows is deliberate: the public pricing page is
   prerendered without a session and must still see prices. Writes are
   gated on is_staff_admin(), not an inline role check, so "who may change
   a price" has exactly one definition instead of three. */
create policy plans_public_read on plans for select
  using (active or is_staff());

create policy plans_admin_write on plans for all
  using (is_staff_admin())
  with check (is_staff_admin());

create policy addons_public_read on addons for select
  using (active or is_staff());

create policy addons_admin_write on addons for all
  using (is_staff_admin())
  with check (is_staff_admin());

-- audit_log ------------------------------------------------------------
-- Readable by staff, writable by nobody through the API. Rows arrive via
-- server actions running as the service role, so the record cannot be edited
-- by the person it is recording.
create policy audit_read on audit_log for select using (is_staff());
