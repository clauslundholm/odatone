/* Ids use gen_random_uuid(), which Postgres 13+ provides in pg_catalog —
   no extension, and reachable from any search_path. The uuid-ossp
   extension that used to back uuid_generate_v4() here is installed into
   the `extensions` schema on hosted Supabase, which is NOT on the
   search_path `supabase db push` connects with, so the unqualified call
   resolved locally and failed on the first real deploy with
   "function uuid_generate_v4() does not exist". */

-- Fix round 6: `create type` has no `if not exists` form in Postgres, so
-- re-running this migration against a database it already applied to
-- used to fail outright with "type ... already exists" before it ever
-- reached the tables below. Wrapping each in a DO block and catching
-- duplicate_object is the standard idempotent-enum idiom -- nothing here
-- has been applied to a remote database yet (this whole task 8 exists to
-- close that window before it does), so this is safe to add now and never
-- needs revisiting once the first real deploy happens.
do $$ begin
  create type customer_status as enum ('pending', 'active', 'suspended', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_role as enum ('owner', 'manager', 'staff_admin', 'staff_support');
exception when duplicate_object then null;
end $$;

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  cvr           text,
  billing_email text not null,
  address       text,
  postcode      text,
  city          text,
  country       text not null default 'DK',
  status        customer_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- venue_type and hours_band mirror VenueTypeId and HoursBand in lib/rates.ts.
-- They are text rather than enums so adding a venue type stays a code change
-- and does not need a migration.
create table if not exists locations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  address     text,
  postcode    text,
  city        text,
  venue_type  text not null,
  m2          integer not null check (m2 > 0),
  hours_band  text not null default 'normal',
  created_at  timestamptz not null default now()
);

create index if not exists locations_customer_id_idx on locations (customer_id);

-- One row per auth user. Staff have no customer; customer users must have one.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  role        user_role not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  constraint profiles_tenancy_ck check (
    (role in ('staff_admin', 'staff_support') and customer_id is null)
    or
    (role in ('owner', 'manager') and customer_id is not null)
  )
);

create index if not exists profiles_customer_id_idx on profiles (customer_id);
