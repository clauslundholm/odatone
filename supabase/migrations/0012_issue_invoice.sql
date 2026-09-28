/* Issuing an invoice is several writes that must all happen or none: take the
   next number, insert the header, insert the lines, bump the counter. Done as
   separate PostgREST calls, two staff clicking at the same moment can consume
   one number twice or leave a numbered header with no lines. Postgres does the
   whole thing in one transaction instead -- the same reasoning, and the same
   shape, as apply_signup_order in 0007.

   SECURITY DEFINER because it writes invoice_counters, which no role can
   reach through RLS. Postgres grants EXECUTE to PUBLIC by default, which
   would let any signed-in customer issue themselves an invoice for anyone;
   the revokes below are not optional. */
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
    raise exception 'an invoice needs at least one line';
  end if;
  if p_period_end <= p_period_start then
    raise exception 'period end must be after period start';
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
    raise exception 'customer % has no subscription to invoice', p_customer_id;
  end if;
  if v_status not in ('active', 'trialing', 'past_due') then
    raise exception 'customer % has a % subscription, which is not billable', p_customer_id, v_status;
  end if;

  select count(*) into v_locs from locations where customer_id = p_customer_id;
  if v_locs = 0 then
    raise exception 'customer % has no locations to invoice', p_customer_id;
  end if;

  /* Staff clicking Issue twice is the common case, not an exotic one. */
  if exists (
    select 1 from invoices
     where customer_id = p_customer_id
       and period_start = p_period_start
       and period_end = p_period_end
       and status <> 'void'
  ) then
    raise exception 'customer % already has an invoice for % to %', p_customer_id, p_period_start, p_period_end;
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
