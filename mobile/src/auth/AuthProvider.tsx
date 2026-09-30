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
  CHECK_WAIT_MS,
  RECHECK_INTERVAL_MS,
  accountEntitled,
  accountKnown,
  canStillRead,
  effectiveAccountState,
  effectiveUserId,
  isChecking,
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

/** The longest a sign-in waits for the account read before it resolves
    anyway. The read keeps going and applies its answer when it lands. */
const SETTLE_WAIT_MS = 8000;

/** The longest "Check again" waits for the auth server to hand back a
    session before it resolves anyway. */
const SESSION_WAIT_MS = 8000;

type AuthValue = {
  /** False until the stored session has been read, so a screen can tell
      "signed out" from "not checked yet". */
  ready: boolean;
  signedIn: boolean;
  email: string | null;
  account: Account | null;
  /** May this person press play right now. */
  entitled: boolean;
  /** True while there is an identity, no yes to go on, and the server's
      answer may still be on its way — for at most CHECK_WAIT_MS. A play
      gate must wait while this is true rather than read `entitled: false`
      as "subscription not active". */
  checking: boolean;
  /** True only when the server's answer for this user has been read.
      `entitled: false` without it means "could not check", not "no". */
  known: boolean;
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
  /* The user whose account read last came back, either way. */
  const [settledFor, setSettledFor] = useState<string | null>(null);
  /* Ticks so the 7-day offline window is re-evaluated on a device that is
     left running, not only when something else changes. */
  const [now, setNow] = useState(() => Date.now());
  /* When the wait for an answer began, and for whom: `checking` is capped
     at CHECK_WAIT_MS from `since`. */
  const [wait, setWait] = useState<{ userId: string | null; since: number }>(() => ({ userId: null, since: Date.now() }));

  const sessionState: SessionState =
    session === "unknown" || session === "absent" ? session : { userId: session.user.id };
  const hasSession = typeof session === "object";
  const userId = effectiveUserId(sessionState, cache);
  const ready = sessionReady(sessionState, cacheRead, cache, settled);
  /* A new identity starts a new wait. Set while rendering, not from an
     effect, so no commit ever measures this user's wait from the last
     one's start. */
  if (wait.userId !== userId) setWait({ userId, since: Date.now() });

  /* Refs mirror what asynchronous callbacks need to see now, not as of
     the render that created them. */
  const currentUser = useRef<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const requestSeq = useRef(0);
  /* The address a code was accepted for in this run, so a retry after the
     password step failed can skip the (single-use) code. */
  const verifiedFor = useRef<string | null>(null);

  /* Every route to "there is no session" goes through here: the stored
     entitlement and the half-finished code check belong to that session. */
  const sessionGone = useCallback(() => {
    verifiedFor.current = null;
    sessionRef.current = "absent";
    setSession("absent");
    setCache(null);
    setSettledFor(null);
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
  }, []);
  const inflight = useRef<{ id: string; seq: number; promise: Promise<void> } | null>(null);

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
        else if (!error && sessionRef.current === "unknown") sessionGone();
      })
      .catch(() => {})
      .finally(() => alive && setSettled(true));

    /* This callback only records the session. The account is loaded from
       the effect below, once React has the new id — no supabase call is
       made from in here. That is the sound rule in any version of
       supabase-js, and a requirement if an auth lock is ever configured
       (the callback would then run while the lock is held). */
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      /* A token refresh that was already in flight when this phone signed
         out can land a moment later and hand back the session that was
         just removed. The app's own "signed out" stands: a real sign-in
         arrives as SIGNED_IN, never as TOKEN_REFRESHED. */
      if (event === "TOKEN_REFRESHED" && sessionRef.current === "absent") return;
      if (next) setSession(next);
      else if (event === "SIGNED_OUT") sessionGone();
      /* INITIAL_SESSION with null also arrives when the refresh could not
         reach the server: not evidence of anything. */
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [sessionGone]);

  const load = useCallback((id: string): Promise<void> => {
    const request = ++requestSeq.current;
    const promise = (async () => {
      const result = await fetchAccount(id);
      /* An answer counts only if nothing newer was asked since, and it is
         for the user who is still there. */
      if (request !== requestSeq.current || currentUser.current !== id) return;
      setSettledFor(id);
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
    })();
    const entry = { id, seq: request, promise };
    inflight.current = entry;
    promise.finally(() => {
      if (inflight.current === entry) inflight.current = null;
    });
    return promise;
  }, []);

  /* A read for this user already under way is joined, not restarted, so
     signIn can wait for the same answer the session effect asked for.
     Only a read that is still the latest is joined: one that was
     superseded (the user signed out meanwhile) will be discarded when it
     lands, so joining it would leave no answer coming. */
  const loadFor = useCallback(
    (id: string) => {
      const running = inflight.current;
      return running && running.id === id && running.seq === requestSeq.current ? running.promise : load(id);
    },
    [load],
  );

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
    if (hasSession) loadFor(userId);
  }, [userId, hasSession, loadFor]);

  /* ---- while open: re-read the account periodically, and tick ---- */
  useEffect(() => {
    if (!userId) return;
    setNow(Date.now());
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

  /* Waits for the new user's account, so a screen that closes on success
     has an entitlement to show. The id comes from the call's own result:
     React state has not caught up yet. A failed read is not a failed
     sign-in; the cache covers it, or `known` stays false and the gate
     says it could not check. */
  const settleAccount = useCallback(
    async (fresh: Session) => {
      currentUser.current = fresh.user.id;
      sessionRef.current = fresh;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const patience = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, SETTLE_WAIT_MS);
      });
      await Promise.race([loadFor(fresh.user.id).catch(() => {}), patience]);
      clearTimeout(timer);
    },
    [loadFor],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      if (!configured) return fail("service");
      verifiedFor.current = null;
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) return fail(signInError(error));
      if (data.session) await settleAccount(data.session);
      return OK;
    } catch {
      return fail("service");
    }
  }, [settleAccount]);

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
    sessionGone();
  }, [sessionGone]);

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
        /* The password is saved: from here nothing may turn this into a
           failure, or a retry would re-submit a spent code. */
        try {
          const { data: current } = await supabase.auth.getSession();
          if (current.session) await settleAccount(current.session);
        } catch {}
        verifiedFor.current = null;
        return OK;
      } catch {
        return fail("service");
      }
    },
    [settleAccount],
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

  /* "Check again" and pull-to-refresh. Never rejects. */
  const refresh = useCallback(async () => {
    try {
      const id = currentUser.current;
      if (!id) return;
      /* Asking again is a new wait. */
      setWait((w) => ({ ...w, since: Date.now() }));
      const held = sessionRef.current;
      if (typeof held === "object") {
        await load(id);
        return;
      }
      if (held === "absent") return;

      /* An identity from the cache and no session: the auth server did not
         answer at launch, so there is nothing to read the account as.
         getSession() tries the token refresh again. It is not waited for
         longer than SESSION_WAIT_MS; an attempt that lands later still
         arrives as TOKEN_REFRESHED and is picked up from there. */
      let timer: ReturnType<typeof setTimeout> | undefined;
      const patience = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), SESSION_WAIT_MS);
      });
      const found = await Promise.race([
        supabase.auth.getSession().then(
          ({ data }) => data.session,
          () => null,
        ),
        patience,
      ]);
      clearTimeout(timer);
      /* Only for the user who asked, and only if they are still here and
         did not sign out while it was away. */
      if (!found || found.user.id !== id || currentUser.current !== id || sessionRef.current === "absent") return;
      sessionRef.current = found;
      setSession(found);
      /* The session effect asks for the same read once React has the
         session; whichever of the two comes first, the other joins it. */
      await loadFor(id);
    } catch {}
  }, [load, loadFor]);

  const shown = effectiveAccountState(state, userId);
  const entitled = resolveEntitled(shown, cache, userId, now);
  const checking = isChecking(shown, cache, userId, settledFor, canStillRead(sessionState, settled), now, wait.since);

  /* ---- the cap on `checking`: the minute tick above is too coarse for
          it, so re-render at the moment the wait runs out ---- */
  useEffect(() => {
    if (!checking) return;
    const expires = wait.since + CHECK_WAIT_MS;
    /* Never longer than the cap itself, whatever the phone's clock has
       been set to since; and `now` is moved at least to `expires`, so a
       timer that fires a millisecond early still ends the wait. */
    const delay = Math.min(CHECK_WAIT_MS, Math.max(0, expires - Date.now()));
    const timer = setTimeout(() => setNow(Math.max(Date.now(), expires)), delay);
    return () => clearTimeout(timer);
  }, [checking, wait.since]);
  const known = accountKnown(shown);
  const email =
    typeof session === "object" ? (session.user.email ?? null) : cache && cache.userId === userId ? (cache.email ?? null) : null;
  const account = shown.kind === "loaded" ? shown.account : null;

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      signedIn: userId !== null,
      email,
      account,
      entitled,
      checking,
      known,
      signIn,
      signOut,
      verifyCode,
      resendCode,
      requestReset,
      refresh,
    }),
    [ready, userId, email, account, entitled, checking, known, signIn, signOut, verifyCode, resendCode, requestReset, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
