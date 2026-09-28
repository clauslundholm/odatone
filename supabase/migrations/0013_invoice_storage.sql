/* Private. No storage RLS policy is relied on: every download goes through
   app/api/invoices/[id]/pdf/route.ts, which authorises the reader against the
   invoices table first and only then mints a short-lived signed URL. Keeping
   authorisation in one place beats splitting it between Postgres policies and
   storage rules. */
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;
