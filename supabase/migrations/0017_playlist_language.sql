/* ==================================================================== *
 *  A saved list remembers which languages it wants sung
 *
 *  0015 gave a playlist its rules — genres, a BPM range, and `vox`, the
 *  three-state "any / only vocals / only instrumental". That left the
 *  builder able to ask for singing but not for a language, while the
 *  front page has promised vocals in more than one tongue since the
 *  first v4 draft and 1000TRAX takes `lang` as a request parameter on
 *  the pool itself (see lib/catalogue/trax.ts).
 *
 *  An ARRAY, and shaped exactly like `genres` beside it: a room asks for
 *  more than one — a hotel bar wants English and Spanish, a brasserie
 *  wants French and Danish — and empty means "any", which is what every
 *  list saved before this column existed was asking for. That makes the
 *  backfill the column default and nothing else.
 * ==================================================================== */

alter table playlists add column if not exists langs text[] not null default '{}';

/* Only the SHAPE is checked here, not the membership. Which languages
   exist is lib/tracks.ts's LANGS, kept in code for the same reason
   `locations.venue_type` is plain text rather than an enum (0001_core.sql
   says so in as many words): adding a language should be a code change,
   not a migration. A bare two-letter code is the whole contract.
   Written against the joined array rather than `unnest`, because a
   check constraint may not contain a subquery — Postgres refuses the
   obvious `not exists (select ... from unnest(langs))` outright. */
alter table playlists drop constraint if exists playlists_langs_shape;
alter table playlists add constraint playlists_langs_shape
  check (array_to_string(langs, ',') ~ '^([a-z]{2}(,[a-z]{2})*)?$');

/* A language only narrows a vocal. `vox = false` is "instrumental only",
   and an instrumental has no language to be in — the pair would describe
   an empty set. The UI drops the languages when you pick Instrumental
   rather than offering a choice that can only return nothing, and this
   says the same thing rather than trusting it to. */
alter table playlists drop constraint if exists playlists_langs_need_vocals;
alter table playlists add constraint playlists_langs_need_vocals
  check (cardinality(langs) = 0 or vox is not false);
