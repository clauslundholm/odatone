import { exportCustomer } from "../gdpr-actions";

/**
 * Streams the same JSON `exportCustomer` (../gdpr-actions.ts) builds as a
 * file download, the same Content-Disposition pattern
 * app/api/edits/export/route.ts already uses. A route handler rather than
 * the Export button calling the server action directly: a browser can only
 * save a file from an actual navigable response, and `<form
 * action={exportCustomer}>`/`useActionState` hand a Server Action's result
 * back across the RSC boundary as React state, not as something the
 * browser's own download machinery ever sees.
 *
 * Reachable only by staff: this path is nested under /admin, which
 * lib/supabase/proxy.ts's updateSession already gates to a signed-in staff
 * session before any route under it — including this one — runs at all.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const blob = await exportCustomer(id);
  return new Response(blob, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="customer-${id}.json"`,
    },
  });
}
