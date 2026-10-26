"use server";

import { EMAIL_RE } from "@/lib/forms";
import { LOGIN_PATH, type PortalName } from "@/lib/tenancy";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { ok?: boolean; error?: string; email?: string };

/**
 * Asks GoTrue to mail a recovery link.
 *
 * The answer is the same whether or not the address has an account, and
 * that is the whole security design of this endpoint. `/my-odatone`'s
 * sign-in deliberately refuses to tell a wrong password apart from an
 * unknown address (see ../login/actions.ts); an unauthenticated reset form
 * that replied "no such user" would hand back the same information through
 * a door anyone can knock on repeatedly. So a failure to send is logged
 * server-side and reported to the visitor as success.
 *
 * The only thing that does produce an error is a syntactically invalid
 * address, which says nothing about who is registered.
 *
 * `redirectTo` points at the portal ROOT, not at this page: the recovery
 * token arrives in the URL fragment, and lib/use-invite-fragment.ts —
 * mounted by each root's login form — is what exchanges it for a session
 * and shows the choose-a-password form. Sending people back here would
 * land them on a form asking for the email they have just proved they own.
 *
 * Which root is decided by an allowlist of two, never by the posted value
 * itself, so this cannot be turned into an open redirect.
 */
export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { error: "email", email };

  /* Which portal the link comes back to, chosen from a fixed pair rather
     than taken from the form. The field is posted by the page and a
     redirect target assembled from client input is an open-redirect
     waiting to happen, so anything unrecognised falls back to the
     customer portal rather than being used. */
  const raw = String(formData.get("portal") ?? "");
  const portalName: PortalName = raw === "admin" ? "admin" : "portal";

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!site) {
    /* Same warning the signup flow logs: without an absolute origin the
       link GoTrue builds is a bare path that no mail client can follow. */
    console.warn(
      "[odatone] reset: NEXT_PUBLIC_SITE_URL is not set — the recovery link will be a relative path, not an absolute URL",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}${LOGIN_PATH[portalName]}`,
  });

  if (error) {
    /* Rate limiting and mail-transport failures land here. Logged, never
       shown: "we could not send to that address" is itself a signal about
       the address. The visitor is told the same thing either way and can
       try again. */
    console.error("[odatone] reset: resetPasswordForEmail failed", {
      code: error.code,
      status: error.status,
    });
  }

  return { ok: true, email };
}
