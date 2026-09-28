import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ReceiptGlyph } from "@/components/admin/icons";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { PortalShell } from "@/components/portal/PortalShell";
import { fetchAllRows } from "@/lib/admin/paginate";
import { latestSubscription } from "@/lib/admin/customers";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { HTML_LANG } from "@/lib/i18n";
import { INVOICE_STATUS_LABEL, localizeStatus, portal, portalRoleLabel } from "@/lib/content/portal";
import { formatDkk, toOre } from "@/lib/money";
import { quote, type Billing, type Plan } from "@/lib/pricing";
import type { PlanRow } from "@/lib/plans-row";
import { getPortalLocale } from "@/lib/portal-locale";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = { customer_id: string | null; role: string | null };
type CustomerRow = { name: string };

type SubscriptionRow = {
  plan_id: string;
  billing: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  issued_at: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string | null;
  total_ore: number;
  status: string;
};

/** Mirrors app/my-odatone/page.tsx's own local Panel — same bordered-card
    shell, kept local rather than shared, matching that page's own reason
    for not sharing it further than it already is. */
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

/**
 * The status a row actually displays. An `open` invoice whose `due_at` has
 * passed reads as "overdue" — computed here, from `due_at < now`, and never
 * written back to `invoices.status`. This is the identical rule
 * app/admin/billing/page.tsx's own `displayStatus` applies (that file's own
 * comment explains why the database never stores 'overdue' in this slice) —
 * kept as a second, small, local copy rather than an import across the
 * admin/portal boundary, but deliberately the same computation: the brief
 * for this page is explicit that "overdue" must not grow a second rule.
 *
 * `now` is threaded in, not read again per row with `new Date()`, so every
 * row on one render of this page is judged against the same instant.
 */
function displayStatus(row: { status: string; due_at: string | null }, now: Date): string {
  if (row.status === "open" && row.due_at && new Date(row.due_at) < now) return "overdue";
  return row.status;
}

/**
 * `/my-odatone/billing` (Task 10): the signed-in customer's own invoices,
 * newest first, each with a download link to the authorised PDF route
 * (`app/api/invoices/[id]/pdf`, Task 9 — that route is itself the entire
 * authorisation boundary for the document, so this page need not, and must
 * not, duplicate any of its checks). Above the list, the subscription this
 * customer is actually billed under: plan, term, what the current term
 * costs, and when it next renews.
 *
 * Every read below is scoped by RLS alone (`invoices_read`, `customers_read`,
 * `subscriptions_read` — supabase/migrations/0003_tenancy.sql), through the
 * session-bound client, with no `customer_id` filter of this page's own
 * construction anywhere: `invoices_read`'s `customer_id = auth_customer_id()`
 * clause already narrows every one of these tables to the caller's own
 * customer, so an explicit `.eq("customer_id", …)` here would be both
 * redundant and, if it were ever built from the wrong value, a second and
 * unnecessary way to leak or misscope a read that RLS already guarantees.
 * The one id this page does read explicitly is the caller's *own* `auth.uid()`,
 * to select the caller's own `profiles` row — not a customer id, and not
 * optional, since `profiles_read_own` scopes a non-staff read to `id =
 * auth.uid()` and there is no bare "give me my profile" query without it.
 *
 * `plans` is read the same way app/my-odatone/page.tsx documents at length:
 * in full, active or not, so a subscription pinned to a plan staff have
 * since deactivated still prices from the database rather than
 * `quote()`'s compiled fallback (0009_customer_plan_visibility.sql is what
 * keeps that plan visible to this exact session).
 */
