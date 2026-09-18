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

create trigger plans_audit
  after insert or update or delete on plans
  for each row execute function log_plan_change();

create trigger addons_audit
  after insert or update or delete on addons
  for each row execute function log_plan_change('addon');
