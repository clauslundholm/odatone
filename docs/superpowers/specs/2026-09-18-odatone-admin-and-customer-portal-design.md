# Odatone Admin Backend and Customer Portal — Design

**Date:** 2026-09-18
**Status:** Approved in brainstorming, pending spec review
**Scope:** Slice 1 of five — the account foundation (Supabase auth, tenancy, customer records), both login screens, and the core of the `/admin` backend. The `/my-odatone` product, billing, settings and stats screens, Stripe billing and the stats pipeline are later slices with their own specs.

## Summary

Odatone sells subscriptions but has nowhere to keep a customer. `app/actions.ts` validates a signup and writes it to the console; there is no login, no customer record, no subscription and no invoice. Every screen requested for `/admin` and `/my-odatone` reads data that does not exist yet.

This slice builds that missing half: a Supabase Postgres database as the system of record, Supabase Auth for both audiences, row-level security for tenancy, and the `/admin` screens that make the data visible. Signup stops discarding customers and starts creating them. The three plans move out of `lib/pricing.ts` into the database so staff can edit prices without a deploy, while the pricing *arithmetic* stays in code and shared.

## Why this is five projects, not one

The original request listed thirteen surfaces. They do not form one deliverable:

| # | Slice | Contains | Depends on |
| --- | --- | --- | --- |
| 1 | **Account foundation + admin core** (this spec) | Supabase, schema, RLS, both login screens, signup persistence, admin dashboard / customers / products | — |
| 2 | Admin remainder | Admin users, user profile, settings, stats screens | 1 |
| 3 | `/my-odatone` | Product, billing view, settings, stats (its login ships in slice 1) | 1 |
| 4 | Billing | Stripe subscriptions, real invoices, dunning | 1, 3 |
| 5 | Stats | Playback telemetry from web and mobile, aggregation | 1 |

Slices 2–5 are named here only so the boundaries of slice 1 are unambiguous. Each gets its own spec.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| How real is this? | Real foundation, staged rollout | Genuine auth and customer records now; billing amounts and stats seeded until slices 4 and 5 land. The alternative leaves signup discarding customers. |
| Account shape | Customer → many locations, many logins | Matches per-location pricing and the volume tiers. Modelling multiple logins now costs almost nothing and avoids reworking sessions later. |
| What is a "product"? | Plans and add-ons | The sellable things. The music catalogue is a separate concern with its own lifecycle. |
| Stack | Supabase (Postgres + Auth) | One provider, EU region on any plan, no per-user auth pricing. Rejected: Neon + Clerk (Vercel-native and faster to a login, but adds a per-MAU vendor and charges for EU residency); own sessions (owning password hashing for accounts tied to real money). |
| Pricing source of truth | Database, public page revalidates | Prices become operational rather than a deploy. Follows the pattern `lib/copy-server.ts` already uses for copy overrides. |
| Shell | Dark frame, both portals | One shell and one component set; matches the player dock and the mobile app, and separates "the app" from "the website". |
| Admin language | English only | Internal tool. `/my-odatone` is bilingual, including the login that ships in this slice. |
| First slice | Foundation + admin core | Internal-only, so rough edges cost nothing, and it means someone can see the customers signup starts capturing. |

## Context and constraints

Facts from the repository that shape this design:

- **Nothing is persisted.** `app/actions.ts` validates `submitSignup` and `submitSalesLead`, logs them, and returns. Its own comment says to wire it to a CRM.
- **The only session mechanism is a shared password.** `lib/edit-session.ts` signs an expiry with HMAC-SHA256 for the live copy editor. It is one secret for all editors — a reasonable internal gate, not an identity system.
- **`/admin` and `/my-odatone` are free at the root.** `app/[locale]/layout.tsx:82` calls `notFound()` for anything that is not `da` or `en`, and static route segments take precedence over dynamic ones.
- **There is a precedent for database-backed content on prerendered pages.** `lib/copy-server.ts` wraps the store read in a cache tagged `copy-overrides`, revalidated on save, so the 25 marketing pages still prerender. Plans follow exactly the same shape, with the same `unstable_cache` + `revalidateTag` pair. Next 16's replacement (`use cache` with `cacheTag`) requires `cacheComponents: true` in `next.config.ts`, a project-wide rendering change affecting all 25 existing pages — out of scope here, and noted in Risks.
- **The pricing model is already written.** `lib/pricing.ts` holds three plans (149 / 199 / 249 kr.), `ANNUAL_DISCOUNT_PCT = 45`, `VAT_PCT = 25`, `VOLUME_TIERS` at 0/10/15/20 % and a `Quote` type. `lib/rates.ts` supplies `VenueTypeId` and `HoursBand`; `lib/profile.ts` carries the calculator's answers into signup.
- **The design system already exists.** `app/globals.css` defines the tokens the deployed site serves: `--c-accent: #7a3aff`, the ink/surface/line scales, radii 10/14/20/28, `--g-brand` and `--ease-out-expo`, exposed to Tailwind v4 as `--color-*`.
- **Upstash Redis is in use** for copy overrides only, via `KV_REST_API_*`. It stays exactly where it is.
- **The test runner is `node --test test/`.** No Jest, no test framework beyond Node's.

