import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { AppShell } from "@/components/admin/AppShell";
import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { Kpi } from "@/components/admin/Kpi";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { fetchAllRows } from "@/lib/admin/paginate";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { mrrOre, type SubscriptionForMrr } from "@/lib/admin/stats";
import { formatDkk } from "@/lib/money";
import type { Billing } from "@/lib/pricing";
import type { PlanRow } from "@/lib/plans-row";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  customer_id: string;
  plan_id: string;
  billing: string;
  status: string;
};

type CustomerRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/**
 * The first screen staff see after signing in: four counts of the shape of
 * the business, and the customers who most recently joined it.
 *
 * MRR is the one figure here that isn't a plain count, and it deliberately
 * shares its arithmetic with the public pricing page: `mrrOre` (Task 10,
 * `lib/admin/stats.ts`) normalises every earning subscription to a month
 * with the very same `quote()` odatone.com/priser prices from, rather than
 * re-deriving the discount and volume-tier maths a second time. Two
 * implementations of that maths would disagree the first time a discount
 * changed, and this is the number staff use to understand the business.
 *
 * `quote()`'s bare-`PlanId` branch resolves against the *compiled* `PLANS`
 * array, never the database (see lib/pricing.ts) — so `mrrOre` is only
 * honest if it's handed already-resolved `Plan` objects read from the
 * database, not ids. This page reads every row of `plans` (not just
 * `activePlans()`'s active-only subset — a customer can still be on a plan
 * that's since been deactivated, and mispricing that customer is the exact
 * bug this exists to prevent) through `lib/supabase/server.ts`'s
 * session-bound `createClient()`, so the signed-in staff session's RLS
 * (`plans_public_read`'s `using (active or is_staff())`) is what allows the
 * inactive rows through. Every subscription's `plan_id` is resolved against
 * that map before it ever reaches `mrrOre`; a miss falls back to the
 * compiled plan with a logged warning naming the id, rather than silently.
 *
 * `locations` is a *count of a customer's location rows*, not a fixed
 * number, because the volume tier in `quote()` depends on it — a customer
 * with three venues is not simply three times the price of one. Fetching
 * that count per subscription in a loop would be an N+1 query against a
 * table that only grows, so this instead reads every location row (via
 * `fetchAllRows`, lib/admin/paginate.ts — PostgREST silently caps a plain
 * `.select()` at `max_rows`, 1000 locally and on Supabase's cloud default,
 * so an unpaginated read past that count would quietly under-report every
 * customer's locations and this dashboard's MRR with it) and folds it into
 * a `Map` in memory below. The same is true of `subscriptions`.
 */
export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: customerCount, error: customerCountError },
    { count: activeSubscriptionCount, error: activeCountError },
    { count: pendingCount, error: pendingCountError },
    subscriptionsResult,
    locationsResult,
    { data: recentCustomerRows, error: recentError },
    { data: planRows, error: planError },
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    fetchAllRows<SubscriptionRow>(
      (from, to) =>
        supabase
          .from("subscriptions")
          .select("customer_id, plan_id, billing, status", { count: "exact" })
          .order("id", { ascending: true })
          .range(from, to),
      "admin dashboard: subscriptions",
    ),
    fetchAllRows<{ customer_id: string }>(
      (from, to) =>
        supabase.from("locations").select("customer_id", { count: "exact" }).order("id", { ascending: true }).range(from, to),
      "admin dashboard: locations",
    ),
    supabase
      .from("customers")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    /* Every plan, active or not — see the doc comment above. Deliberately
       not activePlans() (Task 6's cached, anon-key, active-only reader for
       the public pricing page): a staff session can and must see a
       deactivated plan too, or a customer still on one gets mispriced. */
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  for (const [label, error] of [
    ["customers count", customerCountError],
    ["active subscriptions count", activeCountError],
    ["pending signups count", pendingCountError],
    ["subscriptions", subscriptionsResult.error],
    ["locations", locationsResult.error],
    ["recent customers", recentError],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[admin dashboard] failed to read ${label}`, error);
  }

  const planById = planMap((planRows ?? []) as PlanRow[]);

  /* Every location row, folded into a per-customer count here, rather than
     one query per subscription — see the doc comment above. An empty
     table folds to an empty map, and every lookup below already defaults a
     miss to 0, so this is also what makes a freshly seeded database render
     zeroes instead of throwing. */
  const locationCounts = new Map<string, number>();
  for (const row of locationsResult.rows) {
    locationCounts.set(row.customer_id, (locationCounts.get(row.customer_id) ?? 0) + 1);
  }

  const subscriptionsForMrr: SubscriptionForMrr[] = subscriptionsResult.rows.map((row) => ({
    plan: resolvePlan(row.plan_id, planById, "admin dashboard"),
    billing: row.billing as Billing,
    locations: locationCounts.get(row.customer_id) ?? 0,
    status: row.status as SubscriptionForMrr["status"],
  }));

  const mrr = mrrOre(subscriptionsForMrr);
  const recentCustomers = (recentCustomerRows ?? []) as CustomerRow[];

  return (
    <AppShell nav={<AdminSideNav activeHref="/admin" />}>
      <TopBar crumbs={["Admin", "Dashboard"]} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-5">
        <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[520px]:grid-cols-1">
          <Kpi label="Customers" value={String(customerCount ?? 0)} />
          <Kpi
            label="Active subscriptions"
            value={String(activeSubscriptionCount ?? 0)}
            hint="Status = active only"
          />
          <Kpi
            label="MRR"
            value={formatDkk(mrr, "en")}
            hint="Active, trialing & past-due · ex. VAT · per month"
          />
          <Kpi
            label="Pending signups"
            value={String(pendingCount ?? 0)}
            tone="warn"
            href="/admin/customers?status=pending"
            hint="Review →"
          />
        </div>

        {recentCustomers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="New signups and the customers you add will show up here."
          />
        ) : (
          <TableCard title="Recent customers">
            <thead>
              <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 text-ink">{customer.name}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(customer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </AppShell>
  );
}
