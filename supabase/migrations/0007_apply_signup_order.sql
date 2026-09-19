-- Task 13's fix round found `applyOrderToCustomer` (app/actions.ts) — the
-- write that binds a repeat signup's real order onto a pre-existing,
-- ownerless customer — running as a plain sequence of separate statements
-- from the application, not one transaction. Measured live with 4
-- concurrent signups against one such customer: 8 `locations` rows drawn
-- from three different visitors' orders, and 3 `subscriptions` rows for
-- one customer. The one request that reported success back to its own
-- visitor had NONE of its own locations — a later request's `delete` had
-- already removed them. Both admin screens price a customer as
-- `quote(plan, billing, locations.length)`, so this isn't just cosmetic:
-- it bills whatever count of locations happens to survive the race.
--
-- The fix is a single Postgres function doing the whole write in one
-- transaction, with the customer row locked for the duration so a second,
-- concurrent call for the SAME customer serializes behind the first
-- instead of interleaving its own deletes and inserts with it. Whichever
-- call runs second then fully overwrites the first's rows — one visitor's
-- complete order always wins cleanly, never a mix of two.
--
-- SECURITY DEFINER and no auth.uid() check of its own, exactly like
-- is_staff()/is_staff_admin() in 0003_tenancy.sql — but unlike those, this
-- function performs writes, not just a read used inside an RLS policy.
-- Postgres grants EXECUTE on a new function to PUBLIC by default, which
-- would let any authenticated customer call this over PostgREST's RPC
-- endpoint with an arbitrary customer id and rewrite a stranger's contact
-- details, locations and subscription — a far worse hole than the race
-- this function exists to close. The revokes below are not optional.
--
-- Fix round 4 added two things: the eligibility check below (status =
-- 'pending', no invoice) now runs a second time, inside this function,
-- after the lock — closing a TOCTOU window where lib/signup.ts's
-- decideSignupDedupe had already approved a customer as safe to reuse from
-- a read that could be stale by the time this function's lock actually
-- lands. And app/actions.ts's first-time `create` path (which used to
-- insert `locations`/`subscriptions` as two further, unlocked statements
-- of its own after the `customers` insert) now calls this same function
-- for that write too, so every path that can write a customer's order
-- takes the same lock — reproduced once in 57 four-way concurrent runs
-- otherwise: a customer left with one visitor's name and locations but
-- two different visitors' subscription rows, because the race could still
-- land in the gap between the first-time path's own two unlocked inserts.
create or replace function apply_signup_order(
  p_customer_id uuid,
  p_name        text,
  p_cvr         text,
  p_address     text,
  p_postcode    text,
  p_city        text,
  p_phone       text,
  p_plan_id     text,
  p_billing     billing_term,
  p_locations   jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  locked_id     uuid;
  locked_status customer_status;
begin
  select id, status into locked_id, locked_status
  from customers where id = p_customer_id for update;
  if locked_id is null then
    raise exception 'apply_signup_order: customer % not found', p_customer_id
      using errcode = 'P0002';
  end if;

  /* Fix round 4's TOCTOU close: decideSignupDedupe (lib/signup.ts) decides
     eligibility — status = 'pending', no invoice — in application code,
     from a read that can be stale by the time this function actually
     acquires the lock above. Without re-checking here, a customer that a
     payment provider activated or that staff started invoicing in that
     window would still be silently overwritten: the guarantee would be
     advisory, resting on a caller doing the right check, rather than real.
     Checked only now, AFTER the lock, so nothing else can change either
     answer out from under this transaction between here and the writes
     below. */
  if locked_status <> 'pending' then
    raise exception 'apply_signup_order: customer % is no longer pending (status=%)',
      p_customer_id, locked_status
      using errcode = 'P0001';
  end if;
  if exists (select 1 from invoices where customer_id = p_customer_id) then
    raise exception 'apply_signup_order: customer % already has an invoice', p_customer_id
      using errcode = 'P0001';
  end if;

  update customers set
    name     = p_name,
    cvr      = p_cvr,
    address  = p_address,
    postcode = p_postcode,
    city     = p_city,
    phone    = p_phone
  where id = p_customer_id;

  -- Replaced, not merged: a customer only ever reaches this function with
  -- no owner yet (decideSignupDedupe, lib/signup.ts, gates the caller), so
  -- whatever locations/subscription it already holds belong to an order
  -- nobody has ever confirmed.
  delete from locations where customer_id = p_customer_id;
  insert into locations (customer_id, name, venue_type, m2, hours_band)
  select
    p_customer_id,
    loc ->> 'name',
    loc ->> 'venue_type',
    (loc ->> 'm2')::integer,
    loc ->> 'hours_band'
  from jsonb_array_elements(p_locations) as loc;

  delete from subscriptions where customer_id = p_customer_id;
  insert into subscriptions (customer_id, plan_id, billing, status)
  values (p_customer_id, p_plan_id, p_billing, 'pending');
end;
$$;

revoke execute on function apply_signup_order(uuid, text, text, text, text, text, text, text, billing_term, jsonb)
  from public, anon, authenticated;
grant execute on function apply_signup_order(uuid, text, text, text, text, text, text, text, billing_term, jsonb)
  to service_role;