## 1. Architecture

### Stack

Supabase provides Postgres and Auth, provisioned through the Vercel Marketplace (`vercel integration add supabase`) so environment variables are injected and billing is unified. The region must be an EU one; the customers are Danish businesses.

Access goes through `@supabase/ssr` in three thin wrappers so no component constructs a client itself:

```
lib/supabase/server.ts       server components and server actions (user session)
lib/supabase/client.ts       browser components
lib/supabase/admin.ts        service role — signup only, never imported client-side
lib/supabase/proxy.ts        session refresh helper
```

### Routing

```
proxy.ts                         session refresh + gate both prefixes
app/admin/layout.tsx             shell: sidebar frame + panel
app/admin/page.tsx               dashboard
app/admin/login/page.tsx         staff login (excluded from the gate)
app/admin/customers/page.tsx     list
app/admin/customers/[id]/page.tsx  detail
app/admin/products/page.tsx      plans and add-ons
lib/plans-server.ts              cached plan reads + PLANS_TAG
supabase/migrations/*.sql        schema, policies, seed
supabase/tests/*.sql             RLS isolation tests
```

`/admin/login` sits inside the gated prefix and must be explicitly excluded, or it redirects to itself. The same applies to `/my-odatone/login`.

**Next 16 renamed `middleware.ts` to `proxy.ts`**, exporting `proxy` instead of `middleware`. The old convention is deprecated; a codemod exists (`npx @next/codemod@canary middleware-to-proxy .`). Supabase's own guide already uses the Proxy terminology.

### What moves and what stays

The plan *data* moves to Postgres. The pricing *arithmetic* — `quote()`, `volumeTier()`, `planForM2()`, `recommendPlan()` — stays in `lib/pricing.ts` and is shared by the marketing site, admin and later the portal. One implementation of the maths, three readers. `PLANS` becomes a seed for the database rather than the runtime source.

`ANNUAL_DISCOUNT_PCT` and `VOLUME_TIERS` stay in code for this slice. They are pricing *rules*, not products, and the request was to manage products. Moving them is a later decision, noted in Risks.

## 2. Data model

Money is stored as **integer øre**, never floats. Currency is DKK throughout. Localised text is `jsonb` holding `Record<'da'|'en', string>`, so the existing `L10n` type keeps working unchanged.

| Table | Columns (essentials) |
| --- | --- |
| `customers` | `id`, `name`, `cvr`, `billing_email`, address fields, `country` (default `DK`), `status` (`pending`/`active`/`suspended`/`cancelled`), timestamps |
| `locations` | `id`, `customer_id`, `name`, address fields, `venue_type` (`VenueTypeId`), `m2`, `hours_band` (`HoursBand`) |
| `profiles` | `id` → `auth.users(id)` on delete cascade, `customer_id` (null for staff), `role`, `full_name` |
| `plans` | `id` (`small`/`medium`/`main`), `name`, `monthly_ore`, `max_m2` (null = unbounded), `tagline` jsonb, `features` jsonb, `sort`, `active` |
| `addons` | `id` (`streaming`), `name` jsonb, `monthly_ore`, `active` |
| `subscriptions` | `id`, `customer_id`, `plan_id`, `billing` (`monthly`/`annual`), `status` (`pending`/`trialing`/`active`/`past_due`/`cancelled`), `started_at`, `current_period_end`, `cancelled_at` |
| `subscription_addons` | `subscription_id`, `addon_id` |
| `invoices` | `id`, `customer_id`, `number`, `issued_at`, `due_at`, period bounds, `subtotal_ore`, `vat_ore`, `total_ore`, `status`, **`source`** (`seed`/`stripe`) |
| `audit_log` | `id`, `actor_id`, `action`, `entity`, `entity_id`, `before` jsonb, `after` jsonb, `at` |

