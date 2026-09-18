create extension if not exists "uuid-ossp";

create type customer_status as enum ('pending', 'active', 'suspended', 'cancelled');
create type user_role as enum ('owner', 'manager', 'staff_admin', 'staff_support');

create table customers (
  id            uuid primary key default uuid_generate_v4(),
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
create table locations (
  id          uuid primary key default uuid_generate_v4(),
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

create index locations_customer_id_idx on locations (customer_id);

-- One row per auth user. Staff have no customer; customer users must have one.
create table profiles (
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

create index profiles_customer_id_idx on profiles (customer_id);
