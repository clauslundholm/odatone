/* The signup flow used to ask every visitor for their venue type, floor
   area and opening-hours band before it would let them pick a plan. It no
   longer does — "bliv kunde" asks how many locations you have and which
   plan you want, and nothing else about the room.

   So these two columns stop being required. Writing an invented value
   instead would be worse than leaving them empty: `m2` drives the "Fit"
   meter on /admin/customers/[id] and the AREAL column in the customer
   portal, and a fabricated 150 m² would appear there exactly as though a
   customer had stated it. A blank reads as "nobody has said", which is
   what is true.

   `hours_band` keeps its `default 'normal'` and stays not-null: it has a
   sensible neutral value, which the other two do not. That default only
   helps if nothing names the column explicitly — see the note on
   apply_signup_order below, which is where this went wrong.

   Rows written before this migration keep whatever they were given, so
   /admin will show a mix of stated areas and blanks for a while. That is
   also what is true.

   apply_signup_order (0007) DOES have to change, which I first thought it
   did not. It names venue_type, m2 and hours_band in its insert, so with
   those keys absent from the payload it inserted an explicit NULL into
   each -- and an explicit NULL overrides a column DEFAULT. `hours_band` is
   not-null with default 'normal', so every signup raised 23502 after the
   visitor had already been shown the Done screen. The replacement below is
   the function's own definition read back out of the database with only
   that insert changed, rather than retyped: getting one argument of a
   ten-argument signature wrong would create an OVERLOAD instead of a
   replacement, leaving the old function live alongside the new one. */

alter table locations alter column venue_type drop not null;
alter table locations alter column m2 drop not null;

/* The check only ever guarded against a nonsense area being stored. Null
   is not a nonsense area, it is the absence of one — but a CHECK that
   evaluates to NULL passes anyway, so strictly this recreation changes
   nothing at runtime. It is rewritten to say so explicitly, because the
   next reader of `check (m2 > 0)` on a nullable column will otherwise have
   to work out for themselves whether nulls were meant to get through. */
alter table locations drop constraint if exists locations_m2_check;
alter table locations add constraint locations_m2_check check (m2 is null or m2 > 0);

CREATE OR REPLACE FUNCTION public.apply_signup_order(p_customer_id uuid, p_name text, p_cvr text, p_address text, p_postcode text, p_city text, p_phone text, p_plan_id text, p_billing billing_term, p_locations jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  if exists (select 1 from profiles where customer_id = p_customer_id) then
    raise exception 'apply_signup_order: customer % already has an owner', p_customer_id
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
  /* Name only. Signup stopped asking for a venue type, a floor area and an
     opening-hours band, so buildSignup no longer puts those keys in the
     payload. Listing the columns anyway inserted an explicit NULL into each
     -- and an explicit NULL overrides a column DEFAULT, so `hours_band`
     (not-null, default 'normal') raised 23502 and the whole signup failed
     after the Done screen had already been shown. Found by running a real
     signup, not by reading this. */
  insert into locations (customer_id, name)
  select p_customer_id, loc ->> 'name'
  from jsonb_array_elements(p_locations) as loc;

  delete from subscriptions where customer_id = p_customer_id;
  insert into subscriptions (customer_id, plan_id, billing, status)
  values (p_customer_id, p_plan_id, p_billing, 'pending');
end;
$function$;
