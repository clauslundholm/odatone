import Link from "next/link";

import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { AppShell } from "@/components/admin/AppShell";
import { UsersGlyph } from "@/components/admin/icons";
import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { fetchAllRows } from "@/lib/admin/paginate";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { customerRows, latestSubscription, type RawCustomer } from "@/lib/admin/customers";
import { formatDkk } from "@/lib/money";
import type { Billing } from "@/lib/pricing";
import type { PlanRow } from "@/lib/plans-row";
import type { SubscriptionStatus } from "@/lib/admin/stats";
import { createClient } from "@/lib/supabase/server";

/* customer_status, mirrored from supabase/migrations/0001_core.sql. Kept as
   a plain array here rather than generated from the database enum — the
   only other definition of "which statuses exist" in this codebase is the
   SQL type itself, and there is no existing machinery that reads a Postgres
   enum into a TS array. */
const STATUS_FILTERS = ["pending", "active", "suspended", "cancelled"] as const;

type CustomerRow = {
  id: string;
  name: string;
  cvr: string | null;
  status: string;
  created_at: string;
};

type LocationRow = { customer_id: string };

type SubscriptionRow = {
  customer_id: string;
  plan_id: string;
  billing: string;
  status: string;
  created_at: string;
};

/**
 * The customer roster: every company, how many venues they run, what plan
 * they're on and what they're worth per month. The dashboard's pending-
 * signups tile (Task 10) links here with `?status=pending`, so the filter
 * has to be a real querystring a link can carry, not client-side state.
 *
 * Plan pricing follows the same rule as the dashboard's MRR (see its doc
 * comment in app/admin/page.tsx and lib/admin/plans.ts): every subscription
 * is resolved to a `Plan` object read from `plans` before it reaches
 * `customerRows`/`mrrOre`, never priced from a bare id, so an edited price
 * moves this list exactly as it moves the dashboard.
 *
 * Locations and subscriptions are each read in full — across as many pages
 * as it takes, via `fetchAllRows` (lib/admin/paginate.ts) rather than one
 * unbounded `.select()`, since PostgREST silently caps a plain read at
 * `max_rows` (1000 locally and on Supabase's cloud default). Reproduced
 * live: a 1201-location customer rendered as "933 locations" with a wrong
 * MRR next to it, and nothing on screen said the read had been truncated.
 * `fetchAllRows` still folds the result into per-customer maps in memory —
 * one or a few queries per table, not one per customer row, however many
 * customers exist — it only pays for a second page once a table actually
 * has one.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number])
    ? (status as (typeof STATUS_FILTERS)[number])
    : undefined;

  const supabase = await createClient();

  const [customersResult, locationsResult, subscriptionsResult, { data: planRows, error: planError }] =
    await Promise.all([
      fetchAllRows<CustomerRow>((from, to) => {
        let q = supabase
          .from("customers")
          .select("id, name, cvr, status, created_at", { count: "exact" })
          // `.order("id")` after the business-meaningful `name` sort breaks
          // ties deterministically — LIMIT/OFFSET paging without a total
          // order is documented as non-deterministic, and could in
          // principle skip or repeat a row at a page boundary.
          .order("name", { ascending: true })
          .order("id", { ascending: true });
        if (activeStatus) q = q.eq("status", activeStatus);
        return q.range(from, to);
      }, "admin customers: customers"),
      fetchAllRows<LocationRow>(
        (from, to) =>
          supabase.from("locations").select("customer_id", { count: "exact" }).order("id", { ascending: true }).range(from, to),
        "admin customers: locations",
      ),
      fetchAllRows<SubscriptionRow>(
        (from, to) =>
          supabase
            .from("subscriptions")
            .select("customer_id, plan_id, billing, status, created_at", { count: "exact" })
            .order("id", { ascending: true })
            .range(from, to),
        "admin customers: subscriptions",
      ),
      supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
    ]);

  for (const [label, error] of [
    ["customers", customersResult.error],
    ["locations", locationsResult.error],
    ["subscriptions", subscriptionsResult.error],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[admin customers] failed to read ${label}`, error);
  }

  const planById = planMap((planRows ?? []) as PlanRow[]);

  const locationCounts = new Map<string, number>();
  for (const row of locationsResult.rows) {
    locationCounts.set(row.customer_id, (locationCounts.get(row.customer_id) ?? 0) + 1);
  }

  const subscriptionsByCustomer = new Map<string, SubscriptionRow[]>();
  for (const row of subscriptionsResult.rows) {
    const list = subscriptionsByCustomer.get(row.customer_id) ?? [];
    list.push(row);
    subscriptionsByCustomer.set(row.customer_id, list);
  }

  const customers = customersResult.rows;
  const raw: RawCustomer[] = customers.map((customer) => {
    const current = latestSubscription(subscriptionsByCustomer.get(customer.id) ?? []);
    return {
      id: customer.id,
      name: customer.name,
      cvr: customer.cvr,
      status: customer.status,
      createdAt: customer.created_at,
      locationCount: locationCounts.get(customer.id) ?? 0,
      subscription: current
        ? {
            planId: current.plan_id,
            plan: resolvePlan(current.plan_id, planById, "admin customers list") ?? null,
            billing: current.billing as Billing,
            status: current.status as SubscriptionStatus,
          }
        : null,
    };
  });

  const rows = customerRows(raw);

  return (
    <AppShell nav={<AdminSideNav activeHref="/admin/customers" />}>
      <TopBar crumbs={["Admin", "Customers"]} icon={<UsersGlyph />} />
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">
        <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/customers"
            aria-current={!activeStatus ? "page" : undefined}
            className={`u-label rounded-full px-3 py-1.5 transition-colors ${
              !activeStatus ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"
            }`}
          >
            All
          </Link>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={`/admin/customers?status=${s}`}
              aria-current={activeStatus === s ? "page" : undefined}
              className={`u-label rounded-full px-3 py-1.5 capitalize transition-colors ${
                activeStatus === s ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"
              }`}
            >
              {s}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <EmptyState
            title={activeStatus ? `No ${activeStatus} customers` : "No customers yet"}
            description={
              activeStatus
                ? "No customer currently has this status."
                : "New signups and the customers you add will show up here."
            }
            action={
              activeStatus ? (
                <Link href="/admin/customers" className="u-label text-accent hover:underline">
                  Clear filter
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TableCard title="Customers">
            <thead>
              <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">CVR</th>
                <th className="px-5 py-3 font-medium">Locations</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                  {/* The row's real interactive element: a plain <a>
                      (Next's Link) inside a normal <td>, not a <div> with
                      onClick or a <tr>/<td> made focusable by hand. An
                      earlier draft tried wrapping every <td> in one Link
                      spanning the row via `display: contents`, mirroring
                      Kpi.tsx's whole-tile-link trick — but a table row's
                      children are only ever parsed as td/th: the browser's
                      HTML parser foster-parents an <a> straight out of a
                      <tr> during SSR, which broke hydration and made the
                      row untabbable (confirmed live: focus never landed on
                      it). A Link inside its own <td> has no such content
                      model to violate, and is a completely ordinary,
                      natively focusable and Enter-activatable link. */}
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/customers/${row.id}`}
                      className="text-ink underline-offset-2 hover:underline focus-visible:rounded-[var(--radius-xs)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-ink-2">{row.cvr ?? "—"}</td>
                  <td className="u-tabular px-5 py-3 text-ink-2">{row.locationCount}</td>
                  {/* An unpriced plan shows its bare id in monospace and says
                      so, rather than reading like any other plan name while
                      the MRR column beside it silently shows 0 kr. */}
                  <td className="px-5 py-3 text-ink-2">
                    {row.planName === null ? (
                      "—"
                    ) : row.planUnpriced ? (
                      <span className="text-bad">
                        <span className="font-mono">{row.planName}</span> · unknown plan
                      </span>
                    ) : (
                      row.planName
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="u-tabular px-5 py-3 text-right text-ink">{formatDkk(row.mrrOre, "en")}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </AppShell>
  );
}
