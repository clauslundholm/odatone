import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseEnv } from "./env";
import { LOGIN_PATH, isPublicPath, mayEnter, parseRole, portalFor } from "../tenancy";

/* These three are exactly what @supabase/ssr's applyServerStorage passes as
   setAll's second argument (see node_modules/@supabase/ssr/dist/main/cookies.js).
   Naming them instead of copying "every header" keeps this from ever
   forwarding something unrelated to the session write. */
const CACHE_HEADERS = ["cache-control", "expires", "pragma"];

/** Carries the accumulated cookie writes and no-store cache headers from
    `from` onto `to`. The redirect and rewrite branches below each build a
    brand-new NextResponse — returning it directly would silently drop
    whatever setAll wrote onto the closure's `response`, including a
    just-rotated refresh token. A customer whose token happens to refresh on
    the same request that turns out to need a redirect would keep the old
    (soon-invalid) cookie in the browser and be logged out of their own
    portal past the reuse-detection window. */
function carryOver(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  for (const name of CACHE_HEADERS) {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  }
  return to;
}

/* Status is passed explicitly because the rewrite target, "/404", is not a
   route this app declares (there is no app/404). It resolves through
   app/global-not-found.tsx today — verified by hitting it directly, both in
   isolation and via this proxy with real, wrong-audience sessions: HTTP 404,
   global-not-found's body. That resolution rests on Next treating the
   literal string "/404" specially (the same reserved-path convention
   pages/404.js had in the Pages Router), which is not documented for the App
   Router and could change. Passing { status: 404 } here makes the intended
   status explicit regardless of what "/404" resolves to, so a future Next
   version that stops special-casing that path degrades loudly (wrong body,
   still 404) rather than silently in the open direction (200, wrong-audience
   content rendered). Confirmed empirically that this option does not change
   today's outcome: same 404, same global-not-found body.
   A user of the wrong audience must see a 404, never a 403 — there is no
   reason to confirm the admin backend's existence to a customer. */
function notFound(request: NextRequest, from: NextResponse): NextResponse {
  return carryOver(from, NextResponse.rewrite(new URL("/404", request.url), { status: 404 }));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  /* Deliberately NOT case-folded here. portalFor/isPublicPath/mayEnter each
     fold internally (see lib/tenancy.ts's hasSegment), so every comparison
     already agrees on casing regardless of how the request arrived — a
     second, proxy-local folded copy is not needed for that, and keeping one
     around is exactly what caused a customer's own request path to come
     back lower-cased in `next` below: a case-sensitive slug (an invoice
     number, a customer id) would 404 or fail its lookup after login. `path`
     stays the single, unmodified value used for every check and for the
     redirect target. */
  const path = request.nextUrl.pathname;
  const portal = portalFor(path);

  if (!portal) return response;

  /* Deliberately NOT `if (isPublicPath(path)) return response` here, which
     is what this line used to be. The portal root is public now — it renders
     the sign-in form when signed out — so short-circuiting on it would wave
     a signed-in CUSTOMER straight into /admin, where the page would find a
     valid session and start rendering the staff console. Public means "may
     be reached WITHOUT a session", not "skip the audience check". The
     session is read first, and `isPublicPath` only decides what happens when
     there is none. */

  const env = resolveSupabaseEnv();
  if (!env) {
    /* Fail closed. lib/supabase/env.ts documents null as a normal state:
       locally, on a deploy made before the integration was added, or a
       half-configured one. Every other failure mode in this function
       resolves to a 404; this must not be the one branch that resolves to
       "let them in" — a misconfigured deploy must not unlock both portals
       to anonymous visitors. */
    return notFound(request, response);
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        /* Without these, Vercel's CDN may cache a response carrying Set-Cookie
           and hand one customer's session token to the next visitor. */
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  /* getClaims, not getSession: getSession reads the cookie without verifying
     its signature. Called here, before any response is generated, so a refresh
     completing later is not lost. */
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    /* No session. The portal root and the legacy /login URLs render the
       sign-in form themselves, so they are served as-is; anything deeper
       redirects to the root carrying where the visitor was headed. */
    if (isPublicPath(path)) return response;
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH[portal];
    url.searchParams.set("next", path);
    return carryOver(response, NextResponse.redirect(url));
  }

  const { data: profile, error } = await supabase
    .from("profiles").select("role").eq("id", data.claims.sub).single();

  if (error) {
    /* A transient PostgREST failure must still deny (there is no safe
       fallback role to assume), but denying silently would turn a database
       hiccup into an unlogged, unexplained 404 for a legitimate staff or
       customer user. */
    console.error("updateSession: failed to read profile role", error);
  }

  const role = parseRole(profile?.role);

  /* A customer who finds /admin, or staff who wander into /my-odatone, gets
     404, not 403 — same reasoning as the missing-env branch above. */
  if (!mayEnter(path, role)) return notFound(request, response);

  return response;
}
