import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/admin/AppShell";
import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { Meter } from "@/components/admin/Meter";
import { SideNav, type NavItem } from "@/components/admin/SideNav";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { fetchAllRows } from "@/lib/admin/paginate";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { latestSubscription, locationFit } from "@/lib/admin/customers";
import { formatDkk, invoiceTotals, toOre } from "@/lib/money";
import { quote, type Billing, type Plan } from "@/lib/pricing";
import type { PlanRow } from "@/lib/plans-row";
import { createClient } from "@/lib/supabase/server";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/products", label: "Products" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/** A bordered card matching TableCard's outer shell, for the sections on
    this page that aren't a table (the customer's own details, its
    subscription). Kept local and unexported — nothing outside this page
    needs it, and TableCard itself hard-codes a <table> body that a plain
    definition list has no use for. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[0.9375rem] font-medium text-ink">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="u-label">{label}</dt>
      <dd className="text-[0.875rem] text-ink">{value}</dd>
    </div>
  );
}

type CustomerDetail = {
  id: string;
  name: string;
  cvr: string | null;
  billing_email: string;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country: string;
  status: string;
  created_at: string;
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  venue_type: string;
  m2: number;
};

type SubscriptionRow = {
  plan_id: string;
  billing: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

type ProfileRow = { id: string; full_name: string | null; role: string };

type InvoiceRow = {
  id: string;
  number: string;
  issued_at: string;
  period_start: string | null;
  subtotal_ore: number;
  vat_ore: number;
  total_ore: number;
  status: string;
  source: "seed" | "stripe";
};

/**
 * One customer's full picture: who they are, whether their venues still
 * fit what they pay for, who their users are, what they're subscribed to,
 * and their billing history.
 *
 * The m² meter against the plan's `maxM2` is the reason this page exists —
 * it is the only place a staff member can see that a customer has
 * outgrown their plan (a `small` customer whose location has crept past
 * 100 m²) at a glance, rather than by cross-referencing a location's area
 * against a plan's fine print by hand.
 *
 * Every price on this page — the meter's own bound, and the subscription's
 * quoted total — comes from a `Plan` object resolved against `plans`
 * (`lib/admin/plans.ts`), never a bare id. See that module's doc comment
 * for why: `quote()`'s id branch reads the compiled constant and ignores
 * the database, and that exact mistake has already shipped twice on this
 * branch (the public pricing page, then the dashboard's MRR), each time
 * only caught by editing a price live and watching a number fail to move.
 *
 * `locations` is read via `fetchAllRows` (lib/admin/paginate.ts), not a
 * plain `.select()`, for the same reason the list and dashboard pages do:
 * PostgREST silently caps an unpaginated read at `max_rows` (1000 locally
 * and on Supabase's cloud default). Here that isn't just a display count —
 * `locations.length` is the quantity `quote()` below prices this customer
 * on, so a truncated read would under-price a large chain's subscription,
 * not merely under-report it. `invoices` and `profiles` are paginated too,
 * for consistency, though a single customer reaching either cap is a much
 * more distant scenario.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: customer, error: customerError },
    locationsResult,
    { data: subscriptionRows, error: subscriptionError },
    profilesResult,
    invoicesResult,
    { data: planRows, error: planError },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, cvr, billing_email, address, postcode, city, country, status, created_at")
      .eq("id", id)
      .maybeSingle(),
    fetchAllRows<LocationRow>(
      (from, to) =>
        supabase
          .from("locations")
          .select("id, name, address, city, venue_type, m2", { count: "exact" })
          .eq("customer_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      "admin customer detail: locations",
    ),
    supabase
      .from("subscriptions")
      .select("plan_id, billing, status, current_period_end, created_at")
      .eq("customer_id", id),
    fetchAllRows<ProfileRow>(
      (from, to) =>
        supabase
          .from("profiles")
          .select("id, full_name, role", { count: "exact" })
          .eq("customer_id", id)
          .order("id", { ascending: true })
          .range(from, to),
      "admin customer detail: profiles",
    ),
    fetchAllRows<InvoiceRow>(
      (from, to) =>
        supabase
          .from("invoices")
          .select("id, number, issued_at, period_start, subtotal_ore, vat_ore, total_ore, status, source", {
            count: "exact",
          })
          .eq("customer_id", id)
          .order("issued_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "admin customer detail: invoices",
    ),
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  for (const [label, error] of [
    ["customer", customerError],
    ["locations", locationsResult.error],
    ["subscriptions", subscriptionError],
    ["profiles", profilesResult.error],
    ["invoices", invoicesResult.error],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[admin customer detail] failed to read ${label}`, error);
  }

  // maybeSingle() returns null, not an error, for an id that simply doesn't
  // exist — the ordinary shape of a stale link or a typo'd URL, not a
  // failure worth logging above.
  if (!customer) notFound();

  const detail = customer as CustomerDetail;
  const locations = locationsResult.rows;
  const profiles = profilesResult.rows;
  const invoices = invoicesResult.rows;

  const planById = planMap((planRows ?? []) as PlanRow[]);
  const subscription = latestSubscription((subscriptionRows ?? []) as SubscriptionRow[]);
  const plan: Plan | null = subscription
    ? resolvePlan(subscription.plan_id, planById, "admin customer detail")
    : null;

  // The blanket notice below is only shown when *every* invoice is seeded
  // — once a real Stripe invoice exists alongside older seed rows, a
  // banner covering the whole table would sit above genuine revenue and
  // imply it's fake too. The per-row "Seed" tag in the table itself is
  // what still marks the mixed case correctly.
  const allInvoicesSeeded = invoices.length > 0 && invoices.every((inv) => inv.source === "seed");

  return (
    <AppShell nav={<SideNav items={NAV} activeHref="/admin/customers" />}>
      <TopBar crumbs={["Admin", "Customers", detail.name]} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-5">
        <div className="grid shrink-0 grid-cols-2 gap-4 max-[900px]:grid-cols-1">
          <Panel title="Customer">
            <dl className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
              <Field label="Company" value={detail.name} />
              <Field label="CVR" value={<span className="font-mono">{detail.cvr ?? "—"}</span>} />
              <Field label="Billing email" value={detail.billing_email} />
              <Field
                label="Address"
                value={[detail.address, detail.postcode, detail.city, detail.country].filter(Boolean).join(", ") || "—"}
              />
              <Field label="Status" value={<Badge tone={statusTone(detail.status)}>{detail.status}</Badge>} />
              <Field label="Customer since" value={formatDate(detail.created_at)} />
            </dl>
          </Panel>

          <Panel title="Subscription">
            {subscription && plan ? (
              (() => {
                const q = quote(plan, subscription.billing as Billing, locations.length);
                const totals = invoiceTotals(toOre(q.monthlyExVat));
                return (
                  <dl className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
                    <Field label="Plan" value={plan.name} />
                    <Field
                      label="Billing"
                      value={subscription.billing === "annual" ? "Annual" : "Monthly"}
                    />
                    <Field
                      label="Status"
                      value={<Badge tone={statusTone(subscription.status)}>{subscription.status}</Badge>}
                    />
                    <Field label="Renews" value={formatDate(subscription.current_period_end)} />
                    <Field
                      label="Monthly, ex. VAT"
                      value={<span className="u-tabular">{formatDkk(totals.subtotalOre, "en")}</span>}
                    />
                    <Field
                      label="Monthly, inc. VAT"
                      value={<span className="u-tabular">{formatDkk(totals.totalOre, "en")}</span>}
                    />
                  </dl>
                );
              })()
            ) : (
              <p className="text-[0.875rem] text-ink-2">No subscription yet.</p>
            )}
          </Panel>
        </div>

        {/* shrink-0: a direct child of the scrollable flex column above.
            Without it, a section short enough to have little intrinsic
            content (this one-row table, on a page whose total content
            exceeds the viewport) gets compressed toward zero height by the
            flex-shrink algorithm — overflow-auto on the ancestor makes an
            item's automatic minimum size 0, so nothing stops it. Confirmed
            live: the meter and its "over" badge rendered in the DOM with
            correct values but at ~2px of clipped height until this was
            added. The container still scrolls; only individual sections
            are pinned to their natural size. */}
        <div className="shrink-0">
          {locations.length === 0 ? (
            <EmptyState
              title="No locations yet"
              description="Venues this customer adds will show up here, each measured against their plan."
            />
          ) : (
            <TableCard title="Locations">
              <thead>
                <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Fit</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => {
                  const maxM2 = plan?.maxM2 ?? null;
                  const fit = locationFit(loc.m2, maxM2);
                  return (
                    <tr key={loc.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 text-ink">{loc.name}</td>
                      <td className="px-5 py-3 capitalize text-ink-2">{loc.venue_type}</td>
                      <td className="px-5 py-3 text-ink-2">{loc.city ?? "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-40">
                            <Meter used={loc.m2} limit={maxM2} />
                          </div>
                          {fit === "over" && <Badge tone="warn">over</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </div>

        <div className="shrink-0">
          {profiles.length === 0 ? (
            <EmptyState title="No users yet" description="Owners and managers this customer invites will show up here." />
          ) : (
            <TableCard title="Users">
              <thead>
                <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-ink">{p.full_name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{p.role}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3">
          {allInvoicesSeeded && (
            /* text-ink-2 measured at ~3:1 against this card's background —
               below WCAG AA's 4.5:1 for normal-size text, on the one
               element whose entire job is to not be missed. Forced via
               inline style (highest specificity, so it can't be quietly
               re-muted by `.u-label`'s own default colour) rather than a
               `text-*` utility class. */
            <p
              className="u-label rounded-[var(--radius-sm)] border border-line bg-surface-2/60 px-4 py-3"
              style={{ color: "var(--c-ink)" }}
            >
              Seeded data. Billing arrives with Stripe.
            </p>
          )}
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Invoices will show up here once billing starts." />
          ) : (
            <TableCard title="Invoices">
              <thead>
                <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Issued</th>
                  <th className="px-5 py-3 text-right font-medium">Subtotal</th>
                  <th className="px-5 py-3 text-right font-medium">VAT</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-mono text-ink">{inv.number}</td>
                    <td className="px-5 py-3 text-ink-2">{formatDate(inv.issued_at)}</td>
                    <td className="u-tabular px-5 py-3 text-right text-ink-2">
                      {formatDkk(inv.subtotal_ore, "en")}
                    </td>
                    <td className="u-tabular px-5 py-3 text-right text-ink-2">{formatDkk(inv.vat_ore, "en")}</td>
                    <td className="u-tabular px-5 py-3 text-right text-ink">{formatDkk(inv.total_ore, "en")}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {/* Per-row, not just the blanket banner above: once a
                          customer has a mix of seed and real Stripe rows,
                          this is the only thing on the page that still
                          says which is which. */}
                      {inv.source === "seed" ? <Badge tone="neutral">seed</Badge> : <span className="text-ink-2">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>
    </AppShell>
  );
}
