/* `do update set public = false`, not `do nothing`: if this bucket already
   exists and is public -- created by hand in a shared project, or by tooling
   out of order -- a `do nothing` would silently leave it public, and the
   entire "authorisation lives in the download route, not in storage rules"
   model depends on it being private. The migration must reconcile the state,
   not merely create it. */
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;
