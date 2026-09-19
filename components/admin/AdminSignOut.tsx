import { signOut } from "@/app/admin/login/actions";

/**
 * Shared sign-out control for every /admin page's SideNav footer slot.
 *
 * signOut (app/admin/login/actions.ts) existed with zero callers before
 * this: SideNav (components/admin/SideNav.tsx) already accepts a `footer`
 * slot for exactly this purpose -- the customer portal's own
 * app/my-odatone/page.tsx already wires an equivalent button through it --
 * but no /admin page ever passed one, so a staff member on a shared
 * machine had no way to end their session short of clearing cookies by
 * hand. Every /admin page renders its own AppShell/SideNav rather than
 * sharing one layout component, so this is a small shared piece rather
 * than the same button copied four times.
 */
export function AdminSignOut() {
  return (
    <form>
      <button
        formAction={signOut}
        className="u-label w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-ink-2 transition-colors hover:bg-surface-2/60 hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
