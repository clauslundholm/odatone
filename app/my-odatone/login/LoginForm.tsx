"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n";
import { portal } from "@/lib/content/portal";
import { signIn } from "./actions";

const initialState: { error?: string } = {};

type Mode = "checking" | "sign-in" | "set-password" | "expired";

/**
 * Two very different forms behind one component, chosen by how the
 * visitor arrived rather than by anything server-rendered:
 *
 * - Ordinary visit: the plain email/password sign-in (signIn, actions.ts),
 *   the same action shape as app/admin/login (Task 9) with the messages
 *   localised client-side from lib/content/portal.ts.
 * - Arrived via Task 13's invite link (or a future password-reset link):
 *   GoTrue's own /verify endpoint 303-redirects here with the new
 *   session's tokens in the URL *fragment* (`#access_token=...&type=invite`),
 *   which never reaches the server — a fragment is stripped before the
 *   browser even sends the request. Detecting it, and turning those
 *   tokens into an actual signed-in session, can only happen client-side,
 *   which is the one thing on this otherwise server-rendered page that
 *   needs a browser Supabase client at all (lib/supabase/client.ts,
 *   unused anywhere else in the app until now).
 *
 * That second branch does NOT rely on supabase-js's own automatic
 * detectSessionInUrl, even though it's on by default in the browser:
 * @supabase/ssr's createBrowserClient hard-codes `flowType: "pkce"`
 * (createBrowserClient.js), and confirmed directly against this file's
 * `_getSessionFromURL` — an implicit-style hash (what GoTrue's /verify
 * actually sends for an invite/recovery link) is rejected outright under
 * PKCE (`AuthPKCEGrantCodeExchangeError: Not a valid PKCE flow url.`),
 * swallowed by `_initialize()`'s own catch, leaving getSession() with no
 * session and no visible error — a silent dead end that looks identical
 * to "no invite hash was ever here" until measured directly. So the
 * fragment is parsed by hand below and handed to `setSession`, which
 * takes a token pair directly and does not care which flow produced it.
 *
 * Without this second branch, an invite would land here, the fragment
 * would sit unprocessed, and the visitor would face a plain "email +
 * password" form with no password to type yet — a subtler dead end than
 * the 404 this whole task exists to close, not a fix for it.
 *
 * A third shape reaches here too, and is the *common* failure of an
 * invite link, not an exotic one: GoTrue's /verify redirects with
 * `#error=access_denied&error_code=otp_expired&...` for a link that has
 * expired (24h) or was already consumed — including by a corporate email
 * link-scanner clicking it before the person does. Falling through to
 * "sign-in" for this case (as an earlier version of this file did) shows
 * the visitor a form with no password to type and no explanation. This
 * is handled as its own "expired" mode with a message that tells them
 * what actually happened.
 */
