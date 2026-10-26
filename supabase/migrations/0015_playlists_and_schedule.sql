/* ==================================================================== *
 *  Customer playlists and the weekly schedule
 *
 *  Two things the v4 design asks for and nothing behind them yet:
 *
 *   - a customer's own copy of a curated list, with its own name and its
 *     own rules (Rediger liste);
 *   - which list plays at which hours, per weekday (Spilleplan).
 *
 *  "Planlagte stemninger døgnet rundt" is already in Medium Stage's
 *  feature list (lib/pricing.ts) and on the public home page. This is the
 *  first thing behind that promise.
 * ==================================================================== */

create extension if not exists btree_gist;

/* A playlist is RULES, not a frozen set of track ids — the same decision
   the curated lists and the seasons make (lib/seasons.ts). A bigger
   catalogue then fills an existing list out instead of leaving it frozen
   at whatever 24 tracks happened to match on the day it was saved.

   `based_on` records which curated list it was copied from, as free text
   rather than a foreign key: the curated lists live in application code
   (lib/tracks.ts), not in a table, and a FK to nothing is worse than a
   label. It is kept so the UI can say "Baseret på Morgenåbning" and so a
   later migration can reconcile them if the curated lists ever move into
   the database. */
create table if not exists playlists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  based_on    text,
  genres      text[] not null default '{}',
  bpm_low     integer not null default 55  check (bpm_low  between 0 and 300),
  bpm_high    integer not null default 130 check (bpm_high between 0 and 300),
  /* null = don't care, true = only vocals, false = only instrumental —
     the same three-state the player's own filters use. */
  vox         boolean,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint playlists_bpm_order check (bpm_low < bpm_high)
);

create index if not exists playlists_customer_id_idx on playlists (customer_id);

/* One block = this list, this weekday, these hours.
 *
 * Hours are whole numbers 0–24 rather than times: the design's grid is
 * hourly, and storing a timestamp would invite a precision nobody can set
 * and nobody wants to reason about across daylight saving.
 *
 * `to_hour` may be 24, meaning midnight at the end of the day. A block
 * that should run past midnight is two blocks, which is also how it has
 * to be drawn on a weekly grid.
 */
create table if not exists schedule_blocks (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  playlist_id uuid not null references playlists(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),  -- 0 = Monday
  from_hour   smallint not null check (from_hour between 0 and 23),
  to_hour     smallint not null check (to_hour   between 1 and 24),
  created_at  timestamptz not null default now(),
  constraint schedule_blocks_hour_order check (from_hour < to_hour)
);

create index if not exists schedule_blocks_customer_id_idx on schedule_blocks (customer_id, weekday);

/* Two playlists cannot play in the same room at the same moment, and that
   is a fact about the world rather than a rule the form should be trusted
   to remember. An overlapping pair would make "what is playing at 14:00
   on Wednesday" ambiguous, and whichever answer the player picked would
   be arbitrary.

   Enforced with an exclusion constraint over a half-open hour range, so
   09–12 and 12–15 are neighbours rather than a conflict — the obvious
   `from < other.to and to > other.from` check written by hand gets that
   boundary wrong about half the time. */
alter table schedule_blocks drop constraint if exists schedule_blocks_no_overlap;
alter table schedule_blocks add constraint schedule_blocks_no_overlap
  exclude using gist (
    customer_id with =,
    weekday with =,
    int4range(from_hour::int, to_hour::int) with &&
  );

/* A block must point at a playlist belonging to the SAME customer.
   Two separate foreign keys cannot express that on their own: each is
   satisfied by a row that mixes one customer's block with another's
   playlist, which would schedule someone else's list into your week.
   A composite unique key on playlists gives the pair something to
   reference. */
alter table playlists drop constraint if exists playlists_id_customer_uq;
alter table playlists add constraint playlists_id_customer_uq unique (id, customer_id);

alter table schedule_blocks drop constraint if exists schedule_blocks_same_customer;
alter table schedule_blocks add constraint schedule_blocks_same_customer
  foreign key (playlist_id, customer_id) references playlists (id, customer_id) on delete cascade;

-- RLS -------------------------------------------------------------------
alter table playlists enable row level security;
alter table schedule_blocks enable row level security;

/* Same shape as subscriptions_read / subscriptions_staff_write in
   0003_tenancy.sql: a customer sees its own, staff see everything.
   Written against auth_customer_id() and is_staff() rather than inline
   role checks so "who may see a customer's rows" keeps one definition. */
drop policy if exists playlists_read on playlists;
create policy playlists_read on playlists for select
  using (customer_id = auth_customer_id() or is_staff());

drop policy if exists playlists_owner_write on playlists;
create policy playlists_owner_write on playlists for all
  using (customer_id = auth_customer_id())
  with check (customer_id = auth_customer_id());

drop policy if exists playlists_staff_write on playlists;
create policy playlists_staff_write on playlists for all
  using (is_staff()) with check (is_staff());

drop policy if exists schedule_blocks_read on schedule_blocks;
create policy schedule_blocks_read on schedule_blocks for select
  using (customer_id = auth_customer_id() or is_staff());

drop policy if exists schedule_blocks_owner_write on schedule_blocks;
create policy schedule_blocks_owner_write on schedule_blocks for all
  using (customer_id = auth_customer_id())
  with check (customer_id = auth_customer_id());

drop policy if exists schedule_blocks_staff_write on schedule_blocks;
create policy schedule_blocks_staff_write on schedule_blocks for all
  using (is_staff()) with check (is_staff());

/* `updated_at` has to move on its own: the portal writes these rows
   through PostgREST, and a client that forgets the column — or omits it
   deliberately — would leave a stale timestamp behind. */
create or replace function touch_updated_at() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace trigger playlists_touch
  before update on playlists
  for each row execute function touch_updated_at();