export default async function PortalBillingPage() {
  const locale = await getPortalLocale();
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  // proxy.ts already denies any request here with no verified session —
  // guarded anyway rather than trusting that invariant a second time, the
  // same defensive posture app/my-odatone/page.tsx takes.
  if (!userId) notFound();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("customer_id, role")
    .eq("id", userId)
    .single();

  if (profileError) console.error("[my-odatone billing] failed to read profile", profileError);
  const profile = profileRow as ProfileRow | null;
  // A customer-role profile always has a customer_id (profiles_tenancy_ck,
  // 0001_core.sql) — proxy.ts's mayEnter already required a customer role
  // to reach this route. Still checked explicitly, never assumed, matching
  // the summary page's own guard.
  if (!profile?.customer_id) notFound();

  const [
    { data: customerRow, error: customerError },
    { data: subscriptionRows, error: subscriptionError },
    { count: locationCount, error: locationError },
    invoicesResult,
    { data: planRows, error: planError },
  ] = await Promise.all([
    supabase.from("customers").select("name").maybeSingle(),
    supabase.from("subscriptions").select("plan_id, billing, status, current_period_end, created_at"),
    // Just the count: quote() below only needs how many locations this
    // subscription is priced against, the same quantity
    // app/my-odatone/page.tsx passes it as `locations.length` — not the
    // rows themselves, which this page has nothing else to show.
    supabase.from("locations").select("id", { count: "exact", head: true }),
    fetchAllRows<InvoiceRow>(
      (from, to) =>
        supabase
          .from("invoices")
          .select("id, number, issued_at, period_start, period_end, due_at, total_ore, status", {
            count: "exact",
          })
          .order("issued_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "my-odatone billing: invoices",
    ),
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  for (const [label, error] of [
    ["customer", customerError],
    ["subscriptions", subscriptionError],
    ["locations", locationError],
    ["invoices", invoicesResult.error],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[my-odatone billing] failed to read ${label}`, error);
  }

  if (!customerRow) notFound();
  const customer = customerRow as CustomerRow;
  const invoices = invoicesResult.rows;

  const planById = planMap((planRows ?? []) as PlanRow[]);
  const subscription = latestSubscription((subscriptionRows ?? []) as SubscriptionRow[]);
  const plan: Plan | null = subscription
    ? resolvePlan(subscription.plan_id, planById, "my-odatone billing")
    : null;

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat(HTML_LANG[locale], { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  };

  const t = portal.billing;
  const roleLabel = portalRoleLabel(profile.role, locale);
  const now = new Date();

  return (
    <PortalShell
      locale={locale}
      activeHref="/my-odatone/billing"
      customerName={customer.name}
      roleLabel={roleLabel}
    >
      <TopBar crumbs={[t.crumb[locale]]} icon={<ReceiptGlyph />} breadcrumbLabel={portal.shell.ariaBreadcrumb[locale]} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-5">
        <div className="shrink-0">
          <Panel title={t.subscriptionPanel[locale]}>
            {subscription && plan ? (
              (() => {
                // What the current term actually charges — quote()'s
                // chargeExVat, not monthlyExVat: an annual subscription's
                // "price per period" is the yearly sum, not a twelfth of
                // it. Priced against this customer's real location count
                // (quote() itself floors at 1), the same quantity
                // app/my-odatone/page.tsx's own plan panel prices from.
                const q = quote(plan, subscription.billing as Billing, locationCount ?? 1);
                return (
                  <dl className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
                    <Field label={t.planLabel[locale]} value={plan.name} />
                    <Field
                      label={t.termLabel[locale]}
                      value={subscription.billing === "annual" ? t.termAnnual[locale] : t.termMonthly[locale]}
                    />
                    <Field
                      label={t.priceLabel[locale]}
                      value={<span className="u-tabular">{formatDkk(toOre(q.chargeExVat), locale)}</span>}
                    />
                    <Field label={t.renewalLabel[locale]} value={formatDate(subscription.current_period_end)} />
                  </dl>
                );
              })()
            ) : (
              <p className="text-[0.875rem] text-ink-2">{t.noSubscription[locale]}</p>
            )}
          </Panel>
        </div>

        <div className="shrink-0">
          {invoices.length === 0 ? (
            <EmptyState title={t.noInvoicesTitle[locale]} description={t.noInvoicesBody[locale]} />
          ) : (
            <TableCard title={t.invoicesPanel[locale]}>
              <thead>
                <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                  <th className="px-5 py-3 font-medium">{t.numberHeader[locale]}</th>
                  <th className="px-5 py-3 font-medium">{t.periodHeader[locale]}</th>
                  <th className="px-5 py-3 font-medium">{t.dueHeader[locale]}</th>
                  <th className="px-5 py-3 text-right font-medium">{t.totalHeader[locale]}</th>
                  <th className="px-5 py-3 font-medium">{t.statusHeader[locale]}</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">{t.downloadPdf[locale]}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => {
                  const status = displayStatus(row, now);
                  return (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-mono text-ink">{row.number}</td>
                      <td className="px-5 py-3 text-ink-2">
                        {formatDate(row.period_start)} – {formatDate(row.period_end)}
                      </td>
                      <td className="px-5 py-3 text-ink-2">{formatDate(row.due_at)}</td>
                      <td className="u-tabular px-5 py-3 text-right text-ink">
                        {formatDkk(row.total_ore, locale)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(status)}>{localizeStatus(INVOICE_STATUS_LABEL, status, locale)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <a
                          href={`/api/invoices/${row.id}/pdf`}
                          className="text-[0.8125rem] font-medium text-accent underline-offset-2 hover:underline focus-visible:rounded-[var(--radius-xs)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          aria-label={`${t.downloadPdf[locale]} ${row.number}`}
                        >
                          {t.downloadPdf[locale]}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
