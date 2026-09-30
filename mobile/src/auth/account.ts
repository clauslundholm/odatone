import { latestSubscription, type Account, type Subscription } from "./entitlement.ts";
import { supabase } from "./supabase";

export type AccountResult = { ok: true; account: Account | null } | { ok: false };

/** The longest an account read may take. Nothing else puts a limit on
    it: fetch has no timeout of its own, and on a network that accepts a
    connection and then says nothing a request never comes back. */
export const ACCOUNT_READ_TIMEOUT_MS = 15000;

async function hasSessionFor(userId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id === userId;
}

/** Reads what the signed-in user is allowed to see about themselves.
    Row-level security does the filtering; the `.eq()` calls below only
    say which of the visible rows is wanted.

    `{ ok: true, account: null }` is a user with no profile row — signed
    in, but never set up as a customer or as staff. `{ ok: false }` is a
    request that failed, or one that took longer than
    ACCOUNT_READ_TIMEOUT_MS, which the caller must not mistake for that. */
export async function fetchAccount(userId: string): Promise<AccountResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  /* The abort ends the requests to the database. The race is for the
     session checks in between, which take no signal and can themselves
     sit in a token refresh. */
  const timeout = new Promise<AccountResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false });
    }, ACCOUNT_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([readAccount(userId, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Never rejects. Every request carries `signal`; an aborted one comes
    back as an error like any other failure. */
async function readAccount(userId: string, signal: AbortSignal): Promise<AccountResult> {
  try {
    /* Without a live session for this user supabase-js sends the anon key
       and row-level security answers with zero rows and no error, which
       would read as "no profile". Only believe an answer that was asked
       as the user. */
    if (!(await hasSessionFor(userId))) return { ok: false };
    const profile = await supabase
      .from("profiles")
      .select("role, full_name, customer_id")
      .eq("id", userId)
      .abortSignal(signal)
      .maybeSingle();
    if (profile.error) return { ok: false };
    if (!profile.data) return (await hasSessionFor(userId)) ? { ok: true, account: null } : { ok: false };

    const p = profile.data as Account["profile"];
    if (!p.customer_id) return { ok: true, account: { profile: p, customer: null, subscription: null } };

    const [customer, subscriptions] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, billing_email, status")
        .eq("id", p.customer_id)
        .abortSignal(signal)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan_id, billing, status, created_at")
        .eq("customer_id", p.customer_id)
        .abortSignal(signal),
    ]);
    if (customer.error || subscriptions.error) return { ok: false };

    /* The session can go between reads; RLS would then answer with empty
       rows and no error. */
    if (!(await hasSessionFor(userId))) return { ok: false };

    return {
      ok: true,
      account: {
        profile: p,
        customer: (customer.data as Account["customer"]) ?? null,
        subscription: latestSubscription((subscriptions.data ?? []) as Subscription[]),
      },
    };
  } catch {
    return { ok: false };
  }
}
