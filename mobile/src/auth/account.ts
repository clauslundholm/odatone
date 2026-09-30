import { latestSubscription, type Account, type Subscription } from "./entitlement.ts";
import { supabase } from "./supabase";

export type AccountResult = { ok: true; account: Account | null } | { ok: false };

async function hasSessionFor(userId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id === userId;
}

/** Reads what the signed-in user is allowed to see about themselves.
    Row-level security does the filtering; the `.eq()` calls below only
    say which of the visible rows is wanted.

    `{ ok: true, account: null }` is a user with no profile row — signed
    in, but never set up as a customer or as staff. `{ ok: false }` is a
    request that failed, which the caller must not mistake for that. */
export async function fetchAccount(userId: string): Promise<AccountResult> {
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
      .maybeSingle();
    if (profile.error) return { ok: false };
    if (!profile.data) return (await hasSessionFor(userId)) ? { ok: true, account: null } : { ok: false };

    const p = profile.data as Account["profile"];
    if (!p.customer_id) return { ok: true, account: { profile: p, customer: null, subscription: null } };

    const [customer, subscriptions] = await Promise.all([
      supabase.from("customers").select("id, name, billing_email, status").eq("id", p.customer_id).maybeSingle(),
      supabase.from("subscriptions").select("plan_id, billing, status, created_at").eq("customer_id", p.customer_id),
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