`roles` is an enum: `owner`, `manager` (customer-side) and `staff_admin`, `staff_support` (Odatone). A check constraint enforces the invariant that staff rows have a null `customer_id` and customer rows do not.

`invoices.source` exists so a seeded row can never be mistaken for a real one — and so slice 4 can find every placeholder it must replace.

## 3. Tenancy and access control

The rule, in one sentence: **a row belongs to a customer, and you may see it if you belong to that customer or you are Odatone staff.**

Two `SECURITY DEFINER` helpers carry it:

```sql
auth_customer_id() -> uuid   -- the caller's profiles.customer_id
is_staff()         -> bool   -- role in ('staff_admin','staff_support')
```

They must be `SECURITY DEFINER`. A policy on `profiles` that selects from `profiles` recurses and deadlocks — the standard Supabase failure, and the single most likely way this slice breaks.

Policies, by table:

- `customers`, `locations`, `subscriptions`, `subscription_addons`, `invoices` — read where `customer_id = auth_customer_id()` or `is_staff()`. Write: staff only, except that an `owner` may update their own customer row and its locations.
- `profiles` — a user reads their own row; staff read all; only staff change roles.
- `plans`, `addons` — **anonymous read of active rows**, because the public pricing page needs them. Write: `staff_admin` only.
- `audit_log` — staff read, nobody writes directly; rows are inserted by triggers.

Two deliberate exceptions:

1. **Signup runs with the service role.** An anonymous visitor creating a customer has no session to authorise against, so `submitSignup` runs server-side through `lib/supabase/admin.ts` behind strict validation. That module must never be imported by a client component; a build-time check enforces it.
2. **A customer who reaches `/admin` gets 404, not 403.** There is no reason to confirm the backend exists.

### Authentication

Email and password via Supabase Auth (`@supabase/ssr` 0.12.x). Staff are invited — `/admin` has no self-signup. Customers get an invite from the signup flow to set their own password, so no password is ever transmitted to Odatone. Sessions refresh in `proxy.ts`.

Two rules the library is emphatic about, both easy to get wrong:

- **Use `getClaims()`, never `getSession()`, in server code.** `getSession()` reads the cookie without verifying its signature; `getClaims()` verifies it on every call. It must be called early in the handler, before the response is committed, or a refresh completing afterwards is lost.
- **Responses that write auth cookies must not be cached.** `setAll` receives a second argument of required headers (`Cache-Control: private, no-cache, no-store...`). They must be applied to the response, or Vercel's CDN can serve one customer's session token to another. Cookie handlers must implement `getAll`/`setAll`; the older `get`/`set`/`remove` are deprecated and miss edge cases.

Supabase's built-in auth email is rate-limited and not intended for production volume. It is adequate for this slice; a transactional provider is a dependency of slice 3, not a surprise.

## 4. Screens in this slice

`/admin` is English only. `/my-odatone/login` is bilingual (da/en), like the rest of the customer-facing site.

- **`/admin/login`** — email and password, nothing else.
- **`/admin`** — KPI grid: customers, active subscriptions, MRR in kroner, pending signups. MRR is computed with `quote()` from real subscription rows.
- **`/admin/customers`** — table card: company, CVR, locations, plan, status, MRR. Rows link to detail. Filter by status.
- **`/admin/customers/[id]`** — the customer, its locations each with an m² meter against the plan's `max_m2`, its users and roles, its subscription, and its invoices (seeded, labelled as such).
- **`/admin/products`** — the three plans and the add-on: price, m² bound, features and tagline in both languages, active flag. Saving writes an audit row and revalidates the public pricing page.
- **`/my-odatone/login`** — customer login. Signing in lands on a minimal account summary: company, plan, subscription status and locations. The product, billing, settings and stats screens are slice 3. This summary exists because signup sends an invite, and an invite needs somewhere real to go; it also exercises customer-side RLS in production rather than only in tests.

## 5. Visual language

Structure comes from the reference artifact; colour comes from Odatone's existing tokens.

The shell is a dark **frame** (sidebar, 248px) wrapping a rounded light **panel**, with a breadcrumb bar above a scrolling canvas. Inside: a four-up KPI grid with `tabular-nums`, table cards with clickable rows, meters with `in`/`over` segments for m² against a plan bound, dotted-canvas empty states, and a toast.

