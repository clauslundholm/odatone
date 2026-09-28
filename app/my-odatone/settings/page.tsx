import { notFound } from "next/navigation";

import { SlidersGlyph } from "@/components/admin/icons";
import { TopBar } from "@/components/admin/TopBar";
import { PortalShell } from "@/components/portal/PortalShell";
import { portal, portalRoleLabel } from "@/lib/content/portal";
import { getPortalLocale } from "@/lib/portal-locale";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

type ProfileRow = { customer_id: string | null; role: string | null };

type CustomerRow = {
  name: string;
  billing_email: string;
  cvr: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  phone: string | null;
  updated_at: string;
};

/**
 * `/my-odatone/settings` (Task 11): the signed-in customer's own billing
 * details — everything `updateBillingDetails` (./actions.ts) writes, plus
 * the company name, read-only, with a line saying already-issued invoices
 * are what fix that name and changing it is a conversation with Odatone
 * rather than a form field here.
 *
 * Every read below goes through the session-bound client and is scoped by
 * RLS alone (`customers_read`, `profiles_read_own` —
 * supabase/migrations/0003_tenancy.sql), the same discipline
 * app/my-odatone/billing/page.tsx documents at length: no `customer_id` of
 * this page's own construction appears in either query, so there is
 * nothing here that could misscope a read even by mistake. `customers_read`
 * grants a `manager` the same read as an `owner` — only the *write*
 * (`customers_owner_update`) is owner-only — so a manager still sees their
 * real billing details on this page, just disabled, rather than a blank or
 * missing form.
 *
 * `canEdit` decides only what the UI shows. It is not the control: a
 * manager who re-enables these fields from devtools, or posts the form
 * directly with no UI in front of it at all, is refused by
 * `updateBillingDetails` itself, under `customers_owner_update` — see that
 * action's own comment on `.select("id")` for how RLS's zero-row refusal is
 * told apart from a real save.
 */
export default async function PortalSettingsPage() {
  const locale = await getPortalLocale();
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  // proxy.ts already denies any request here with no verified session —
  // guarded anyway rather than trusting that invariant a second time, the
  // same defensive posture every other /my-odatone page takes.
  if (!userId) notFound();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("customer_id, role")
    .eq("id", userId)
    .single();

  if (profileError) console.error("[my-odatone settings] failed to read profile", profileError);
  const profile = profileRow as ProfileRow | null;
  // A customer-role profile always has a customer_id (profiles_tenancy_ck,
  // 0001_core.sql) — proxy.ts's mayEnter already required a customer role
  // to reach this route. Still checked explicitly, never assumed, matching
  // every other /my-odatone page's own guard.
  if (!profile?.customer_id) notFound();

  const { data: customerRow, error: customerError } = await supabase
    .from("customers")
    .select("name, billing_email, cvr, address, postcode, city, phone, updated_at")
    .maybeSingle();

  if (customerError) console.error("[my-odatone settings] failed to read customer", customerError);
  if (!customerRow) notFound();
  const customer = customerRow as CustomerRow;

  const t = portal.settings;
  const roleLabel = portalRoleLabel(profile.role, locale);
  const canEdit = profile.role === "owner";

  return (
    <PortalShell
      locale={locale}
      activeHref="/my-odatone/settings"
      customerName={customer.name}
      roleLabel={roleLabel}
    >
      <TopBar crumbs={[t.crumb[locale]]} icon={<SlidersGlyph />} breadcrumbLabel={portal.shell.ariaBreadcrumb[locale]} />
      <div className="flex flex-1 flex-col overflow-auto p-5">
        {/* Not keyed on anything that changes across a save (an earlier
            draft keyed this on `customer.updated_at` to force a remount
            with fresh `defaultValue`s): `updateBillingDetails`'s own
            `revalidatePath` re-renders this Server Component in the same
            response that carries the action's `{ ok: true }` back to
            `useActionState`, so a key change lands in that same commit and
            remounts SettingsForm before its "saved" message — read from
            that very return value — ever has a render to appear in.
            Confirmed live: with the key, the success line never showed.
            Without one, the component survives the re-render, and its
            inputs stay showing exactly what the visitor just typed — which
            is, on a successful save, exactly what the server now holds. */}
        <SettingsForm
          locale={locale}
          canEdit={canEdit}
          companyName={customer.name}
          initial={{
            billingEmail: customer.billing_email,
            cvr: customer.cvr ?? "",
            address: customer.address ?? "",
            postcode: customer.postcode ?? "",
            city: customer.city ?? "",
            phone: customer.phone ?? "",
          }}
        />
      </div>
    </PortalShell>
  );
}
