/* The duplicate-period check inside issue_invoice runs under the year's
   counter lock, which cannot serialise two calls that straddle a year
   boundary -- they lock different rows. This index is the actual
   constraint; the check exists to turn it into a readable error rather
   than a raw unique violation. Partial, because voiding and re-issuing the
   same period is legitimate. */
create unique index if not exists invoices_customer_period_uq
  on invoices (customer_id, period_start, period_end)
  where status <> 'void';

/* Issuing an invoice is several writes that must all happen or none: take the
   next number, insert the header, insert the lines, bump the counter. Done as
   separate PostgREST calls, two staff clicking at the same moment can consume
   one number twice or leave a numbered header with no lines. Postgres does the
   whole thing in one transaction instead -- the same reasoning, and the same
   shape, as apply_signup_order in 0007.

   SECURITY DEFINER because it writes invoice_counters, which no role can
   reach through RLS. Postgres grants EXECUTE to PUBLIC by default, which
   would let any signed-in customer issue themselves an invoice for anyone;
   the revokes below are not optional.

   Every failure carries its own SQLSTATE so a caller (Task 6) can switch on
   the code instead of string-matching English prose:
     P0101 -- invalid input: no lines, bad period, bad due days
     P0102 -- no subscription, or one that is not active/trialing/past_due
     P0103 -- the customer has no locations
     P0104 -- already invoiced for this period */
create or replace function issue_invoice(
  p_customer_id  uuid,
  p_period_start date,
  p_period_end   date,
  p_due_days     integer,
  p_issued_by    uuid,
  p_lines        jsonb
) returns table (invoice_id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year     integer := extract(year from now())::integer;
  v_next     integer;
  v_number   text;
  v_subtotal integer;
  v_vat      integer;
  v_id       uuid;
  v_status   subscription_status;
  v_locs     integer;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'an invoice needs at least one line' using errcode = 'P0101';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'period end must be after period start' using errcode = 'P0101';
  end if;
  if p_due_days is null or p_due_days < 0 or p_due_days > 365 then
    raise exception 'due days must be between 0 and 365' using errcode = 'P0101';
  end if;

  /* Serialise every concurrent issue behind this one row. Taken FIRST, before
     any read below, so the checks cannot be made stale by a call that got the
     lock ahead of us. */
  insert into invoice_counters (year, next_number) values (v_year, 1)
    on conflict (year) do nothing;
  select next_number into v_next from invoice_counters where year = v_year for update;

  /* Re-checked under the lock, never trusted from the caller's earlier read
     -- the TOCTOU lesson from apply_signup_order's fix round 4. */
  select s.status into v_status
    from subscriptions s
   where s.customer_id = p_customer_id
   order by s.created_at desc
   limit 1;

  if v_status is null then
    raise exception 'customer % has no subscription to invoice', p_customer_id
      using errcode = 'P0102';
  end if;
  if v_status not in ('active', 'trialing', 'past_due') then
    raise exception 'customer % has a % subscription, which is not billable', p_customer_id, v_status
      using errcode = 'P0102';
  end if;

  select count(*) into v_locs from locations where customer_id = p_customer_id;
  if v_locs = 0 then
    raise exception 'customer % has no locations to invoice', p_customer_id
      using errcode = 'P0103';
  end if;

  /* Staff clicking Issue twice is the common case, not an exotic one. This
     read can still race a concurrent call for the same period across a
     year boundary (different counter rows, so no shared lock serialises
     them) -- invoices_customer_period_uq above is the real backstop; this
     check exists only to turn that into a readable error instead of a raw
     unique violation. */
  if exists (
    select 1 from invoices
     where customer_id = p_customer_id
       and period_start = p_period_start
       and period_end = p_period_end
       and status <> 'void'
  ) then
    raise exception 'customer % already has an invoice for % to %', p_customer_id, p_period_start, p_period_end
      using errcode = 'P0104';
  end if;

  select coalesce(sum((l->>'quantity')::integer * (l->>'unitOre')::integer), 0)
    into v_subtotal
    from jsonb_array_elements(p_lines) l;

  /* 25% VAT, rounded half-up to whole øre -- the same rule lib/money.ts's
     vatOre applies, restated here because this function must not depend on
     the application having computed it. */
  v_vat := round(v_subtotal * 0.25);
  v_number := v_year::text || '-' || lpad(v_next::text, 4, '0');

  insert into invoices (
    customer_id, number, issued_at, due_at, period_start, period_end,
    subtotal_ore, vat_ore, total_ore, status, source, issued_by
  ) values (
    p_customer_id, v_number, now(), now() + make_interval(days => p_due_days),
    p_period_start, p_period_end,
    v_subtotal, v_vat, v_subtotal + v_vat, 'open', 'odatone', p_issued_by
  ) returning id into v_id;

  insert into invoice_lines (invoice_id, position, description, quantity, unit_ore)
  select v_id,
         (l->>'position')::integer,
         l->>'description',
         (l->>'quantity')::integer,
         (l->>'unitOre')::integer
    from jsonb_array_elements(p_lines) l;

  update invoice_counters set next_number = next_number + 1 where year = v_year;

  invoice_id := v_id;
  invoice_number := v_number;
  return next;
end $$;

revoke all on function issue_invoice(uuid, date, date, integer, uuid, jsonb) from public;
revoke all on function issue_invoice(uuid, date, date, integer, uuid, jsonb) from anon;
revoke all on function issue_invoice(uuid, date, date, integer, uuid, jsonb) from authenticated;
grant execute on function issue_invoice(uuid, date, date, integer, uuid, jsonb) to service_role;
