import type { Metadata } from "next";

import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { AppShell } from "@/components/admin/AppShell";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { InviteStaffForm } from "@/components/admin/InviteStaffForm";
import { TableCard } from "@/components/admin/TableCard";
import { TopBar } from "@/components/admin/TopBar";
import { ShieldGlyph } from "@/components/admin/icons";
import { STAFF_ROLE_LABEL, isStaffRole } from "@/lib/staff-invite";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

type StaffRow = { id: string; full_name: string | null; role: string; created_at: string };

/* GoTrue's listUsers is paginated and has no "filter by id" — the whole
   directory has to be walked to turn ids into addresses. `profiles` has no
   email column of its own (auth.users owns it, and PostgREST cannot join
   across to it), so this is the only way to show one. Bounded rather than
   unbounded: Odatone staff is a handful of people, and a runaway loop
   against the auth server is a worse failure than a missing email. */
const EMAIL_PAGE_SIZE = 200;
const EMAIL_MAX_PAGES = 5;

async function emailsById(ids: Set<string>): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (ids.size === 0) return found;

  const admin = createAdminClient();
  for (let page = 1; page <= EMAIL_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: EMAIL_PAGE_SIZE });
    if (error) {
      console.error("[odatone] admin users: failed to list auth users", error);
      break;
    }
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email && ids.has(user.id)) found.set(user.id, user.email);
    }
    // Everyone we came for is accounted for, or the directory ran out.
    if (found.size === ids.size || users.length < EMAIL_PAGE_SIZE) break;
  }
  return found;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/**
 * Who at Odatone can get into /admin, and the one place to add someone.
 *
 * Staff are invited, never self-registered — this screen and
 * `inviteStaff` (actions.ts) are the only way a staff `profiles` row comes
 * into existence outside a direct database write.
 *
 * Reading the list is open to any staff member (profiles_read_own,
 * 0003_tenancy.sql, admits `is_staff()`); inviting is not. The form is
 * hidden from a `staff_support` member here, and refused by the action
 * regardless — the hiding is courtesy, the refusal is the control.
 */
export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : undefined;

  const { data: viewer } = viewerId
    ? await supabase.from("profiles").select("role").eq("id", viewerId).maybeSingle()
    : { data: null };
  const viewerIsAdmin = viewer?.role === "staff_admin";

  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .is("customer_id", null)
    .order("created_at", { ascending: true });

  if (error) console.error("[odatone] admin users: failed to read staff profiles", error);
  const staff = (rows ?? []) as StaffRow[];
  const emails = await emailsById(new Set(staff.map((s) => s.id)));

  return (
    <AppShell nav={<AdminSideNav activeHref="/admin/users" />}>
      <TopBar crumbs={["Admin", "Users"]} icon={<ShieldGlyph />} />
      <div className="flex flex-1 flex-col gap-6 overflow-auto p-5">
        {viewerIsAdmin && (
          <div className="rounded-[var(--radius-md)] border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[0.9375rem] font-medium text-ink">Invite a colleague</h2>
              <p className="mt-1 text-[0.8125rem] text-ink-2">
                They&rsquo;ll get an email with a link to choose their own password. Odatone never
                sees it.
              </p>
            </div>
            <div className="p-5">
              <InviteStaffForm />
            </div>
          </div>
        )}

        {staff.length === 0 ? (
          <EmptyState
            title="No staff yet"
            description="Nobody has an Odatone admin account. That should not be possible while you are reading this — check the database."
          />
        ) : (
          <TableCard title="Odatone staff">
            <thead>
              <tr className="border-b border-line text-[0.75rem] uppercase tracking-[0.04em] text-ink-2">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 text-ink">
                    {member.full_name ?? <span className="text-ink-3">—</span>}
                    {member.id === viewerId && <span className="ml-2 text-ink-3">(you)</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-2">
                    {emails.get(member.id) ?? <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={member.role === "staff_admin" ? "ok" : "neutral"}>
                      {isStaffRole(member.role) ? STAFF_ROLE_LABEL[member.role] : member.role}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{formatDate(member.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </AppShell>
  );
}
