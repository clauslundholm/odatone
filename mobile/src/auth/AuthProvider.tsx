import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { fetchAccount } from "./account";
import {
  accountEntitled,
  parseCache,
  resolveEntitled,
  type Account,
  type AccountState,
  type CachedEntitlement,
} from "./entitlement.ts";
import {
  MIN_PASSWORD,
  codeError,
  normalizeEmail,
  passwordError,
  sendError,
  shouldVerifyCode,
  signInError,
  type AuthErrorCode,
  type AuthResult,
  type CodeKind,
} from "./errors.ts";
import { configured, supabase } from "./supabase";

const CACHE_KEY = "odatone.entitlement.v1";

type AuthValue = {
  /** False until the stored session has been read, so a screen can tell
      "signed out" from "not checked yet". */
  ready: boolean;
  signedIn: boolean;
  email: string | null;
  account: Account | null;
  /** May this person press play right now. */
  entitled: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  verifyCode: (email: string, code: string, password: string, kind: CodeKind) => Promise<AuthResult>;
  resendCode: (email: string) => Promise<AuthResult>;
  requestReset: (email: string) => Promise<AuthResult>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

const fail = (error: AuthErrorCode): AuthResult => ({ ok: false, error });
const OK: AuthResult = { ok: true };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AccountState>({ kind: "signed-out" });
  const [cache, setCache] = useState<CachedEntitlement | null>(null);

  const userId = session?.user.id ?? null;
  /* A request for one user's account can still be in the air when someone
     else signs in. The ref is how a late answer finds out it is stale. */
  const currentUser = useRef<string | null>(null);

  /* ---- session: read what is stored, then follow every change ---- */
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => alive && setReady(true));

    /* Only setSession here. Calling another supabase method from inside
       this callback deadlocks supabase-js's auth lock; the account is
       loaded from the effect below instead, once React has the new id. */
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async (id: string) => {
    const result = await fetchAccount(id);
    if (currentUser.current !== id) return;
    if (!result.ok) {
      setState({ kind: "unavailable" });
      return;
    }
    setState({ kind: "loaded", account: result.account });
    const next: CachedEntitlement = { userId: id, entitled: accountEntitled(result.account), at: Date.now() };
    setCache(next);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /* ---- account: reload whenever the signed-in user changes ---- */
  useEffect(() => {
    currentUser.current = userId;
    if (!userId) {
      setState({ kind: "signed-out" });
      setCache(null);
      return;
    }
    /* Until the server answers, the last known answer stands in — that is
       what lets music start at once when the app opens, and at all when
       the shop's wifi is down. */
    setState({ kind: "unavailable" });
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        const stored = parseCache(raw);
        if (stored && currentUser.current === userId) setCache((now) => now ?? stored);
      })
      .catch(() => {});
    load(userId);
  }, [userId, load]);

  /* ---- foreground: refresh tokens only while visible, and re-read the
          account each time the app comes back, so a subscription
          cancelled in /admin takes effect the next time it is opened ---- */
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        supabase.auth.startAutoRefresh();
        if (currentUser.current) load(currentUser.current);
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [load]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!configured) return fail("service");
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    return error ? fail(signInError(error)) : OK;
  }, []);

  const signOut = useCallback(async () => {
    /* "local": this phone only. The default signs the account out
       everywhere, which would stop the music in every other shop on the
       same login. A failed request still clears the local session. */
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    setCache(null);
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string, password: string, kind: CodeKind): Promise<AuthResult> => {
      if (!configured) return fail("service");
      /* Checked before the code is spent: a code is single-use, and
         burning it on a password the server was always going to refuse
         would send the customer back for another email. */
      if (password.length < MIN_PASSWORD) return fail("weak");

      const address = normalizeEmail(email);
      const { data: current } = await supabase.auth.getSession();
      if (shouldVerifyCode(current.session?.user.email ?? null, address)) {
        const { error } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: kind });
        if (error) return fail(codeError(error));
      }

      const { error } = await supabase.auth.updateUser({ password });
      const failed = error ? passwordError(error) : null;
      return failed ? fail(failed) : OK;
    },
    [],
  );

  const resendCode = useCallback(async (email: string): Promise<AuthResult> => {
    if (!configured) return fail("service");
    /* The sign-in-code email (supabase/templates/magic_link.html). Never
       creates a user: only someone the signup already invited gets one. */
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: false },
    });
    const failed = error ? sendError(error) : null;
    return failed ? fail(failed) : OK;
  }, []);

  const requestReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!configured) return fail("service");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
    const failed = error ? sendError(error) : null;
    return failed ? fail(failed) : OK;
  }, []);

  const refresh = useCallback(async () => {
    if (currentUser.current) await load(currentUser.current);
  }, [load]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      signedIn: userId !== null,
      email: session?.user.email ?? null,
      account: state.kind === "loaded" ? state.account : null,
      entitled: resolveEntitled(state, cache, userId, Date.now()),
      signIn,
      signOut,
      verifyCode,
      resendCode,
      requestReset,
      refresh,
    }),
    [ready, userId, session, state, cache, signIn, signOut, verifyCode, resendCode, requestReset, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
