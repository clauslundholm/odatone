/* audit_log (0002_commerce.sql) has no INSERT policy by design — see
   0003_tenancy.sql's audit_read comment: it is readable by staff and
   writable by nobody through the API. A plain trigger function runs as
   whichever role fired it, so a non-definer version of this trigger would
   run as the signed-in staff_admin who just PATCHed a plan, hit that
   missing INSERT policy, and abort the very update it was meant to
   record with "new row violates row-level security policy". SECURITY
   DEFINER makes the insert run as the function's owner instead, the same
   pattern 0003_tenancy.sql already uses for is_staff()/is_staff_admin(),
   and search_path is pinned for the same privilege-escalation reason
   those functions pin it.

   Shared by both `plans_audit` and `addons_audit` below (Task 12's fix
   round added the latter after a review found a staff_admin could reprice
   the add-on with no audit trail at all, while the equivalent plan edit
   was recorded — writable, unaudited and staff-readable is the worst
   combination). `tg_argv[0]` is the entity name the trigger was created
   with ('addon' for addons_audit); `plans_audit` passes none, so it
   defaults to 'plan', unchanged from before. */
create or replace function log_plan_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_entity text := coalesce(tg_argv[0], 'plan');
begin
  /* A save that changes nothing (an operator opening the form and
     re-submitting it untouched) still writes a new `updated_at` in both
     updatePlan and updateAddon, so comparing the full old/new rows would
     never treat it as a no-op. Dropping `updated_at` before comparing
     catches the case that actually matters — no visible field changed —
     without needing to know which columns exist on which table: `addons`
     has no `updated_at` column at all, so the subtraction there is simply
     a no-op and the comparison still covers every column it has. */
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_op, v_entity, coalesce(new.id, old.id),
          to_jsonb(old), to_jsonb(new));
  return new;
end $$;

create or replace trigger plans_audit
  after insert or update or delete on plans
  for each row execute function log_plan_change();

create or replace trigger addons_audit
  after insert or update or delete on addons
  for each row execute function log_plan_change('addon');

/* Fix round 6: customers was the only business table 0003_tenancy.sql
   grants staff write access to that had no audit trigger at all -- a
   staff member correcting a billing address or changing a customer's
   status left no record of what it was before, while the equivalent plan
   edit was fully audited from day one.

   log_plan_change() itself is not reused unmodified for this table.
   That function stores to_jsonb(old)/to_jsonb(new) in full, which is the
   right call for a plan's price but the wrong one here: eraseCustomer
   (app/admin/customers/[id]/gdpr-actions.ts) anonymises a customer's
   personal-data columns and deliberately omits `before` from its own
   audit_log entry -- the comment there says plainly that the customer's
   real name, email, CVR, address and phone must not survive their own
   erasure "anywhere, including here". A generic trigger logging
   to_jsonb(old) on that same UPDATE would capture exactly that PII,
   permanently, the moment the erasure's own write fired it -- reopening
   with one hand the hole Task 15 closed with the other. This function
   keeps the same pattern (SECURITY DEFINER, search_path pinned, the
   updated_at-only no-op guard) but redacts every column
   lib/gdpr.ts's CUSTOMER_PII_COLUMNS lists, in both `before` and `after`,
   for every row it ever logs -- not only the erasure case. That still
   answers the question this task was asked to fix (that a billing detail
   changed, when, and by whom is now on the record, where today it is on
   no record at all), without this audit trail ever becoming a second
   place PII outlives its own erasure. */
create or replace function log_customer_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_col text;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;

  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  foreach v_col in array array['name', 'billing_email', 'billing_email_lower', 'cvr', 'address', 'postcode', 'city', 'phone']
  loop
    if v_old ? v_col then
      v_old := jsonb_set(v_old, array[v_col], '"[redacted]"'::jsonb);
    end if;
    if v_new ? v_col then
      v_new := jsonb_set(v_new, array[v_col], '"[redacted]"'::jsonb);
    end if;
  end loop;

  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_op, 'customer', coalesce(new.id, old.id)::text, v_old, v_new);
  return new;
end $$;

create or replace trigger customers_audit
  after insert or update or delete on customers
  for each row execute function log_customer_change();