export default function LoginForm({ locale }: { locale: Locale }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [mode, setMode] = useState<Mode>("checking");
  const [setPwError, setSetPwError] = useState<"short" | "generic" | null>(null);
  const [setPwPending, setSetPwPending] = useState(false);
  // Guards the effect body below against React's development-only Strict
  // Mode, which invokes an effect's setup twice (setup → cleanup → setup)
  // on every mount to surface exactly this class of bug: an effect that
  // reads *and clears* external state (the URL fragment, via
  // replaceState) is not safely re-runnable, because its second
  // invocation reads back the consequence of its own first invocation's
  // side effect rather than a fresh input. Confirmed live: without this
  // guard, an expired-invite hash was correctly detected and replaceState
  // correctly stripped it — then the second invocation re-read the now-
  // empty hash, concluded "no invite hash was ever here", and overwrote
  // mode with "sign-in", silently discarding the first invocation's
  // (correct) "expired" verdict. A ref, not a plain variable, because it
  // must survive across the synthetic unmount/remount Strict Mode
  // performs on the same component instance.
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
    // setSession, not getSession: see this component's own doc comment
    // for why relying on createBrowserClient's automatic
    // detectSessionInUrl silently fails here. Handing it the token pair
    // straight from the fragment stores the resulting session in cookies
    // — the same cookies lib/supabase/server.ts's createClient reads,
    // which is what lets the rest of the app (proxy.ts,
    // /my-odatone/page.tsx) treat this exactly like any other signed-in
    // visit once it redirects there.
    //
    // No "cancelled on cleanup" guard here on purpose, unlike an earlier
    // version of this effect: decidedRef above already guarantees this
    // async call is only ever started once per real mount. Adding a
    // cancel-on-cleanup flag back on top of that reintroduces the exact
    // bug decidedRef exists to prevent — Strict Mode's synthetic
    // setup→cleanup→setup calls the *first* invocation's cleanup
    // unconditionally, which would mark this one real, in-flight
    // setSession call as "cancelled" before it ever resolves, and the
    // second (decidedRef-skipped) invocation never starts a replacement.
    // Confirmed live: with both guards stacked, the invite flow hung on
    // "Henter…"/"Loading…" forever, in development only.
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
      // The token fragment must never sit in the address bar or browser
      // history once consumed — it's a bearer credential.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (error) console.error("my-odatone login: failed to establish session from invite link", error);
      // A rejected token pair (expired between page-load and this call, or
      // otherwise invalid) is the same "the link didn't work" outcome as
      // the hashError branch above, not an invitation to guess a
      // password for an account the visitor was never asked to sign into.
      setMode(data.session ? "set-password" : "expired");
    });
  }, []);

  async function handleSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setSetPwError("short");
      return;
    }
    setSetPwError(null);
    setSetPwPending(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSetPwPending(false);
      setSetPwError("generic");
      return;
    }
    // A full navigation, not router.push: the session that matters from
    // here on lives in cookies a fresh server request reads (proxy.ts,
    // then the summary page itself), not in this client component's
    // memory.
    window.location.assign("/my-odatone");
  }

  if (mode === "checking") {
    return (
      <>
        <Header subtitle={portal.login.subtitle[locale]} />
        <p className="text-center text-[0.875rem] text-ink-2">{portal.login.loading[locale]}</p>
      </>
    );
  }

  if (mode === "expired") {
    const t = portal.login.expired;
    return (
      <>
        <Header heading={t.heading[locale]} subtitle={portal.login.subtitle[locale]} />
        <p role="alert" className="text-[0.875rem] text-ink-2">
          {t.body[locale]}
        </p>
      </>
    );
  }

  if (mode === "set-password") {
    const t = portal.login.setPassword;
    return (
      <>
        <Header heading={t.heading[locale]} subtitle={portal.login.subtitle[locale]} />
        <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
          <p className="text-[0.875rem] text-ink-2">{t.body[locale]}</p>
          <Field
            label={t.passwordLabel[locale]}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {setPwError && (
            <p role="alert" className="text-[0.8125rem] text-bad">
              {setPwError === "short" ? t.tooShort[locale] : t.generic[locale]}
            </p>
          )}
          <Button type="submit" size="md" className="mt-2 w-full" disabled={setPwPending}>
            {setPwPending ? t.submitPending[locale] : t.submit[locale]}
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Header heading={portal.login.heading[locale]} subtitle={portal.login.subtitle[locale]} />
      <form action={formAction} className="flex flex-col gap-4">
        <Field label={portal.login.emailLabel[locale]} name="email" type="email" autoComplete="email" required />
        <Field
          label={portal.login.passwordLabel[locale]}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.error && (
          <p role="alert" className="text-[0.8125rem] text-bad">
            {(portal.login.errors[state.error] ?? portal.login.errors.service)[locale]}
          </p>
        )}
        <Button type="submit" size="md" className="mt-2 w-full" disabled={pending}>
          {pending ? portal.login.submitPending[locale] : portal.login.submit[locale]}
        </Button>
      </form>
    </>
  );
}

/** The card's heading + product-name subtitle, above whichever form/message
    this component is currently showing. `heading` is optional so the
    "checking" mode (before it's known whether this is an ordinary sign-in
    or an invite) can show just the subtitle rather than asserting "Sign
    in" for a beat before possibly switching to "Choose a password" —
    page.tsx used to render a single static heading here regardless of
    mode, which is exactly how "Log ind" ended up as the permanent title
    above a choose-a-password form. */
function Header({ heading, subtitle }: { heading?: string; subtitle: string }) {
  return (
    <div className="mb-8 flex flex-col items-center gap-1 text-center">
      {heading && <h1 className="u-title text-[1.25rem] text-ink">{heading}</h1>}
      <p className="text-[0.875rem] text-ink-2">{subtitle}</p>
    </div>
  );
}
