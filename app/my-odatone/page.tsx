import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/admin/AppShell";
import { Badge, statusTone } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { Meter } from "@/components/admin/Meter";
import { SideNav, type NavItem } from "@/components/admin/SideNav";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { LocaleSwitch } from "@/components/portal/LocaleSwitch";
import { fetchAllRows } from "@/lib/admin/paginate";
import { planMap, resolvePlan } from "@/lib/admin/plans";
import { latestSubscription, locationFit } from "@/lib/admin/customers";
import { HTML_LANG } from "@/lib/i18n";
import { CUSTOMER_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL, localizeStatus, portal } from "@/lib/content/portal";
import { formatDkk, toOre } from "@/lib/money";
import { quote, type Billing, type Plan } from "@/lib/pricing";
import type { PlanRow } from "@/lib/plans-row";
import { getPortalLocale } from "@/lib/portal-locale";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./portal-actions";

type ProfileRow = { customer_id: string | null; full_name: string | null };

type CustomerDetail = {
  id: string;
  name: string;
  status: string;
  created_at: string;
};

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  venue_type: string;
  m2: number;
};

type SubscriptionRow = {
  plan_id: string;
  billing: string;
  status: string;
  created_at: string;
};

/** Mirrors app/admin/customers/[id]/page.tsx's own local Panel — same
    bordered-card shell, kept local to each page rather than shared, since
    that page's own doc comment already explains why: nothing outside a
    single page needs it. */
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
 * The customer portal's front door (Task 14): company, current plan and
 * what it includes, subscription status, and locations with the same
 * Meter /admin uses. Nothing on this page is editable — billing,
 * settings and statistics are a later slice (the honest line at the
 * foot says so directly), and this exists only so Task 13's invite has
 * somewhere real to land instead of a 404.
 *
 * Every read here goes through the session-bound client
 * (lib/supabase/server.ts), never the service role — RLS
 * (supabase/migrations/0003_tenancy.sql) is what actually keeps one
 * customer from ever seeing another's row, for this page exactly as for
 * the pgTAP suite, and that boundary is only real if nothing here ever
 * reaches for elevated access to route around it.
 *
 * `plans` is read in full — active or not — through that same
 * session-bound client, the same discipline
 * app/admin/customers/[id]/page.tsx documents at length: quote()'s
 * bare-PlanId branch resolves against the *compiled* PLANS array and
 * ignores the database, so a customer still paying for a plan staff have
 * since deactivated must be priced from an already-resolved `Plan`
 * object, not an id. 0009_customer_plan_visibility.sql is what makes
 * that plan visible to this exact session in the first place — RLS's
 * default plans_public_read only shows active plans to a non-staff
 * session.
 */
