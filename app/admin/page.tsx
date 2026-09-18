import { AppShell } from "@/components/admin/AppShell";
import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { Kpi } from "@/components/admin/Kpi";
import { SideNav, type NavItem } from "@/components/admin/SideNav";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { mrrOre, type SubscriptionForMrr } from "@/lib/admin/stats";
import { formatDkk } from "@/lib/money";
import { plan as compiledPlanById, type Billing, type Plan, type PlanId } from "@/lib/pricing";
import { rowToPlan, type PlanRow } from "@/lib/plans-row";
import { createClient } from "@/lib/supabase/server";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
];

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

/** Resolves `id` against `plans`, falling back to the compiled plan of the
    same id — loudly, naming the id, never silently. A silent fallback here
    is exactly how the pricing-page/dashboard mismatch this guards against
    would go undetected: an admin edits a price, the pricing page moves, and
    this dashboard's MRR would stay frozen at the old number with nothing in
    any log to say why. */
function resolvePlan(id: string, byId: Map<PlanId, Plan>): Plan {
  const known = byId.get(id as PlanId);
  if (known) return known;
  console.warn(
    `[admin dashboard] plan "${id}" was not found in the database — pricing it from the compiled fallback instead.`,
  );
  return compiledPlanById(id as PlanId);
}

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
 * table that only grows, so this instead reads every location row once
 * (just its `customer_id`) and folds it into a `Map` in memory below.
 */
export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: customerCount, error: customerCountError },
    { count: activeSubscriptionCount, error: activeCountError },
    { count: pendingCount, error: pendingCountError },
    { data: subscriptionRows, error: subscriptionError },
    { data: locationRows, error: locationError },
    { data: recentCustomerRows, error: recentError },
    { data: planRows, error: planError },
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("subscriptions").select("customer_id, plan_id, billing, status"),
    supabase.from("locations").select("customer_id"),
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
    ["subscriptions", subscriptionError],
    ["locations", locationError],
    ["recent customers", recentError],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[admin dashboard] failed to read ${label}`, error);
  }

  const planById = new Map<PlanId, Plan>(
    ((planRows ?? []) as PlanRow[]).map((row) => [row.id as PlanId, rowToPlan(row)]),
  );

  /* One query for every location row, folded into a per-customer count
     here, rather than one query per subscription — see the doc comment
     above. An empty table folds to an empty map, and every lookup below
     already defaults a miss to 0, so this is also what makes a freshly
     seeded database render zeroes instead of throwing. */
  const locationCounts = new Map<string, number>();
  for (const row of (locationRows ?? []) as { customer_id: string }[]) {
    locationCounts.set(row.customer_id, (locationCounts.get(row.customer_id) ?? 0) + 1);
  }

  const subscriptionsForMrr: SubscriptionForMrr[] = ((subscriptionRows ?? []) as SubscriptionRow[]).map(
    (row) => ({
      plan: resolvePlan(row.plan_id, planById),
      billing: row.billing as Billing,
      locations: locationCounts.get(row.customer_id) ?? 0,
      status: row.status as SubscriptionForMrr["status"],
    }),
  );

  const mrr = mrrOre(subscriptionsForMrr);
  const recentCustomers = (recentCustomerRows ?? []) as CustomerRow[];

  return (
    <AppShell nav={<SideNav items={NAV} activeHref="/admin" />}>
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
