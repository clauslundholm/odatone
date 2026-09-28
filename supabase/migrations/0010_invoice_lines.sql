/* An invoice needs itemising: which plan, how many locations, which period.
   Until now `invoices` carried only three totals, which is not something you
   can put in front of a Danish customer's bookkeeper. */

create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  position    integer not null,
  description text not null,
  quantity    integer not null check (quantity > 0),
  unit_ore    integer not null check (unit_ore >= 0),
  /* Generated, not a check constraint: there is no second place to write it,
     so a line can never disagree with its own arithmetic. Same reasoning as
     customers.billing_email_lower in 0008. */
  amount_ore  integer generated always as (quantity * unit_ore) stored,
  unique (invoice_id, position)
);

create index if not exists invoice_lines_invoice_id_idx on invoice_lines (invoice_id);

/* Danish invoice numbering must be gapless. A Postgres sequence is the wrong
   tool: nextval() is non-transactional and skips on rollback. A plain counter
   row locked `for update` inside the issuing transaction is not. */
create table if not exists invoice_counters (
  year        integer primary key,
  next_number integer not null default 1
);

alter table invoices add column if not exists paid_at           timestamptz;
alter table invoices add column if not exists payment_method    text;
alter table invoices add column if not exists payment_reference text;
alter table invoices add column if not exists void_reason       text;
alter table invoices add column if not exists pdf_path          text;
alter table invoices add column if not exists issued_by         uuid references profiles(id);

/* invoice_status carries `draft` and `overdue`. Neither is written by this
   slice, and that is deliberate rather than forgotten: there are no draft
   invoices (a row exists only once it is numbered, which is what makes the
   numbering gapless by construction), and nothing here automates dunning --
   overdue is computed for display from `due_at < now()` on an open invoice.
   Slice 4 gives `overdue` a writer. */

/* "Required when voiding" enforced, not remembered. */
alter table invoices drop constraint if exists invoices_void_reason_ck;
alter table invoices add constraint invoices_void_reason_ck
  check (status <> 'void' or void_reason is not null);

/* ------------------------------------------------------------------
   Immutability. An issued invoice is a legal document; it does not change.
   Only its payment state does.

   NOT security definer, and it exempts no role -- the same correction
   0003_tenancy.sql's guard_customer_status carries. `current_user` inside a
   definer function reports the function's OWNER, so a definer trigger that
   tries to exempt a role silently exempts everyone.
   ------------------------------------------------------------------ */
create or replace function guard_invoice_immutable() returns trigger
language plpgsql as $$
begin
  /* An allowlist over the whole row, not a list of frozen columns. A
     denylist silently exempts every column added later -- the next slice
     adds payment columns, and each one would arrive unguarded with no test
     failing. Six keys may move; everything else on an issued invoice,
     including columns that do not exist yet, may not. */
  if exists (
    select 1
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('status', 'paid_at', 'payment_method',
                         'payment_reference', 'void_reason', 'pdf_path')
  ) then
    raise exception 'invoice % is issued and cannot be amended; void it and issue a new one', old.number
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

drop trigger if exists invoices_immutable on invoices;
create trigger invoices_immutable before update on invoices
  for each row execute function guard_invoice_immutable();

/* An issued invoice's lines are as fixed as its total. */
create or replace function guard_invoice_lines_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'invoice lines cannot be changed once issued'
    using errcode = 'restrict_violation';
end $$;

/* This also makes an invoice undeletable: `invoices` cascades to its lines,
   and the cascade fires this trigger. That is intended. lib/gdpr.ts already
   anonymises a customer rather than deleting them, for exactly the reason
   named there -- Danish bookkeeping law requires the records be kept -- and
   neither `customers` nor `invoices` has a DELETE policy. A legal document
   should be hard to destroy. */
drop trigger if exists invoice_lines_immutable on invoice_lines;
create trigger invoice_lines_immutable before update or delete on invoice_lines
  for each row execute function guard_invoice_lines_immutable();

/* ------------------------------------------------------------------
   RLS: mirrors invoices_read / invoices_staff_write exactly, keyed through
   invoice_id. A customer sees their own lines and nobody else's.
   ------------------------------------------------------------------ */
alter table invoice_lines enable row level security;

drop policy if exists invoice_lines_read on invoice_lines;
create policy invoice_lines_read on invoice_lines for select
  using (exists (
    select 1 from invoices i
    where i.id = invoice_lines.invoice_id
      and (i.customer_id = auth_customer_id() or is_staff())
  ));

drop policy if exists invoice_lines_staff_write on invoice_lines;
create policy invoice_lines_staff_write on invoice_lines for all
  using (is_staff()) with check (is_staff());

/* invoice_counters is machinery, not data anyone reads. Only the issuing
   function (service_role, SECURITY DEFINER) touches it. */
alter table invoice_counters enable row level security;
