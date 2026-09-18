import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseEnv } from "./env";
import { isStaffRole, type Role } from "../tenancy";

const ADMIN = "/admin";
const PORTAL = "/my-odatone";
const PUBLIC = [`${ADMIN}/login`, `${PORTAL}/login`];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = resolveSupabaseEnv();
  if (!env) return response;

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
  const path = request.nextUrl.pathname;
  const guarded = path.startsWith(ADMIN) || path.startsWith(PORTAL);

  if (!guarded || PUBLIC.some((p) => path.startsWith(p))) return response;

  if (!data?.claims?.sub) {
    const url = request.nextUrl.clone();
    url.pathname = path.startsWith(ADMIN) ? `${ADMIN}/login` : `${PORTAL}/login`;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.claims.sub).single();

  const role = profile?.role as Role | undefined;
  const staffArea = path.startsWith(ADMIN);

  /* A customer who finds /admin gets 404, not 403. There is no reason to
     confirm the backend exists.

     The rewrite target is "/404" rather than a route that exists in this
     app (there is no app/404 or app/(...)/404). This app resolves the path
     "/404" to app/global-not-found.tsx with a real 404 status even without
     an app/404 route — verified directly: a GET to /404 on a production
     build returns HTTP 404 with the global-not-found body, distinct from
     the generic Next fallback that single-segment unmatched paths (which
     match the [locale] catch-all and call notFound()) render instead. */
  if (!role || (staffArea && !isStaffRole(role)) || (!staffArea && isStaffRole(role))) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  return response;
}
