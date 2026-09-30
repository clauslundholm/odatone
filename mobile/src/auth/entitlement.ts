/* Who may press play. Pure, no React Native and no Supabase, so the rule
   the whole app hangs on runs under plain `node --test`. */

export type Role = "owner" | "manager" | "staff_admin" | "staff_support";

/** The columns of `subscriptions` the app reads. */
export type Subscription = {
  plan_id: string;
  billing: "monthly" | "annual";
  status: string;
  created_at: string;
};

/** What row-level security lets a signed-in user read about themselves. */
export type Account = {
  profile: { role: Role; full_name: string | null; customer_id: string | null };
  /** null for staff, who belong to no customer. */
  customer: { id: string; name: string; billing_email: string; status: string } | null;
  subscription: Subscription | null;
};

/** `pending` is on the list on purpose: a signup creates a pending
    subscription, and the website promises the trial starts at once, not
    when staff get round to approving it. */
export const PLAYABLE_STATUSES: readonly string[] = ["pending", "trialing", "active", "past_due"];

const EARNING: readonly string[] = ["active", "trialing", "past_due"];
const STAFF: readonly string[] = ["staff_admin", "staff_support"];

/** Which subscription counts when a customer has several. The same rule
    as the website's latestSubscription (lib/admin/customers.ts): the
    newest earning one, or failing that the newest of any status. Copied
    rather than imported because that module pulls in the admin's stats
    and pricing; keep the two in step. */
export function latestSubscription<T extends { created_at: string; status: string }>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  const earning = subs.filter((s) => EARNING.includes(s.status));
  const pool = earning.length > 0 ? earning : subs;
  return pool.reduce((latest, s) => (Date.parse(s.created_at) > Date.parse(latest.created_at) ? s : latest));
}

export function accountEntitled(account: Account | null): boolean {
  if (!account) return false;
  if (STAFF.includes(account.profile.role)) return true;
  return account.subscription !== null && PLAYABLE_STATUSES.includes(account.subscription.status);
}

/** `loaded` with a null account is a signed-in user with no profile row —
    a real answer ("no access"), not a failure to read. `unavailable` is
    the failure: offline, or the request errored, or it has not come back
    yet. */
export type AccountState =
  | { kind: "signed-out" }
  | { kind: "loaded"; account: Account | null }
  | { kind: "unavailable" };

/** The last answer the server gave, kept on the device. */
export type CachedEntitlement = { userId: string; entitled: boolean; at: number };

/** A shop with poor signal keeps its music for a week; a lapsed account
    does not keep it forever. */
export const OFFLINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** How far into the future a cache stamp may sit and still be believed.
    Phone clocks get corrected by a few seconds all the time; a stamp a
    day ahead means the clock was moved. */
const CLOCK_DRIFT_MS = 5 * 60 * 1000;

export function parseCache(raw: string | null): CachedEntitlement | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { userId, entitled, at } = v as Record<string, unknown>;
    if (typeof userId !== "string" || typeof entitled !== "boolean" || typeof at !== "number") return null;
    return { userId, entitled, at };
  } catch {
    return null;
  }
}

export function resolveEntitled(
  state: AccountState,
  cache: CachedEntitlement | null,
  userId: string | null,
  now: number,
): boolean {
  if (state.kind === "signed-out" || userId === null) return false;
  if (state.kind === "loaded") return accountEntitled(state.account);
  if (!cache || cache.userId !== userId || !cache.entitled) return false;
  const age = now - cache.at;
  /* A negative age is a stamp from the future. Without the lower bound,
     setting the phone's clock back a year would make a week-old yes
     look new for a year. */
  return age >= -CLOCK_DRIFT_MS && age <= OFFLINE_WINDOW_MS;
}

export type Gate = "login" | "ended";

/** What to tell someone who pressed play and may not. */
export function gateFor(signedIn: boolean): Gate {
  return signedIn ? "ended" : "login";
}
