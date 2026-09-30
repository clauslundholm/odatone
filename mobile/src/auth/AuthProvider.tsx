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
  RECHECK_INTERVAL_MS,
  accountEntitled,
  effectiveUserId,
  parseCache,
  resolveEntitled,
  sessionReady,
  type Account,
  type AccountState,
  type CachedEntitlement,
  type SessionState,
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
import { AUTH_STORAGE_KEY, configured, supabase } from "./supabase";

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
  /* Three states, not two. "absent" is only ever set on evidence: the
     stored session was read and there is none, a SIGNED_OUT event, or the
     app's own signOut(). A failed read (the auth server is unreachable)
     leaves "unknown", so the cached identity keeps a shop's music going
     inside the offline window instead of showing the login gate. */
  const [session, setSession] = useState<Session | "unknown" | "absent">("unknown");
  const [settled, setSettled] = useState(false);
  const [cacheRead, setCacheRead] = useState(false);
  const [state, setState] = useState<AccountState>({ kind: "signed-out" });
  const [cache, setCache] = useState<CachedEntitlement | null>(null);
  /* Ticks so the 7-day offline window is re-evaluated on a device that is
     left running, not only when something else changes. */
  const [now, setNow] = useState(() => Date.now());

  const sessionState: SessionState =
    session === "unknown" || session === "absent" ? session : { userId: session.user.id };
  const hasSession = typeof session === "object";
  const userId = effectiveUserId(sessionState, cache);
  const ready = sessionReady(sessionState, cacheRead, cache, settled);

  /* Refs mirror what asynchronous callbacks need to see now, not as of
     the render that created them. */
  const currentUser = useRef<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const requestSeq = useRef(0);
  /* The address a code was accepted for in this run, so a retry after the
     password step failed can skip the (single-use) code. */
  const verifiedFor = useRef<string | null>(null);

  const markAbsent = useCallback(() => {
    sessionRef.current = "absent";
    setSession("absent");
  }, []);

  /* ---- stored entitlement: read once, independently of the session ---- */
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        const stored = parseCache(raw);
        if (alive && stored && sessionRef.current !== "absent") setCache((now) => now ?? stored);
      })
      .catch(() => {})
      .finally(() => alive && setCacheRead(true));
    return () => {
      alive = false;
    };
  }, []);

  /* ---- session: read what is stored, then follow every change ---- */
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (data.session) setSession(data.session);
        else if (!error) setSession((now) => (now === "unknown" ? "absent" : now));
      })
      .catch(() => {})
      .finally(() => alive && setSettled(true));

    /* Only set state here. Calling another supabase method from inside
       this callback deadlocks supabase-js's auth lock; the account is
       loaded from the effect below instead, once React has the new id. */
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (next) setSession(next);
      else if (event === "SIGNED_OUT") setSession("absent");
      /* INITIAL_SESSION with null also arrives when the refresh could not
         reach the server: not evidence of anything. */
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async (id: string) => {
    const request = ++requestSeq.current;
    const result = await fetchAccount(id);
    /* An answer counts only if nothing newer was asked since, and it is
       for the user who is still there. */
    if (request !== requestSeq.current || currentUser.current !== id) return;
    if (!result.ok) {
      setState({ kind: "unavailable" });
      return;
    }
    setState({ kind: "loaded", account: result.account });
    const live = sessionRef.current;
    const next: CachedEntitlement = {
      userId: id,
      entitled: accountEntitled(result.account),
      at: Date.now(),
      ...(typeof live === "object" && live.user.email ? { email: live.user.email } : {}),
    };
    setCache(next);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /* ---- account: reload whenever the identity or the session appears ---- */
  useEffect(() => {
    currentUser.current = userId;
    if (!userId) {
      requestSeq.current++;
      setState({ kind: "signed-out" });
      return;
    }
    /* Until the server answers, the last known answer stands in — that is
       what lets music start at once when the app opens, and at all when
       the shop's wifi is down. With an identity but no session there is
       nothing to ask as, so it stays that way. */
    setState({ kind: "unavailable" });
    if (hasSession) load(userId);
  }, [userId, hasSession, load]);

  /* ---- while open: re-read the account periodically, and tick ---- */
  useEffect(() => {
    if (!userId) return;
    const clock = setInterval(() => setNow(Date.now()), 60 * 1000);
    const recheck = hasSession ? setInterval(() => load(userId), RECHECK_INTERVAL_MS) : null;
    return () => {
      clearInterval(clock);
      if (recheck) clearInterval(recheck);
    };
  }, [userId, hasSession, load]);

  /* ---- foreground: refresh tokens only while visible, and re-read the
          account each time the app comes back, so a subscription
          cancelled in /admin takes effect the next time it is opened ---- */
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        supabase.auth.startAutoRefresh();
        setNow(Date.now());
        if (currentUser.current && typeof sessionRef.current === "object") load(currentUser.current);
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
    try {
      if (!configured) return fail("service");
      const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      return error ? fail(signInError(error)) : OK;
    } catch {
      return fail("service");
    }
  }, []);

  const signOut = useCallback(async () => {
    /* "local": this phone only. The default signs the account out
       everywhere, which would stop the music in every other shop on the
       same login. supabase-js cannot remove the session while offline
       with an expired token (it returns an error and leaves it stored),
       so then the stored session is removed here. Either way this phone
       ends up signed out. */
    let removed = false;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      removed = !error;
    } catch {}
    if (!removed) await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
    verifiedFor.current = null;
    markAbsent();
    setCache(null);
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
  }, [markAbsent]);

  const verifyCode = useCallback(
    async (email: string, code: string, password: string, kind: CodeKind): Promise<AuthResult> => {
      try {
        if (!configured) return fail("service");
        /* Checked before the code is spent: a code is single-use, and
           burning it on a password the server was always going to refuse
           would send the customer back for another email. */
        if (password.length < MIN_PASSWORD) return fail("weak");

        const address = normalizeEmail(email);
        if (shouldVerifyCode(verifiedFor.current, address)) {
          const { error } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: kind });
          if (error) return fail(codeError(error));
          verifiedFor.current = address;
        }

        const { error } = await supabase.auth.updateUser({ password });
        const failed = error ? passwordError(error) : null;
        if (failed) return fail(failed);
        verifiedFor.current = null;
        return OK;
      } catch {
        return fail("service");
      }
    },
    [],
  );

  const resendCode = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      if (!configured) return fail("service");
      /* The sign-in-code email (supabase/templates/magic_link.html). Never
         creates a user: only someone the signup already invited gets one. */
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizeEmail(email),
        options: { shouldCreateUser: false },
      });
      const failed = error ? sendError(error) : null;
      return failed ? fail(failed) : OK;
    } catch {
      return fail("service");
    }
  }, []);

  const requestReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      if (!configured) return fail("service");
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
      const failed = error ? sendError(error) : null;
      return failed ? fail(failed) : OK;
    } catch {
      return fail("service");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (currentUser.current && typeof sessionRef.current === "object") await load(currentUser.current);
  }, [load]);

  const entitled = resolveEntitled(state, cache, userId, now);
  const email =
    typeof session === "object" ? (session.user.email ?? null) : cache && cache.userId === userId ? (cache.email ?? null) : null;
  const account = state.kind === "loaded" ? state.account : null;

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      signedIn: userId !== null,
      email,
      account,
      entitled,
      signIn,
      signOut,
      verifyCode,
      resendCode,
      requestReset,
      refresh,
    }),
    [ready, userId, email, account, entitled, signIn, signOut, verifyCode, resendCode, requestReset, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
