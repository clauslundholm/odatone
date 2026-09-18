// Next 16 renamed middleware.ts to proxy.ts; the export is `proxy`, not `middleware`.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/my-odatone/:path*"],
};