Tokens are those in `app/globals.css` — accent `#7a3aff`, the ink/surface/line scales, radii from the 10/14/20/28 set, `--ease-out-expo`. The artifact's blue accent and 12px radii are discarded. Inter is already shipped at `app/fonts/inter-latin.woff2`; mono is reserved for CVR numbers, invoice numbers and amounts.

**One addition to the design system.** `app/globals.css` defines only `--c-warn`. Status badges need *active / overdue / cancelled*, so `--c-ok` and `--c-bad` are added alongside it, in both themes, rather than hard-coding greens and reds in components.

New components live in `components/admin/`: `AppShell`, `SideNav`, `TopBar`, `Kpi`, `TableCard`, `Meter`, `Badge`, `EmptyState`, `Toast`. `components/ui/Button.tsx`, `Field.tsx` and `Wordmark.tsx` are reused as they are.

## 6. Plans as data on the public site

`lib/plans-server.ts` reads active plans through a cached function tagged `plans`, mirroring `OVERRIDES_TAG` in `lib/copy-server.ts`. Saving a plan in admin calls `revalidateTag('plans')`. The pricing page keeps prerendering; an edit reaches visitors without a deploy.

This is the one change in this slice that touches the public site, so it carries a parity test (section 8).

## 7. Personal data, audit and GDPR

Persisting real people brings obligations that belong in this slice, not a later one.

Stored: name, email, company, CVR, address. **Card data is never stored** — Stripe holds it from slice 4.

Admin provides per-customer **export** (JSON of every row referencing them) and **delete**. `audit_log` records who changed what, which is needed anyway once prices are operational.

**A conflict that must be decided, not discovered.** Danish bookkeeping law requires accounting records be kept for five years; GDPR gives a right to erasure. These collide on invoices. The resolution this design adopts: deletion anonymises the customer and its users (name, email, address replaced with tombstones) but **retains invoice rows and their totals**, which is the standard reading — erasure does not override a legal retention duty. This needs confirmation from whoever owns compliance before launch; it is flagged in Risks.

## 8. Testing

**Node, via the existing `node --test test/` runner.** Pricing maths: øre arithmetic with no float drift, 25 % VAT, the 45 % annual discount, volume tiers at each boundary (1, 2, 5, 10 locations), `planForM2` at each `max_m2` edge, invoice subtotal/VAT/total consistency.

**SQL, via `supabase test db`.** RLS is the security boundary of a multi-tenant system and **cannot be unit-tested in Node**. These tests assert, as three different roles, that customer A cannot read, update or delete any row of customer B; that an anonymous caller reads active plans and nothing else; and that a `manager` cannot change roles. This is real setup work. Skipping it means shipping tenant isolation that nobody has verified.

**A migration parity test.** Seed the database from the current `PLANS` constant and assert the public pricing page renders byte-identical output to the code-driven version. Moving prices out of code must not change a single number on the marketing site.

## Out of scope

The `/my-odatone` product, billing, settings and stats screens; Stripe and any real charge; playback telemetry and the stats screens; admin users, profile and settings screens; the real music catalogue; merging the copy-editor password gate into staff auth; a transactional email provider.

## Risks

- **RLS recursion on `profiles`.** The most likely way this breaks. Mitigated by `SECURITY DEFINER` helpers and the SQL tests, which must run in CI.
- **Service-role key reaching the client.** One module, one import path, enforced by a build check.
- **Erasure versus five-year bookkeeping retention.** Section 7 adopts a defensible reading, but it is a compliance decision, not an engineering one, and needs sign-off.
- **`ANNUAL_DISCOUNT_PCT = 45` is unverified.** `lib/pricing.ts` carries a warning that 45 % is unusually deep for an annual term and may be a launch offer. Seeding it into the database makes it operational; confirm the number first.
- **`VOLUME_TIERS` are a proposal.** The same file states the current site has no multi-location pricing. Admin will display tier discounts that have never been sold.
- **Supabase auth email is rate-limited**, so invite volume is capped until slice 3 brings a provider.
- **The caching API is a deliberate compromise.** `unstable_cache` is legacy on Next 16, but its replacement needs `cacheComponents: true`, which changes rendering semantics for every existing marketing page. This slice matches `lib/copy-server.ts` and stays on the old API so there is one pattern, not two. Migrating both together is its own project.
