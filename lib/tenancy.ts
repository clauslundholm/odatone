export type Role = "owner" | "manager" | "staff_admin" | "staff_support";

const ROLES: readonly Role[] = ["owner", "manager", "staff_admin", "staff_support"];
const STAFF: Role[] = ["staff_admin", "staff_support"];

export const isStaffRole = (role: Role): boolean => STAFF.includes(role);
export const isCustomerRole = (role: Role): boolean => !isStaffRole(role);
export const landingFor = (role: Role): string => (isStaffRole(role) ? "/admin" : "/my-odatone");

/** Narrows an untrusted value (a column read straight off `profiles.role`)
    to a known Role, or undefined. A widening of the `user_role` enum later
    — a fifth value the app doesn't know about yet — must not be silently
    accepted as "not staff" and admitted to /my-odatone as a customer; an
    unrecognised value is simply not a role. */
export const parseRole = (value: unknown): Role | undefined =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : undefined;

export type PortalName = "admin" | "portal";

const ADMIN = "/admin";
const PORTAL = "/my-odatone";

/* Segment-boundary match, not startsWith: "/administrators" must not match
   "/admin", and "/admin/login-secrets" must not match "/admin/login". Every
   comparison here is case-insensitive because the proxy matcher and these
   prefixes are all case-sensitive by default while some filesystems (and
   some caches) are not — a case mismatch must never be the difference
   between gated and public. */
const hasSegment = (path: string, prefix: string): boolean => {
  const p = path.toLowerCase();
  const base = prefix.toLowerCase();
  return p === base || p.startsWith(`${base}/`);
};

/** Which portal a request path belongs to, or null if it belongs to
    neither (e.g. a marketing page, or a look-alike like /administrators).
    Only /admin and /my-odatone are guarded; everything else is nobody's
    business here. */
export const portalFor = (path: string): PortalName | null => {
  if (hasSegment(path, ADMIN)) return "admin";
  if (hasSegment(path, PORTAL)) return "portal";
  return null;
};

/** The single source of truth for each portal's login route. Exported so
    lib/supabase/proxy.ts builds its redirect from the same values
    isPublicPath checks against — two independent copies could drift, and a
    proxy that redirects to a path the gate itself does not consider public
    is an infinite redirect loop.

    Each portal's login IS its root: /admin signed out is the sign-in form,
    /admin signed in is the dashboard. There is no /login segment. */
export const LOGIN_PATH: Record<PortalName, string> = {
  admin: ADMIN,
  portal: PORTAL,
};

/** The pre-root-login URLs, kept reachable because invite and recovery
    links already in people's inboxes point at them. They redirect to the
    root, and a redirect the gate would block is a dead link. */
const LEGACY_LOGIN_PATH: Record<PortalName, string> = {
  admin: `${ADMIN}/login`,
  portal: `${PORTAL}/login`,
};

/** Which paths a visitor with no session may reach.
 *
 *  Exactly two per portal: the root, which renders the sign-in form when
 *  signed out, and the old `/login` URL, which redirects to it.
 *
 *  The root is matched EXACTLY, never as a prefix. `hasSegment` — the rule
 *  the old login path used — would return true for everything beneath it,
 *  so reusing it here would make `/admin/billing`, `/admin/users` and every
 *  other screen public the moment login moved to the root. That is the one
 *  way this change could go catastrophically wrong, and it is why
 *  `test/tenancy.test.ts` asserts each child route is still gated.
 *
 *  The legacy `/login` paths keep `hasSegment`, so a nested step such as
 *  `/admin/login/reset` stays reachable — while `/admin/login-secrets` and
 *  `/admin/loginsecret` do not, which is the regression that rule exists to
 *  prevent. */
export const isPublicPath = (path: string): boolean => {
  const portal = portalFor(path);
  if (portal === null) return false;
  const p = path.toLowerCase().replace(/\/+$/, "");
  return p === LOGIN_PATH[portal].toLowerCase() || hasSegment(path, LEGACY_LOGIN_PATH[portal]);
};

/** Whether `role` may enter the portal that owns `path`. A path outside
    both portals is nobody's to deny, so it returns true; an unrecognised
    or absent role is always denied on a guarded path — there is no
    "default open" here, unlike a missing Supabase configuration used to
    be. */
export const mayEnter = (path: string, role: Role | undefined): boolean => {
  const portal = portalFor(path);
  if (!portal) return true;
  if (!role) return false;
  return portal === "admin" ? isStaffRole(role) : isCustomerRole(role);
};
