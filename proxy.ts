// Next 16 renamed middleware.ts to proxy.ts; the export is `proxy`, not `middleware`.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

/* The two gated portals, plus the product routes that render the signed-in
   shell. The latter are not gated — updateSession returns early for them —
   they are listed so an expiring session gets refreshed while somebody is
   reading their own account, their week or the front page. Spelled out one
   by one rather than matched with a wildcard over /:locale/:path*: that
   would put every marketing page under the proxy too, and those are
   prerendered files that must never grow a per-request round trip. */
export const config = {
  matcher: [
    "/admin/:path*",
    "/my-odatone/:path*",
    "/da",
    "/en",
    "/da/konto/:path*",
    "/en/account/:path*",
    "/da/liste/:path*",
    "/en/list/:path*",
    "/da/spilleplan",
    "/en/schedule",
    "/da/saesoner",
    "/en/seasons",
  ],
};
