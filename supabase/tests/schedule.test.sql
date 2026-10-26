/* Customer playlists and the weekly schedule (0015).
 *
 * Three things are worth a test here rather than a code review: that one
 * customer cannot see or touch another's schedule, that the database
 * itself refuses two playlists playing at once, and that a block cannot
 * borrow a playlist belonging to someone else.
 */
begin;
select plan(18);

insert into customers (id, name, billing_email) values
  ('11111111-1111-1111-1111-111111111111', 'Café A', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'Café B', 'b@example.test');

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'owner-b@example.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'support@odatone.test');

insert into profiles (id, customer_id, role, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner', 'Owner A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'owner', 'Owner B'),
  ('cccccccc-0000-0000-0000-000000000003', null, 'staff_support', 'Support');

insert into playlists (id, customer_id, name, based_on, genres, bpm_low, bpm_high) values
  ('aa000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Morgenåbning – vores', 'Morgenåbning', '{ambient,acoustic}', 55, 90),
  ('bb000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'B-listen', null, '{jazz}', 70, 110);

insert into schedule_blocks (customer_id, playlist_id, weekday, from_hour, to_hour) values
  ('11111111-1111-1111-1111-111111111111', 'aa000000-0000-0000-0000-00000000000a', 0, 7, 11);

-- ---------------------------------------------------------------- shape
select has_table('playlists');
select has_table('schedule_blocks');
select col_is_pk('playlists', 'id', 'a playlist has a primary key');

/* A list is rules, not stored track ids — so there is deliberately no
   tracks column to drift out of date as the catalogue grows. */
select hasnt_column('playlists', 'track_ids', 'a playlist stores rules, not a frozen set of tracks');

-- ------------------------------------------------- the overlap constraint
/* 07–11 already exists on Monday. A neighbouring block is fine... */
select lives_ok(
  $$ insert into schedule_blocks (customer_id, playlist_id, weekday, from_hour, to_hour)
     values ('11111111-1111-1111-1111-111111111111', 'aa000000-0000-0000-0000-00000000000a', 0, 11, 14) $$,
  '11–14 may follow 07–11: the ranges touch but do not overlap'
);
/* ...and an overlapping one is not. Written as a range exclusion rather
   than a hand-rolled comparison precisely because the touching case above
   is the one a hand-rolled check usually gets wrong. */
select throws_ok(
  $$ insert into schedule_blocks (customer_id, playlist_id, weekday, from_hour, to_hour)
     values ('11111111-1111-1111-1111-111111111111', 'aa000000-0000-0000-0000-00000000000a', 0, 10, 12) $$,
  '23P01', null,
  'two playlists cannot play at the same hour on the same day'
);
select lives_ok(
  $$ insert into schedule_blocks (customer_id, playlist_id, weekday, from_hour, to_hour)
     values ('11111111-1111-1111-1111-111111111111', 'aa000000-0000-0000-0000-00000000000a', 1, 10, 12) $$,
  'the same hours on a different weekday are fine'
);
select throws_ok(
  $$ insert into schedule_blocks (customer_id, playlist_id, weekday, from_hour, to_hour)
     values ('11111111-1111-1111-1111-111111111111', 'aa000000-0000-0000-0000-00000000000a', 0, 9, 9) $$,
  '23514', null,
  'a block that ends when it starts is refused'
);

-- -------------------------------------------- a block cannot borrow a list
/* Two independent foreign keys would each be satisfied here: the block
   belongs to Café A, the playlist to Café B, and nothing but the
   composite key notices. */
select throws_ok(
  $$ insert into schedule_blocks (customer_id, playlist_id, weekday, from_hour, to_hour)
     values ('11111111-1111-1111-1111-111111111111', 'bb000000-0000-0000-0000-00000000000b', 3, 8, 9) $$,
  '23503', null,
  'a block cannot schedule another customer''s playlist'
);

-- ------------------------------------------------------------------- RLS
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from playlists), 1, 'an owner sees only its own playlists');
select is((select count(*)::int from schedule_blocks), 3, 'an owner sees only its own schedule');

select lives_ok(
  $$ update playlists set name = 'Vores morgen' where customer_id = '11111111-1111-1111-1111-111111111111' $$,
  'an owner may rename its own playlist'
);

/* The row is not visible to this caller, so the UPDATE matches nothing
   rather than raising — the same silent shape every using-clause denial
   has, and the reason the app checks affected rows. */
with attempted as (
  update playlists set name = 'kapret' where id = 'bb000000-0000-0000-0000-00000000000b' returning 1
)
select is((select count(*)::int from attempted), 0, 'an owner cannot rename another customer''s playlist');

with attempted as (
  delete from schedule_blocks where customer_id = '22222222-2222-2222-2222-222222222222' returning 1
)
select is((select count(*)::int from attempted), 0, 'an owner cannot delete another customer''s schedule');

set local "request.jwt.claims" to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from playlists), 1, 'the other owner sees only theirs');

set local "request.jwt.claims" to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from playlists), 2, 'staff see every customer''s playlists');

set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
select is((select count(*)::int from playlists), 0, 'an anonymous visitor sees no playlists');
select is((select count(*)::int from schedule_blocks), 0, 'an anonymous visitor sees no schedule');

select * from finish();
rollback;
