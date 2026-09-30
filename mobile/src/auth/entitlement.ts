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
export type CachedEntitlement = {
  userId: string;
  entitled: boolean;
  at: number;
  /** For the account card when the phone is offline. Optional: entries
      written before it existed are still good. */
  email?: string;
};

/** What the app knows about the stored session. `unknown` is "could not
    find out" (the auth server did not answer), which is not the same as
    `absent`, "checked, and there is none". */
export type SessionState = "unknown" | "absent" | { userId: string };

/** Who the app treats as signed in. A live session wins; a confirmed
    absence is signed out; and when the auth server cannot be reached the
    last known user stands, so a shop opening the app with its wifi down
    keeps its music inside the offline window. */
export function effectiveUserId(session: SessionState, cache: CachedEntitlement | null): string | null {
  if (session === "absent") return null;
  if (session === "unknown") return cache?.userId ?? null;
  return session.userId;
}

/** Whether a screen may stop showing its splash. Waits for the stored
    cache; then needs either a settled answer about the session or a
    cached identity to go on. `settled` is true once getSession() has
    returned at all, whatever it returned, so a first-run phone with no
    cache and no network is not stuck. */
export function sessionReady(
  session: SessionState,
  cacheRead: boolean,
  cache: CachedEntitlement | null,
  settled: boolean,
): boolean {
  return cacheRead && (session !== "unknown" || cache !== null || settled);
}

/** How often an open app re-reads the account. Foreground and login also
    re-read it, but a counter tablet that is never backgrounded would
    otherwise never notice a cancelled subscription. */
export const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

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
    const { email } = v as Record<string, unknown>;
    if (email !== undefined && typeof email !== "string") return null;
    return email === undefined ? { userId, entitled, at } : { userId, entitled, at, email };
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

/** The state to use for this render. `state` is only updated from
    effects, so on the render where an identity first appears (from the
    cache, before the session is read) it can still say "signed-out";
    treating that as "not asked yet" keeps a cached yes from flashing to
    no for one commit. */
export function effectiveAccountState(state: AccountState, userId: string | null): AccountState {
  if (userId === null) return { kind: "signed-out" };
  return state.kind === "signed-out" ? { kind: "unavailable" } : state;
}

/** Whether the account can still be asked for. It needs a session to ask
    as, so: there is one, or the stored one has not been read yet
    (`settled` is false until getSession() has returned). Once that read
    has come back empty-handed — the auth server did not answer — nothing
    is on its way, and waiting for it would leave a play button that does
    nothing. */
export function canStillRead(session: SessionState, settled: boolean): boolean {
  if (session === "absent") return false;
  return session !== "unknown" || !settled;
}

/** The longest `checking` may last, counted from when the wait began. A
    token refresh against a dead network retries for about half a minute,
    and a request that hangs never comes back at all; a play button that
    does nothing for that long reads as a broken app. After this the app
    stops waiting and says it could not check. */
export const CHECK_WAIT_MS = 8000;

/** True while there is an identity, the app cannot yet say yes, and the
    server's answer may still be on its way: no read for this user has
    come back in this run (`settledFor`), one still can (`canRead`, see
    canStillRead), and the wait is younger than CHECK_WAIT_MS (`since` is
    when it began: when this identity appeared, or when the customer last
    asked again). A play gate must wait, not refuse — but not for ever:
    past the cap this is false, and with no answer the gate says it
    could not check. A read that lands later still decides.

    The cache only ever counts as a yes. A stale entry (the customer was
    away for more than the offline window) or a cached no (they have
    renewed since) is what the server said last time, not what it says
    now, and telling a paying customer their subscription is not active
    on the strength of it would be wrong. A valid cached yes is an
    answer: they play at once and nothing is waited for. */
export function isChecking(
  state: AccountState,
  cache: CachedEntitlement | null,
  userId: string | null,
  settledFor: string | null,
  canRead: boolean,
  now: number,
  since: number,
): boolean {
  if (userId === null || state.kind !== "unavailable") return false;
  if (settledFor === userId || !canRead) return false;
  if (now - since >= CHECK_WAIT_MS) return false;
  return !resolveEntitled(state, cache, userId, now);
}

/** True only when the server's answer for this user has been read. A
    "no" without it is "could not find out", which is not a fact about
    the account. */
export function accountKnown(state: AccountState): boolean {
  return state.kind === "loaded";
}

export type Gate = "login" | "ended" | "unknown";

/** What to tell someone who pressed play and may not: log in; or the
    subscription is not live (`ended`, only when the server said so); or
    the app could not check (`unknown`). */
export function gateFor(signedIn: boolean, known: boolean): Gate {
  if (!signedIn) return "login";
  return known ? "ended" : "unknown";
}
