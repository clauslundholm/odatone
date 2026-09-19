-- Task 13's fix round 4 found a Critical in the case-insensitive customer
-- lookup 0006/round 3 built: PostgREST rewrites a literal `*` in a
-- `like`/`ilike` filter's pattern to `%` BEFORE Postgres ever sees it, and
-- that rewrite cannot be escaped through the `ilike` operator at all —
-- `escapeLikePattern` (lib/signup.ts) correctly escaped `\`, `%` and `_`,
-- but had no way to reach PostgREST's own, fifth metacharacter, which
-- lives entirely outside Postgres. EMAIL_RE (lib/forms.ts) permitted `*`,
-- so an anonymous signup for an address like "*@*.test" reached the
-- database as the pattern "%@%.test" — matching every `customers` row —
-- and app/actions.ts's `reuse` path then rewrote whichever one it landed
-- on: name, CVR, phone, address, every location and the subscription, all
-- replaced with the attacker's own, with the real business permanently
-- refused as "already registered" from then on and no way for staff to
-- tell from the schema alone what had happened.
--
-- The fix is to never go through `like`/`ilike` for this lookup at all.
-- `billing_email_lower` is GENERATED ALWAYS ... STORED — Postgres computes
-- and maintains it itself from `billing_email` on every insert and update,
-- so the application only ever needs a plain `.eq()` against it, which
-- PostgREST sends to Postgres as an ordinary `=` with no wildcard
-- semantics of any kind, from either side. It also restores index usage a
-- functional index on `lower(billing_email)` could never give a query that
-- filters the raw `billing_email` column: every signup's lookup was a
-- sequential scan against `customers_billing_email_unique_idx` until now.
-- `if not exists`/`if exists` throughout, matching 0006's own deliberate
-- idempotence (fix round 5's Minor — this file didn't have it, unlike the
-- migration right before it): re-running this file against a database it
-- has already applied to must be a no-op, not an error.
alter table customers
  add column if not exists billing_email_lower text generated always as (lower(billing_email)) stored;

-- Superseded by the index below — kept working right up to this line by
-- 0006_customer_email_unique.sql, but a functional index on an expression
-- (`lower(billing_email)`) is exactly the shape of index a plain `.eq()`
-- on the generated column no longer needs, and keeping both around would
-- mean maintaining two indexes to enforce the same one constraint.
drop index if exists customers_billing_email_unique_idx;

create unique index if not exists customers_billing_email_lower_unique_idx on customers (billing_email_lower);
