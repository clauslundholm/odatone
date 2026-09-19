import { initials } from "@/lib/initials";

/**
 * The identity card at the top of the sidebar, under the wordmark: a
 * monogram tile, the name of whatever this session is scoped to, and a
 * line of context beneath it. In /admin that scope is Odatone itself; in
 * /my-odatone it is the customer's own company.
 *
 * Deliberately not a control. The design this came from puts a chevron
 * here and opens a workspace switcher, but neither of Odatone's two
 * audiences has a second workspace to switch to — staff see one Odatone,
 * and a customer login is bound to exactly one customer by
 * `profiles.customer_id` (0001_core.sql) with RLS enforcing it. A chevron
 * would promise a menu that could only ever hold the row you are already
 * on. If multi-customer logins ever arrive, this is the component that
 * grows the trigger.
 */
export function WorkspaceCard({
  name,
  subtitle,
}: {
  name: string;
  /** The line under the name — a role, a plan, or both joined by " · ". */
  subtitle?: string;
}) {
  const monogram = initials(name);

  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-xs)] text-[0.75rem] font-semibold tracking-[0.02em] text-white"
        style={{ backgroundImage: "var(--g-brand)" }}
      >
        {monogram}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[0.8125rem] font-medium leading-tight text-ink">{name}</span>
        {subtitle && (
          <span className="truncate text-[0.6875rem] leading-tight text-ink-3">{subtitle}</span>
        )}
      </span>
    </div>
  );
}
