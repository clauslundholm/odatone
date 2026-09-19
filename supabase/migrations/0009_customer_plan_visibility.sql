-- Task 14 (the customer portal's account summary) prices a customer's
-- current subscription with quote(plan, billing, locations.length), reading
-- `plan` from the database through the customer's own session — never a
-- bare PlanId, for the reasons lib/admin/plans.ts's resolvePlan already
-- documents at length. That only works if the session can actually read
-- the row: 0003_tenancy.sql's plans_public_read policy is
-- `using (active or is_staff())`, so a customer whose subscription
-- references a plan staff have since deactivated (`active = false`) could
-- not see that plan at all through their own session — RLS would silently
-- filter it out of `select * from plans`, and resolvePlan's fallback to
-- the compiled PLANS constant would fire on every single such customer,
-- which is exactly the "quote() from the wrong source" bug class this
-- branch has already shipped four times, just from the RLS side instead
-- of the application-code side.
--
-- Extends the policy with a third clause: a plan is also visible to a
-- customer session if one of that customer's own subscriptions references
-- it. `auth_customer_id()` (0003_tenancy.sql) already resolves the
-- session's own customer id via profiles, the same function
-- customers_read/locations_read/etc. rely on, so this draws on no new
-- authority — it only extends "which plans" a customer may read, never
-- "which customers'" subscriptions decide that for them: the subquery is
-- scoped to `s.customer_id = auth_customer_id()`, so seeing a deactivated
-- plan requires actually being subscribed to it, not merely being some
-- authenticated customer.
drop policy if exists plans_public_read on plans;

create policy plans_public_read on plans for select
  using (
    active
    or is_staff()
    or exists (
      select 1 from subscriptions s
      where s.plan_id = plans.id and s.customer_id = auth_customer_id()
    )
  );
