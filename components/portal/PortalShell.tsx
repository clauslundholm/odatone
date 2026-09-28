import type { ReactNode } from "react";

import { AppShell } from "@/components/admin/AppShell";
import { SideNav, type NavItem } from "@/components/admin/SideNav";
import { ThemeSegments } from "@/components/admin/ThemeSegments";
import { UserCard } from "@/components/admin/UserCard";
import { WorkspaceCard } from "@/components/admin/WorkspaceCard";
import { HouseGlyph, ReceiptGlyph } from "@/components/admin/icons";
import { LocaleSwitch } from "@/components/portal/LocaleSwitch";
import { signOut } from "@/app/my-odatone/portal-actions";
import type { Locale } from "@/lib/i18n";
import { portal } from "@/lib/content/portal";
import { createClient } from "@/lib/supabase/server";

/**
 * The whole /my-odatone sidebar, resolved once instead of once per page —
 * the same problem components/admin/AdminSideNav.tsx already solved for
 * /admin, copied here for Task 10 once a second portal page (`billing`)
 * needed the exact same chrome the summary page had, until now, built
 * inline. Wraps `AppShell` + `SideNav` and everything SideNav's own
 * `header`/`theme`/`footer` slots hold: the company identity card, the
 * language and theme controls, and the signed-in account card with its
 * sign-out action. A page passes only `children` (its own `TopBar` and
 * content) and which row is active.
 *
 * Unlike AdminSideNav, this does not resolve every piece of chrome data
 * itself. It reads its own session identity — `full_name`/email, for the
 * account card at the foot — the same way AdminSideNav reads a staff
 * profile: nobody outside this component needs "who is signed in", so
 * nobody outside it should have to fetch it. `customerName` and
 * `roleLabel`, by contrast, arrive as props: both come from rows
 * (`customers`, the caller's own `profiles.role`) that every page mounting
 * this shell already reads for its own body content or its own RLS-scoped
 * queries, so resolving them a second time in here would just be a second
 * round trip for a fact the caller already has in hand. `roleLabel` is
 * pre-localised by the caller (via `portalRoleLabel`,
 * lib/content/portal.ts) rather than passed as a bare role, since every
 * page that computes it needs `locale` for its own content anyway.
 *
 * The nav list itself — Summary, Billing — is built here, not passed in,
 * for the same reason AdminSideNav's own `NAV` array lives inside it
 * rather than in each admin page: the moment a second page exists, "which
 * rows does the sidebar have" is shell state, not per-page state, and a
 * third page (settings, statistics — summary's own "coming soon" line)
 * only ever has to add one line here.
 */
export async function PortalShell({
  locale,
  activeHref,
  customerName,
  roleLabel,
  children,
}: {
  locale: Locale;
  activeHref: string;
  /** The signed-in customer's own company name — WorkspaceCard's title. */
  customerName: string;
  /** WorkspaceCard's subtitle, already localised by the caller. `undefined`
      for a role this shell doesn't recognise, which it shows as no
      subtitle at all rather than guessing. */
  roleLabel?: string;
  children: ReactNode;
}) {
  const t = portal.shell;
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : undefined;
  const email = typeof claims?.email === "string" ? claims.email : undefined;

  /* Best-effort, exactly as AdminSideNav's own read is: the sidebar is
     chrome, and a PostgREST hiccup should degrade the account card to a
     nameless one, not 500 a page whose own data loaded fine. proxy.ts has
     already established that this request belongs to a signed-in customer
     before any of this runs. */
  const { data: profile, error: profileError } = userId
    ? await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()
    : { data: null, error: null };
  if (profileError) console.error("[portal shell] failed to read profile", profileError);

  const nav: NavItem[] = [
    { href: "/my-odatone", label: portal.summary.crumb[locale], icon: <HouseGlyph className="h-[17px] w-[17px]" /> },
    {
      href: "/my-odatone/billing",
      label: portal.billing.crumb[locale],
      icon: <ReceiptGlyph className="h-[17px] w-[17px]" />,
    },
  ];

  return (
    <AppShell
      menuLabel={t.ariaOpenMenu[locale]}
      menuDialogLabel={t.ariaMenu[locale]}
      nav={
        <SideNav
          items={nav}
          activeHref={activeHref}
          navLabel={t.ariaNav[locale]}
          header={<WorkspaceCard name={customerName} subtitle={roleLabel} />}
          theme={
            <div className="flex flex-col gap-0.5">
              {/* Language sits beside theme rather than inside the account
                  menu: it is the one control a visitor may need *before*
                  they can read the menu that would otherwise hide it. */}
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="text-[0.6875rem] text-ink-3">{t.languageGroup[locale]}</span>
                <LocaleSwitch locale={locale} />
              </div>
              <ThemeSegments
                labels={{
                  group: t.themeGroup[locale],
                  light: t.themeLight[locale],
                  system: t.themeSystem[locale],
                  dark: t.themeDark[locale],
                }}
              />
            </div>
          }
          footer={
            <UserCard
              name={profile?.full_name || email || t.signedIn[locale]}
              email={profile?.full_name ? email : undefined}
              menuLabel={t.ariaUserMenu[locale]}
            >
              <form>
                <button
                  formAction={signOut}
                  role="menuitem"
                  className="w-full rounded-[7px] px-2.5 py-2 text-left text-[0.875rem] font-medium leading-[1.3] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {t.signOut[locale]}
                </button>
              </form>
            </UserCard>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
