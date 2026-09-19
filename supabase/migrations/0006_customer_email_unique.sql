-- Task 13's fix round found the race a unique constraint exists to close:
-- four concurrent signups for the same billing email produced three
-- `customers` rows (measured live). Without this, decideSignupDedupe
-- (app/actions.ts) is a best-effort read that a concurrent request can
-- always outrun between the check and the insert — this turns it into an
-- actual guarantee, and gives submitSignup a `23505` to catch and recover
-- from gracefully instead.
--
-- One row per business, one billing email per row: a chain with several
-- venues is already modelled as one customer with many `locations`, so
-- "one row per email" is the correct cardinality here, not an
-- oversimplification. Case-insensitive because buildSignup (lib/signup.ts)
-- already lower-cases every email it accepts, and a unique index that
-- didn't match on case would leave the exact gap this migration exists to
-- close for "Jens@Nord.test" vs "jens@nord.test".

-- Fix round 3: this migration originally jumped straight to `create unique
-- index`, with no regard for whatever the race it closes had already
-- produced. On any database that already holds more than one `customers`
-- row for the same (case-folded) billing email — precisely the state the
-- pre-fix race could leave behind — that statement fails outright, and the
-- migration can never apply. The block below merges any such duplicates
-- onto one surviving row per email first, so this migration is safe to run
-- whether or not the race ever actually fired here. `if not exists` also
-- makes the index creation itself idempotent, consistent with re-running
-- this file being a no-op once it has already applied.
do $$
declare
  dup record;
  keeper uuid;
  loser uuid;
begin
  for dup in
    select lower(billing_email) as email
    from customers
    group by lower(billing_email)
    having count(*) > 1
  loop
    -- The survivor is whichever duplicate already has an owner (a real,
    -- working account is worth more than an abandoned attempt); failing
    -- that, the oldest row, since the first attempt is the one most likely
    -- to already carry a complete order.
    select c.id into keeper
    from customers c
    left join profiles p on p.customer_id = c.id
    where lower(c.billing_email) = dup.email
    order by (p.id is not null) desc, c.created_at asc
    limit 1;

    for loser in
      select id from customers
      where lower(billing_email) = dup.email and id <> keeper
    loop
      -- Re-point the loser's own rows at the keeper rather than dropping
      -- them: a loser might hold locations, a subscription or invoices of
      -- its own, none of which should simply vanish in a migration nobody
      -- watches run.
      update locations set customer_id = keeper where customer_id = loser;
      update subscriptions set customer_id = keeper where customer_id = loser;
      update invoices set customer_id = keeper where customer_id = loser;
      -- profiles.customer_id has no unique constraint, so the keeper can
      -- end up with more than one profile pointing at it if two different
      -- people were each invited under a duplicate row before this
      -- migration ever ran. That is a real "two owners" situation for
      -- staff to sort out by hand — not something a migration should
      -- silently guess at — and is strictly better than a profile (and the
      -- person behind it) simply disappearing.
      update profiles set customer_id = keeper where customer_id = loser;
      delete from customers where id = loser;
    end loop;
  end loop;
end $$;

create unique index if not exists customers_billing_email_unique_idx on customers (lower(billing_email));
