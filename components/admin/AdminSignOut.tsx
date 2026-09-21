import { signOut } from "@/app/admin/login/actions";

/**
 * Sign-out for /admin, rendered as an item inside `UserCard`'s overflow
 * menu at the bottom of the sidebar.
 *
 * signOut (app/admin/login/actions.ts) had zero callers before this
 * existed: the customer portal wired up its own equivalent, but no /admin
 * page ever rendered one, so a staff member on a shared machine had no way
 * to end their session short of clearing cookies by hand.
 *
 * It stays a separate component from AdminSideNav so the server action
 * stays on the server — UserCard is a client component, and this arrives
 * there as already-rendered `children` rather than as an imported action.
 */
export function AdminSignOut() {
  return (
    <form>
      <button
        formAction={signOut}
        role="menuitem"
        className="w-full rounded-[7px] px-2.5 py-2 text-left text-[0.875rem] font-medium leading-[1.3] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
