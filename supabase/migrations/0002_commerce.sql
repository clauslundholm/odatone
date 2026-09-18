create type billing_term        as enum ('monthly', 'annual');
create type subscription_status as enum ('pending', 'trialing', 'active', 'past_due', 'cancelled');
create type invoice_status      as enum ('draft', 'open', 'paid', 'overdue', 'void');
create type invoice_source      as enum ('seed', 'stripe');

-- id matches PlanId in lib/pricing.ts ('small' | 'medium' | 'main') so the two
-- cannot drift apart. Money is integer øre; tagline and features are L10n
-- objects, the same Record<'da'|'en', string> shape the rest of the site uses.
create table plans (
  id          text primary key,
  name        text not null,
  monthly_ore integer not null check (monthly_ore >= 0),
  max_m2      integer,
  tagline     jsonb not null,
  features    jsonb not null default '[]'::jsonb,
  sort        integer not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table addons (
  id          text primary key,
  name        jsonb not null,
  monthly_ore integer not null check (monthly_ore >= 0),
  active      boolean not null default true
);

create table subscriptions (
  id                 uuid primary key default uuid_generate_v4(),
  customer_id        uuid not null references customers(id) on delete cascade,
  plan_id            text not null references plans(id),
  billing            billing_term not null default 'monthly',
  status             subscription_status not null default 'pending',
  started_at         timestamptz,
  current_period_end timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index subscriptions_customer_id_idx on subscriptions (customer_id);

create table subscription_addons (
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  addon_id        text not null references addons(id),
  primary key (subscription_id, addon_id)
);

-- source distinguishes seeded rows from real ones, so slice 4 can find every
-- placeholder it must replace and nobody ever reads a fake total as revenue.
create table invoices (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid not null references customers(id) on delete cascade,
  number       text not null unique,
  issued_at    timestamptz not null default now(),
  due_at       timestamptz,
  period_start date,
  period_end   date,
  subtotal_ore integer not null,
  vat_ore      integer not null,
  total_ore    integer not null,
  status       invoice_status not null default 'draft',
  source       invoice_source not null,
  created_at   timestamptz not null default now()
);

create index invoices_customer_id_idx on invoices (customer_id);

-- Prices become operational in Task 12, so who changed what stops being a
-- nicety. Rows are written by triggers and server actions, never by hand.
create table audit_log (
  id        bigserial primary key,
  actor_id  uuid references profiles(id) on delete set null,
  action    text not null,
  entity    text not null,
  entity_id text,
  before    jsonb,
  after     jsonb,
  at        timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity, entity_id);
