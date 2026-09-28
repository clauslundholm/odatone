import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { SideNav, type NavItem } from "@/components/admin/SideNav";
import { ThemeSegments } from "@/components/admin/ThemeSegments";
import { UserCard } from "@/components/admin/UserCard";
import { WorkspaceCard } from "@/components/admin/WorkspaceCard";
import { BoxGlyph, GridGlyph, ReceiptGlyph, ShieldGlyph, UsersGlyph } from "@/components/admin/icons";
import { STAFF_ROLE_LABEL, isStaffRole } from "@/lib/staff-invite";
import { createClient } from "@/lib/supabase/server";

/**
 * The whole /admin sidebar, resolved once instead of four times.
 *
 * Every admin screen mounts its own `AppShell` rather than sharing a
 * layout (see app/admin/layout.tsx for why), so each of them used to
 * repeat the same `NAV` array and the same `<SideNav … footer={<AdminSignOut/>}
 * />` call. That was tolerable while the frame was a wordmark and three
 * links; with an identity card, a live count and a theme control in it,
 * four copies would drift. Pages now pass only which row is active.
 *
 * English only, like the rest of /admin.
 */

export async function AdminSideNav({ activeHref }: { activeHref: string }) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : undefined;
  const email = typeof claims?.email === "string" ? claims.email : undefined;

  /* Both reads are best-effort: the sidebar is chrome, and a PostgREST
     hiccup should degrade it to a nameless card, not 500 a page whose own
     data loaded fine. proxy.ts has already established that this request
     belongs to a staff user before any of this runs. */
  const { data: profile, error: profileError } = userId
    ? await supabase.from("profiles").select("full_name, role").eq("id", userId).maybeSingle()
    : { data: null, error: null };
  if (profileError) console.error("[admin sidebar] failed to read profile", profileError);

  const { count: pendingCount, error: pendingError } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (pendingError) console.error("[admin sidebar] failed to count pending customers", pendingError);

  /* A profile reaching /admin at all has already been filtered to a staff
     role by proxy.ts's `mayEnter`, so anything else is a bug rather than a
     customer — shown as the literal value rather than guessed at. */
  const role = profile?.role;
  const roleLabel = isStaffRole(role) ? STAFF_ROLE_LABEL[role] : (role as string | undefined);

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: <GridGlyph className="h-[17px] w-[17px]" /> },
    {
      href: "/admin/customers",
      label: "Customers",
      icon: <UsersGlyph className="h-[17px] w-[17px]" />,
      badge: pendingCount ?? undefined,
      badgeLabel: `${pendingCount} pending signups`,
    },
    { href: "/admin/billing", label: "Billing", icon: <ReceiptGlyph className="h-[17px] w-[17px]" /> },
    { href: "/admin/products", label: "Products", icon: <BoxGlyph className="h-[17px] w-[17px]" /> },
    { href: "/admin/users", label: "Users", icon: <ShieldGlyph className="h-[17px] w-[17px]" /> },
  ];

  return (
    <SideNav
      items={nav}
      activeHref={activeHref}
      header={
        <WorkspaceCard
          name="Odatone"
          subtitle={roleLabel ? `Staff · ${roleLabel}` : "Staff"}
        />
      }
      theme={
        <ThemeSegments
          labels={{ group: "Theme", light: "Light", system: "System", dark: "Dark" }}
        />
      }
      footer={
        <UserCard
          name={profile?.full_name || email || "Signed in"}
          email={profile?.full_name ? email : undefined}
          menuLabel="Account menu"
        >
          <AdminSignOut />
        </UserCard>
      }
    />
  );
}
