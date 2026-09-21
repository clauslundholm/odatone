"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { createBrowserClient } from "@/lib/supabase/client";

export type InviteMode = "checking" | "sign-in" | "set-password" | "expired";
export type SetPasswordError = "short" | "generic";

/** GoTrue's own floor is 6; 8 is this app's, applied in the browser before
    the round trip so a too-short password fails instantly rather than as a
    generic server error. */
export const MIN_PASSWORD_LEN = 8;

/**
 * The invite/recovery half of a login page, shared by /admin/login and
 * /my-odatone/login.
 *
 * Both pages show two completely different forms depending on how the
 * visitor arrived, and deciding which can only happen in the browser:
 * GoTrue's /verify endpoint 303-redirects to the page with the new
 * session's tokens in the URL *fragment* (`#access_token=...&type=invite`),
 * and a fragment is stripped before the browser even sends the request, so
 * the server never sees it.
 *
 * This lives in one place rather than once per portal because the two
 * traps below are invisible until you hit them, and a second copy would
 * eventually lose one of them.
 *
 * Trap 1 — supabase-js's automatic `detectSessionInUrl` does not work
 * here, even though it is on by default in the browser. @supabase/ssr's
 * createBrowserClient hard-codes `flowType: "pkce"`, and an implicit-style
 * hash (what /verify actually sends for invite and recovery links) is
 * rejected outright under PKCE with `AuthPKCEGrantCodeExchangeError: Not a
 * valid PKCE flow url.`, swallowed by `_initialize()`'s own catch. The
 * result is no session and no visible error — indistinguishable from "no
 * invite hash was ever here" until measured directly. So the fragment is
 * parsed by hand and handed to `setSession`, which takes a token pair and
 * does not care which flow produced it.
 *
 * Trap 2 — React's development-only Strict Mode invokes an effect's setup
 * twice (setup → cleanup → setup) to surface exactly this class of bug: an
 * effect that reads *and clears* external state is not safely re-runnable,
 * because its second run reads back the consequence of its own first run.
 * Confirmed live before `decidedRef` existed: an expired-invite hash was
 * correctly detected and stripped, then the second invocation re-read the
 * now-empty hash, concluded "no invite hash here", and overwrote the
 * correct "expired" verdict with "sign-in". A ref, not a plain variable,
 * because it must survive the synthetic unmount/remount Strict Mode
 * performs on the same component instance.
 *
 * @param landingPath where to send the visitor once their password is set
 *   — "/admin" for staff, "/my-odatone" for customers.
 */
export function useInviteFragment(landingPath: string) {
  const [mode, setMode] = useState<InviteMode>("checking");
  const [passwordError, setPasswordError] = useState<SetPasswordError | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hash.get("type");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const isInviteOrRecovery = type === "invite" || type === "recovery";
    const hashError = hash.get("error") || hash.get("error_code");

    // The common failure of an invite link, not an exotic one: expired
    // after 24h, or already consumed — including by a corporate email
    // link-scanner clicking it before the person did. Falling through to
    // "sign-in" here would show a password form to someone who has no
    // password yet and no way to explain why.
    if (hashError) {
      // Same rule as the success path below: a bearer credential (or, here,
      // a dead one) must never sit in the address bar or browser history.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setMode("expired");
      return;
    }

    if (!isInviteOrRecovery || !accessToken || !refreshToken) {
      setMode("sign-in");
      return;
    }

    const supabase = createBrowserClient();
    // setSession stores the resulting session in the same cookies
    // lib/supabase/server.ts's createClient reads, which is what lets the
    // rest of the app treat this exactly like any other signed-in visit
    // once it redirects.
    //
    // No "cancelled on cleanup" guard here on purpose. decidedRef already
    // guarantees this async call starts once per real mount; stacking a
    // cancel-on-cleanup flag on top reintroduces the very bug decidedRef
    // prevents, because Strict Mode calls the first invocation's cleanup
    // unconditionally — marking this real, in-flight call "cancelled"
    // before it resolves, while the second (decidedRef-skipped) invocation
    // never starts a replacement. Confirmed live: with both guards, the
    // invite flow hung on "Loading…" forever, in development only.
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        // The token fragment must never sit in the address bar or browser
        // history once consumed — it is a bearer credential.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (error) console.error("login: failed to establish session from invite link", error);
        // A rejected token pair (expired between page-load and this call,
        // or otherwise invalid) is the same "the link didn't work" outcome
        // as the hashError branch, not an invitation to guess a password
        // for an account the visitor was never asked to sign into.
        setMode(data.session ? "set-password" : "expired");
      });
  }, []);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < MIN_PASSWORD_LEN) {
      setPasswordError("short");
      return;
    }
    setPasswordError(null);
    setPasswordPending(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordPending(false);
      setPasswordError("generic");
      return;
    }
    // A full navigation, not router.push: the session that matters from
    // here on lives in cookies a fresh server request reads (proxy.ts, then
    // the landing page itself), not in this client component's memory.
    window.location.assign(landingPath);
  }

  return { mode, passwordError, passwordPending, submitPassword };
}
