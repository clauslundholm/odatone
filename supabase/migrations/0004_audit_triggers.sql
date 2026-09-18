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
   those functions pin it. */
create or replace function log_plan_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_op, 'plan', coalesce(new.id, old.id),
          to_jsonb(old), to_jsonb(new));
  return new;
end $$;

create trigger plans_audit
  after insert or update or delete on plans
  for each row execute function log_plan_change();
