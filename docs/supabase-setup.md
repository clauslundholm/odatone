# Standing up Odatone's Supabase backend

Everything the app needs from Supabase: credentials, the 14 migrations, the
role model, and the private invoice bucket. Follow it top to bottom for a new
project; use it as a checklist against an existing one.

> **The step that blocks everyone** is §4.3: the first `staff_admin` cannot be
> created through the app. If `/admin` rejects your login after you have done
> everything else, that is why.

---

## 1. Credentials

Four variables. `.env.example` is the template; copy it to `.env.local`
(gitignored) and fill it in.

| Variable | Where it comes from | Sensitivity |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → API → Project URL. Locally, `supabase start` prints it. | Public — shipped in the browser bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, "anon public" | Public by design — RLS is what protects the data, not this key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, "service_role" | **Secret. Full read/write, bypasses every RLS policy.** |
| `NEXT_PUBLIC_SITE_URL` | Your own origin, no trailing slash | Public |

**On the service-role key.** It is used in exactly one place —
`lib/supabase/admin.ts`, called only by `submitSignup` in `app/actions.ts`,
because an anonymous visitor creating a customer has no session for RLS to
authorise against. It must never reach the browser, never be committed, and
should be shared over something other than email or chat. If it leaks, rotate
it in the dashboard; nothing in the app caches it.

**`NEXT_PUBLIC_SITE_URL` must equal `supabase/config.toml`'s
`[auth].site_url`.** It builds the invite email's redirect. If they disagree,
GoTrue rejects the `redirect_to` as outside its allow-list and silently
downgrades the link to the marketing root — the invite appears to work and
lands nobody anywhere useful. Locally both are `http://127.0.0.1:3000`
(127.0.0.1, not `localhost` — they are different origins to GoTrue).

---

## 2. The 14 migrations

```bash
supabase link --project-ref <ref>
supabase db push          # hosted
supabase db reset         # local: drops, re-runs all 14, then seed.sql
```

| # | File | What it adds |
|---|---|---|
| 01 | `0001_core.sql` | `customers`, `locations`, `profiles`; `customer_status` and `user_role` enums; the CHECK that staff have no `customer_id` and tenants must have one |
| 02 | `0002_commerce.sql` | `plans`, `addons`, `subscriptions`, `subscription_addons`, `invoices`, `audit_log`; `billing_term`, `subscription_status`, `invoice_status`, `invoice_source` |
| 03 | `0003_tenancy.sql` | **All RLS.** `auth_customer_id()`, `is_staff()`, `is_staff_admin()`, and a policy per table |
| 04 | `0004_audit_triggers.sql` | `log_plan_change()`, `log_customer_change()`; audit triggers on `plans`, `addons`, `customers` |
| 05 | `0005_customer_phone.sql` | `customers.phone` |
| 06 | `0006_customer_email_unique.sql` | Unique index on `billing_email` |
| 07 | `0007_apply_signup_order.sql` | `apply_signup_order()` — writes a whole signup in one transaction |
| 08 | `0008_customer_email_lower_column.sql` | Lower-cased email column + unique index, so the dedupe lookup never goes through `ilike` |
| 09 | `0009_customer_plan_visibility.sql` | Widens `plans_public_read` so a customer can still see a plan staff have deactivated |
| 10 | `0010_invoice_lines.sql` | `invoice_lines`, `invoice_counters`, new `invoices` columns, immutability triggers, RLS |
| 11 | `0011_invoice_source_odatone.sql` | Adds a value to `invoice_source` |
| 12 | `0012_issue_invoice.sql` | `issue_invoice()` — gapless numbering, SQLSTATEs `P0101`–`P0104`, one-invoice-per-period index |
| 13 | `0013_invoice_storage.sql` | The private `invoices` storage bucket (§5) |
| 14 | `0014_optional_location_detail.sql` | `venue_type`/`m2` nullable; replaces `apply_signup_order` |

**`supabase db reset` reverts live prices.** `supabase/seed.sql` is generated
from the compiled `PLANS` in `lib/pricing.ts` and always inserts the shipped
figures. If someone has edited a price in `/admin/products`, a reset silently
puts the old one back. Never run it against anything but a local database.

Verify after pushing:

```bash
supabase migration list        # every row should show both Local and Remote
npm run test:db                # 115 pgTAP assertions, mostly RLS
```

