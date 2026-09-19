import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { AppShell } from "@/components/admin/AppShell";
import { TopBar } from "@/components/admin/TopBar";
import { PlanCard, AddonCard } from "@/components/admin/ProductsForm";
import type { PlanRow } from "@/lib/plans-row";
import { createClient } from "@/lib/supabase/server";

type AddonRow = {
  id: string;
  name: { da: string; en: string };
  monthly_ore: number;
  active: boolean;
};

/**
 * Task 12: the one screen that lets a price change reach odatone.com
 * without a deploy. Every plan and the one add-on, active or not — the
 * same "every row, not just activePlans()'s active subset" rule the
 * dashboard and customer pages follow (app/admin/page.tsx's doc comment),
 * because a deactivated plan is still something staff need to be able to
 * re-price or reactivate here.
 *
 * Saving is `updatePlan`/`updateAddon` (./actions.ts). Neither checks the
 * signed-in role: `plans_admin_write`/`addons_admin_write`
 * (supabase/migrations/0003_tenancy.sql) restrict the write to
 * staff_admin, and this page relies on that being the one and only
 * definition of who may change a price — see actions.ts's own comment.
 * A staff_support account can open this page (proxy.ts's `mayEnter` admits
 * any staff role into /admin) and submit the form, but the row is excluded
 * from the UPDATE's affected set by `plans_admin_write`'s `using` clause —
 * Postgres does not raise an error for that, it simply matches zero rows —
 * so the action tells a refusal apart from success with `.select("id")`
 * and an empty result, and the card shows "Only staff_admin can save
 * this," not a UI-level guess at who's allowed.
 */
export default async function AdminProductsPage() {
  const supabase = await createClient();

  const [{ data: planRows, error: planError }, { data: addonRows, error: addonError }] =
    await Promise.all([
      supabase
        .from("plans")
        .select("id, name, monthly_ore, max_m2, tagline, features, active")
        .order("sort", { ascending: true }),
      supabase.from("addons").select("id, name, monthly_ore, active"),
    ]);

  for (const [label, error] of [
    ["plans", planError],
    ["addons", addonError],
  ] as const) {
    if (error) console.error(`[admin products] failed to read ${label}`, error);
  }

  const plans = (planRows ?? []) as (PlanRow & { active: boolean })[];
  const addons = (addonRows ?? []) as AddonRow[];

  return (
    <AppShell nav={<AdminSideNav activeHref="/admin/products" />}>
      <TopBar crumbs={["Admin", "Products"]} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-5">
        <p className="rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-[0.875rem] text-ink-2">
          These prices are live on odatone.com.
        </p>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        {addons.length > 0 && (
          <>
            <h2 className="mt-2 text-[0.9375rem] font-medium text-ink">Add-ons</h2>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {addons.map((addon) => (
                <AddonCard key={addon.id} addon={addon} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
