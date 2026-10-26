/* ==================================================================== *
 *  The weekly schedule belongs to a LOCATION, not to a customer
 *
 *  0015 hung schedule_blocks off customer_id, which was right while the
 *  design had one week per account. It no longer is: the Ugeplan screen
 *  has a location picker and a "Kopiér til lokationer" action, and
 *  pricing has always been per location (lib/pricing.ts) — a chain with
 *  a café and a bar cannot want the same music in both at 22:00.
 *
 *  Four things change:
 *
 *   - schedule_blocks gains location_id, NOT NULL;
 *   - the no-overlap exclusion moves from the customer to the location,
 *     because "two playlists at once" is a fact about a room;
 *   - hours become minutes, because the grid now snaps to the quarter;
 *   - locations gain `fallback`: what plays outside the planned hours.
 * ==================================================================== */

/* ------------------------------------------------------------- backfill
   Existing rows predate the column and have to land somewhere. The
   customer's oldest location is the only defensible guess, and it is
   also the one the single-location accounts this shipped to actually
   have. A customer with no location at all cannot keep its blocks —
   there is no room for them to play in — so those rows go, loudly. */
alter table schedule_blocks add column if not exists location_id uuid;

update schedule_blocks b
   set location_id = (
     select l.id from locations l
      where l.customer_id = b.customer_id
      order by l.created_at, l.id
      limit 1
   )
 where b.location_id is null;

delete from schedule_blocks where location_id is null;

alter table schedule_blocks alter column location_id set not null;

/* A block must point at a location belonging to the SAME customer, for
   the reason 0015 gives about playlists: two independent foreign keys
   are each satisfied by a row that mixes one customer's block with
   another's location. */
alter table locations drop constraint if exists locations_id_customer_uq;
alter table locations add constraint locations_id_customer_uq unique (id, customer_id);

alter table schedule_blocks drop constraint if exists schedule_blocks_same_location;
alter table schedule_blocks add constraint schedule_blocks_same_location
  foreign key (location_id, customer_id) references locations (id, customer_id) on delete cascade;

/* ------------------------------------------------- hours become minutes
   0015 stored whole hours and said why: "the design's grid is hourly".
   It is still drawn by the hour, but it no longer SNAPS by the hour —
   the week people actually want starts the morning list at 07:30 and
   runs the Friday one from 17:00. Minutes since midnight rather than a
   time: a schedule has no date, and a timestamptz would invite a
   daylight-saving question that "17:00 every Friday" does not have.

   Quarter-hours only, enforced here rather than trusted to the form.
   A 23-minute block is not a thing anyone means to make, and the grid
   cannot draw one distinguishably. */
alter table schedule_blocks drop constraint if exists schedule_blocks_no_overlap;
alter table schedule_blocks drop constraint if exists schedule_blocks_hour_order;

alter table schedule_blocks add column if not exists from_min integer;
alter table schedule_blocks add column if not exists to_min integer;
update schedule_blocks set from_min = from_hour * 60, to_min = to_hour * 60
 where from_min is null;
alter table schedule_blocks alter column from_min set not null;
alter table schedule_blocks alter column to_min set not null;
alter table schedule_blocks drop column if exists from_hour;
alter table schedule_blocks drop column if exists to_hour;

alter table schedule_blocks add constraint schedule_blocks_min_range
  check (from_min >= 0 and to_min <= 1440 and from_min < to_min);
alter table schedule_blocks add constraint schedule_blocks_min_quarter
  check (from_min % 15 = 0 and to_min % 15 = 0);

/* Was (customer_id, weekday, hours). A customer with two locations could
   not give them different music at the same hour — the constraint read
   the second location's block as a clash with the first's. Keyed to the
   location it says what it means. */
alter table schedule_blocks add constraint schedule_blocks_no_overlap
  exclude using gist (
    location_id with =,
    weekday with =,
    int4range(from_min, to_min) with &&
  );

drop index if exists schedule_blocks_customer_id_idx;
create index if not exists schedule_blocks_location_idx on schedule_blocks (location_id, weekday);

/* ---------------------------------------------------------- the gaps
   What plays between the blocks. Three answers, and the default is the
   honest one: a room with nothing scheduled at 03:00 should be quiet,
   not quietly billed for music nobody is there to hear.

   `continue` means the last block of the day keeps playing; on a day
   with no blocks at all it is the same as silence, which is why the
   player has to handle that rather than this column promising it. */
alter table locations drop constraint if exists locations_fallback_ck;
alter table locations add column if not exists fallback text not null default 'silence';
alter table locations add constraint locations_fallback_ck
  check (fallback in ('silence', 'calm', 'continue'));
