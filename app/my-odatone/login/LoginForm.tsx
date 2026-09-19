"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n";
import { portal } from "@/lib/content/portal";
import { signIn } from "./actions";

const initialState: { error?: string } = {};

type Mode = "checking" | "sign-in" | "set-password";

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
 */
export default function LoginForm({ locale }: { locale: Locale }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [mode, setMode] = useState<Mode>("checking");
  const [setPwError, setSetPwError] = useState<"short" | "generic" | null>(null);
  const [setPwPending, setSetPwPending] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hash.get("type");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const isInviteOrRecovery = type === "invite" || type === "recovery";

    if (!isInviteOrRecovery || !accessToken || !refreshToken) {
      setMode("sign-in");
      return;
    }

    let cancelled = false;
    const supabase = createBrowserClient();
    // setSession, not getSession: see this component's own doc comment
    // for why relying on createBrowserClient's automatic
    // detectSessionInUrl silently fails here. Handing it the token pair
    // straight from the fragment stores the resulting session in cookies
    // — the same cookies lib/supabase/server.ts's createClient reads,
    // which is what lets the rest of the app (proxy.ts,
    // /my-odatone/page.tsx) treat this exactly like any other signed-in
    // visit once it redirects there.
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
      if (cancelled) return;
      // The token fragment must never sit in the address bar or browser
      // history once consumed — it's a bearer credential.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (error) console.error("my-odatone login: failed to establish session from invite link", error);
      setMode(data.session ? "set-password" : "sign-in");
    });
    return () => {
      cancelled = true;
    };
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
    return <p className="text-center text-[0.875rem] text-ink-2">{portal.login.loading[locale]}</p>;
  }

  if (mode === "set-password") {
    const t = portal.login.setPassword;
    return (
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
    );
  }

  return (
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
  );
}
