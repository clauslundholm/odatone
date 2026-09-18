/* SECURITY DEFINER is not optional. A policy on profiles that selects from
   profiles re-enters the policy and recurses; running the lookup as the
   definer breaks that cycle. search_path is pinned because a SECURITY DEFINER
   function with a mutable search_path is a privilege-escalation hole. */
create or replace function auth_customer_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
as $$ select customer_id from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('staff_admin', 'staff_support')
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
    and exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  )
  with check (id = auth_customer_id());

-- locations ------------------------------------------------------------
create policy locations_read on locations for select
  using (customer_id = auth_customer_id() or is_staff());

create policy locations_staff_write on locations for all
  using (is_staff()) with check (is_staff());

create policy locations_owner_write on locations for all
  using (
    customer_id = auth_customer_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  )
  with check (customer_id = auth_customer_id());

-- profiles -------------------------------------------------------------
create policy profiles_read_own on profiles for select
  using (id = auth.uid() or is_staff());

-- Only staff change roles. Without this a manager could promote themselves.
create policy profiles_staff_write on profiles for all
  using (is_staff()) with check (is_staff());

-- subscriptions, addons on them, invoices ------------------------------
create policy subscriptions_read on subscriptions for select
  using (customer_id = auth_customer_id() or is_staff());

create policy subscriptions_staff_write on subscriptions for all
  using (is_staff()) with check (is_staff());

create policy subscription_addons_read on subscription_addons for select
  using (exists (
    select 1 from subscriptions s
    where s.id = subscription_id and (s.customer_id = auth_customer_id() or is_staff())
  ));

create policy subscription_addons_staff_write on subscription_addons for all
  using (is_staff()) with check (is_staff());

create policy invoices_read on invoices for select
  using (customer_id = auth_customer_id() or is_staff());

create policy invoices_staff_write on invoices for all
  using (is_staff()) with check (is_staff());

-- plans and addons -----------------------------------------------------
/* Anonymous read of active rows is deliberate: the public pricing page is
   prerendered without a session and must still see prices. */
create policy plans_public_read on plans for select
  using (active or is_staff());

create policy plans_admin_write on plans for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'));

create policy addons_public_read on addons for select
  using (active or is_staff());

create policy addons_admin_write on addons for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'staff_admin'));

-- audit_log ------------------------------------------------------------
-- Readable by staff, writable by nobody through the API. Rows arrive via
-- server actions running as the service role, so the record cannot be edited
-- by the person it is recording.
create policy audit_read on audit_log for select using (is_staff());