export default async function PortalSummaryPage() {
  const locale = await getPortalLocale();
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  // proxy.ts (lib/supabase/proxy.ts) already denies any request here with
  // no verified session, so this should be unreachable in practice —
  // guarded anyway rather than trusting that invariant a second time.
  if (!userId) notFound();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("customer_id, full_name")
    .eq("id", userId)
    .single();

  if (profileError) console.error("[my-odatone summary] failed to read profile", profileError);
  const profile = profileRow as ProfileRow | null;
  // A customer-role profile always has a customer_id (profiles_tenancy_ck,
  // 0001_core.sql) — proxy.ts's mayEnter already required a customer role
  // to reach this route. Still checked explicitly, never assumed.
  if (!profile?.customer_id) notFound();

  const customerId = profile.customer_id;

  const [
    { data: customer, error: customerError },
    locationsResult,
    { data: subscriptionRows, error: subscriptionError },
    { data: planRows, error: planError },
  ] = await Promise.all([
    supabase.from("customers").select("id, name, status, created_at").eq("id", customerId).maybeSingle(),
    fetchAllRows<LocationRow>(
      (from, to) =>
        supabase
          .from("locations")
          .select("id, name, city, venue_type, m2", { count: "exact" })
          .eq("customer_id", customerId)
          .order("id", { ascending: true })
          .range(from, to),
      "my-odatone summary: locations",
    ),
    supabase
      .from("subscriptions")
      .select("plan_id, billing, status, created_at")
      .eq("customer_id", customerId),
    supabase.from("plans").select("id, name, monthly_ore, max_m2, tagline, features"),
  ]);

  for (const [label, error] of [
    ["customer", customerError],
    ["locations", locationsResult.error],
    ["subscriptions", subscriptionError],
    ["plans", planError],
  ] as const) {
    if (error) console.error(`[my-odatone summary] failed to read ${label}`, error);
  }

  if (!customer) notFound();

  const detail = customer as CustomerDetail;
  const locations = locationsResult.rows;

  const planById = planMap((planRows ?? []) as PlanRow[]);
  const subscription = latestSubscription((subscriptionRows ?? []) as SubscriptionRow[]);
  const plan: Plan | null = subscription
    ? resolvePlan(subscription.plan_id, planById, "my-odatone summary")
    : null;

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(HTML_LANG[locale], { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );

  const t = portal.summary;
  const nav: NavItem[] = [{ href: "/my-odatone", label: t.crumb[locale] }];

  return (
    <AppShell
      nav={
        <SideNav
          items={nav}
          activeHref="/my-odatone"
          footer={
            <div className="flex flex-col gap-3">
              <LocaleSwitch locale={locale} />
              <form>
                <button
                  formAction={signOut}
                  className="u-label w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-ink-2 transition-colors hover:bg-surface-2/60 hover:text-ink"
                >
                  {t.signOut[locale]}
                </button>
              </form>
            </div>
          }
        />
      }
    >
      <TopBar crumbs={[t.crumb[locale]]} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-5">
        {profile.full_name && (
          <p className="shrink-0 text-[0.9375rem] text-ink-2">
            {t.greeting[locale]} <span className="font-medium text-ink">{profile.full_name}</span>
          </p>
        )}

        <div className="grid shrink-0 grid-cols-2 gap-4 max-[900px]:grid-cols-1">
          <Panel title={t.companyPanel[locale]}>
            <dl className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
              <Field label={t.companyLabel[locale]} value={detail.name} />
              <Field
                label={t.statusLabel[locale]}
                value={
                  <Badge tone={statusTone(detail.status)}>
                    {localizeStatus(CUSTOMER_STATUS_LABEL, detail.status, locale)}
                  </Badge>
                }
              />
              <Field label={t.customerSinceLabel[locale]} value={formatDate(detail.created_at)} />
            </dl>
          </Panel>

          <Panel title={t.planPanel[locale]}>
            {subscription && plan ? (
              (() => {
                const q = quote(plan, subscription.billing as Billing, locations.length);
                return (
                  <div className="flex flex-col gap-4">
                    <dl className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
                      <Field label={t.planLabel[locale]} value={plan.name} />
                      <Field
                        label={t.billingLabel[locale]}
                        value={
                          subscription.billing === "annual"
                            ? t.billingAnnual[locale]
                            : t.billingMonthly[locale]
                        }
                      />
                      <Field
                        label={t.statusLabel[locale]}
                        value={
                          <Badge tone={statusTone(subscription.status)}>
                            {localizeStatus(SUBSCRIPTION_STATUS_LABEL, subscription.status, locale)}
                          </Badge>
                        }
                      />
                      <Field
                        label={t.priceLabel[locale]}
                        value={<span className="u-tabular">{formatDkk(toOre(q.monthlyExVat), locale)}</span>}
                      />
                    </dl>
                    {plan.features.length > 0 && (
                      <div className="flex flex-col gap-1.5 border-t border-line pt-4">
                        <span className="u-label text-ink-2">{t.includesLabel[locale]}</span>
                        <ul className="flex flex-col gap-1 text-[0.875rem] text-ink">
                          {plan.features.map((feature) => (
                            <li key={feature[locale]} className="flex items-baseline gap-2">
                              <span aria-hidden="true" className="text-ink-3">
                                –
                              </span>
                              {feature[locale]}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className="text-[0.875rem] text-ink-2">{t.noSubscription[locale]}</p>
            )}
          </Panel>
        </div>

        <div className="shrink-0">
          {locations.length === 0 ? (
            <EmptyState title={t.noLocationsTitle[locale]} description={t.noLocationsBody[locale]} />
          ) : (
            <TableCard title={t.locationsPanel[locale]}>
              <thead>
                <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                  <th className="px-5 py-3 font-medium">{t.locationName[locale]}</th>
                  <th className="px-5 py-3 font-medium">{t.locationType[locale]}</th>
                  <th className="px-5 py-3 font-medium">{t.locationCity[locale]}</th>
                  <th className="px-5 py-3 font-medium">{t.locationFit[locale]}</th>
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
                          {fit === "over" && <Badge tone="warn">{t.locationOver[locale]}</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </div>

        <p className="shrink-0 text-[0.8125rem] text-ink-2">{t.comingSoon[locale]}</p>
      </div>
    </AppShell>
  );
}