---

## 3. Auth

- **Site URL / redirect URLs** must include your origin, or invite and
  password-reset links break (§1).
- **Email templates** — six of them, including the signup email that must
  print a 6-digit code for the mobile app. See
  `docs/supabase-email-templates.md`. These are *not* in migrations; push them
  with `supabase config push` or paste them in the dashboard.
- Email/password is the only method in use. No OAuth providers are configured.

---

## 4. Roles

### 4.1 The model

`user_role` is an enum of four, in `profiles.role`:

| Role | `customer_id` | Can |
|---|---|---|
| `owner` | required | Their own customer: read everything, edit company details, see invoices |
| `manager` | required | Their own customer, read-mostly |
| `staff_admin` | **must be null** | Everything, including prices, products, invoices and minting staff |
| `staff_support` | **must be null** | Read across all customers; cannot change prices or create staff |

A CHECK constraint in `0001_core.sql` enforces the `customer_id` rule in both
directions — a staff row with a customer, or a tenant row without one, is
rejected by the database rather than by application code.

### 4.2 Who may create staff

`is_staff_admin()` gates it. A `staff_support` account cannot mint a staff
role; an earlier review found it could otherwise promote itself to
`staff_admin` and rewrite every customer's price.

Once one `staff_admin` exists, further staff are invited from `/admin/users`.

### 4.3 The first `staff_admin` — bootstrap

**There is no bootstrap path in the app, and nothing in `seed.sql` creates
one.** `profiles_staff_write` requires an existing `staff_admin` to mint a
staff role, so the first one has to be written with the service role, which
bypasses RLS. This is deliberate — a self-service route to `staff_admin`
would be a privilege-escalation hole — but it means a fresh project has no
way into `/admin` until you do this by hand.

1. Create the auth user: Dashboard → Authentication → Users → Add user (tick
   "Auto Confirm User"), or the admin API. Copy its UUID.
2. In the SQL editor (which runs as `postgres`, so RLS does not apply):

```sql
insert into profiles (id, customer_id, role, full_name)
values ('<uuid-from-step-1>', null, 'staff_admin', 'Your Name');
```

`customer_id` must be `null` or the CHECK constraint rejects it.

3. Log in at `/admin` with that email and password.

---

## 5. The private invoice bucket

`0013_invoice_storage.sql` creates it:

```sql
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;
```

`do update set public = false`, not `do nothing` — if the bucket already
exists and is public, created by hand or by tooling out of order, a
`do nothing` would leave it public and the whole model would be silently
broken. The migration reconciles the state rather than merely creating it.

**Authorisation lives in the download route, not in storage rules.**
`app/api/invoices/[id]/pdf/route.ts` checks who is asking, then mints a
signed URL valid for **60 seconds**. There are no storage RLS policies on
this bucket and there should not be: one place decides who may read an
invoice.

Consequences worth holding on to:

- **Never make this bucket public.** Invoices carry names, addresses, CVR
  numbers and amounts. Public means enumerable and permanently cacheable.
- If you create the bucket by hand before running migrations, migration 13
  will fix the flag — but check it, because nothing else will.

Verify:

```sql
select id, public from storage.buckets where id = 'invoices';   -- public must be false
```

---

## 6. Done-when checklist

- [ ] `supabase migration list` shows all 14 applied remotely
- [ ] `npm run test:db` passes (115 assertions)
- [ ] `select id, public from storage.buckets where id='invoices'` → `false`
- [ ] One `staff_admin` profile exists with `customer_id is null`
- [ ] `/admin` accepts that login; `/my-odatone` rejects it (and vice versa)
- [ ] An anonymous `GET /rest/v1/customers` returns `[]`, not rows
- [ ] A signup through `/kom-i-gang` creates a customer and sends an invite
- [ ] The six email templates are live and the signup one prints a 6-digit code

---

## 7. Known gaps

- **`lib/invoice-issuer.ts` still contains `PLACEHOLDER —` values** for
  Odatone's own CVR, address and bank details. Invoices issued before those
  are filled in are not legally valid in Denmark.
- Before the `invoices_customer_period_uq` index from migration 12 can apply
  to a database with existing data, check for duplicates:

  ```sql
  select customer_id, period_start, period_end, count(*)
  from invoices where status <> 'void'
  group by 1,2,3 having count(*) > 1;
  ```
