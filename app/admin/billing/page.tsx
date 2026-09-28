import Link from "next/link";

import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { AppShell } from "@/components/admin/AppShell";
import { ReceiptGlyph } from "@/components/admin/icons";
import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { fetchAllRows } from "@/lib/admin/paginate";
import { formatDkk } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/* invoice_status (supabase/migrations/0002_commerce.sql) also carries
   'draft' and 'overdue'. Neither is ever written by this codebase: a row
   only exists once it is numbered by issue_invoice (0010_invoice_lines.sql),
   so no invoice is ever 'draft'; and 'overdue' has no writer either —
   dunning automation belongs to a later slice. This list is therefore the
   three real stored statuses plus the one *computed* one, which is the
   whole point of Task 8: 'overdue' has to be a filterable value even
   though the database never holds it. */
const STATUS_FILTERS = ["open", "overdue", "paid", "void"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type InvoiceRow = {
  id: string;
  number: string;
  customer_id: string;
  issued_at: string;
  due_at: string | null;
  total_ore: number;
  status: string;
};

type CustomerRow = { id: string; name: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/**
 * The status this row actually displays. An `open` invoice whose `due_at`
 * has passed reads as "overdue" — computed here, from `due_at < now`, and
 * never written back to `invoices.status`. See the STATUS_FILTERS comment
 * above for why the database itself never holds this value in this slice.
 *
 * `now` is threaded in rather than read again per row with `new Date()`,
 * so every row on one render of this page is judged against the same
 * instant — the same reasoning invoice-actions.ts gives for reading
 * issued_at/due_at back from Postgres instead of a second JS clock, just
 * applied to "now" instead of to a written timestamp.
 */
function displayStatus(row: InvoiceRow, now: Date): StatusFilter | string {
  if (row.status === "open" && row.due_at && new Date(row.due_at) < now) return "overdue";
  return row.status;
}

/**
 * Every invoice, across every customer, newest first — the cross-customer
 * view Task 6/7 didn't need because they worked one customer's invoices at
 * a time (app/admin/customers/[id]/page.tsx).
 *
 * Read through the session client, not the service-role client
 * invoice-actions.ts reaches for to mint a number: `invoices_read`
 * (0003_tenancy.sql) already admits staff to every row, so there is no RLS
 * policy here to bypass and no reason to hold a customer id of one's own.
 *
 * `invoices` and `customers` are each read in full via `fetchAllRows`
 * (lib/admin/paginate.ts), then joined in memory by `customer_id` — the
 * same shape app/admin/customers/page.tsx uses for locations and
 * subscriptions — rather than a single unbounded `.select()` on either
 * table, because PostgREST silently caps a plain read at `max_rows` (1000
 * locally and on Supabase's cloud default) and a truncated invoice list is
 * worse than a slow one.
 *
 * Filtering happens after both reads, against `displayStatus`, not as a
 * `.eq("status", …)` on the query — the query has no column to filter
 * `overdue` against, and matching the two paths (a real stored status vs.
 * the computed one) against two different mechanisms would only be a
 * second place for them to disagree. This means an `open` invoice past due
 * disappears from `?status=open` and appears under `?status=overdue`
 * instead: the two are mutually exclusive here exactly as they are in the
 * Badge each row renders, never a row counted under both.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = (STATUS_FILTERS as readonly string[]).includes(status ?? "")
    ? (status as StatusFilter)
    : undefined;

  const supabase = await createClient();

  const [invoicesResult, customersResult] = await Promise.all([
    fetchAllRows<InvoiceRow>(
      (from, to) =>
        supabase
          .from("invoices")
          .select("id, number, customer_id, issued_at, due_at, total_ore, status", { count: "exact" })
          .order("issued_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "admin billing: invoices",
    ),
    fetchAllRows<CustomerRow>(
      (from, to) =>
        supabase.from("customers").select("id, name", { count: "exact" }).order("id", { ascending: true }).range(from, to),
      "admin billing: customers",
    ),
  ]);

  for (const [label, error] of [
    ["invoices", invoicesResult.error],
    ["customers", customersResult.error],
  ] as const) {
    if (error) console.error(`[admin billing] failed to read ${label}`, error);
  }

  const customerNames = new Map<string, string>();
  for (const c of customersResult.rows) customerNames.set(c.id, c.name);

  const now = new Date();
  const allRows = invoicesResult.rows.map((row) => ({
    ...row,
    customerName: customerNames.get(row.customer_id) ?? "—",
    displayStatus: displayStatus(row, now),
  }));

  const rows = activeStatus ? allRows.filter((row) => row.displayStatus === activeStatus) : allRows;

  return (
    <AppShell nav={<AdminSideNav activeHref="/admin/billing" />}>
      <TopBar crumbs={["Admin", "Billing"]} icon={<ReceiptGlyph />} />
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">
        <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/billing"
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
              href={`/admin/billing?status=${s}`}
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
            title={activeStatus ? `No ${activeStatus} invoices` : "No invoices yet"}
            description={
              activeStatus
                ? "No invoice currently has this status."
                : "Invoices issued from a customer's page will show up here."
            }
            action={
              activeStatus ? (
                <Link href="/admin/billing" className="u-label text-accent hover:underline">
                  Clear filter
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TableCard title="Invoices">
            <thead>
              <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Issued</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                  <td className="px-5 py-3 font-mono text-ink">{row.number}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/customers/${row.customer_id}`}
                      className="text-ink underline-offset-2 hover:underline focus-visible:rounded-[var(--radius-xs)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {row.customerName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(row.issued_at)}</td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(row.due_at)}</td>
                  <td className="u-tabular px-5 py-3 text-right text-ink">{formatDkk(row.total_ore, "en")}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.displayStatus)}>{row.displayStatus}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </AppShell>
  );
}
