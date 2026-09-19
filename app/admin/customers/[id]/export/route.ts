import { exportCustomer, isCurrentSessionStaff } from "../gdpr-actions";

/**
 * Streams the same JSON `exportCustomer` (../gdpr-actions.ts) builds as a
 * file download, using a Content-Disposition header so the browser saves it
 * rather than rendering it inline. A route handler rather than the Export
 * button calling the server action directly: a browser can only save a file
 * from an actual navigable response, and `<form
 * action={exportCustomer}>`/`useActionState` hand a Server Action's result
 * back across the RSC boundary as React state, not as something the
 * browser's own download machinery ever sees.
 *
 * `isCurrentSessionStaff()` (fix round 1's Minor): this path is nested
 * under /admin, so lib/supabase/proxy.ts's updateSession already gates it
 * to a signed-in staff session, and RLS backstops every table
 * `exportCustomer` reads regardless — a missing check here could only ever
 * produce an empty file, not a leak. Checked anyway, in-handler, rather
 * than resting entirely on the proxy never regressing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCurrentSessionStaff())) {
    return Response.json({ error: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  let blob: Blob;
  try {
    blob = await exportCustomer(id);
  } catch (error) {
    // exportCustomer throws rather than returning a partial Blob when any
    // table it reads fails (fix round 1's Important) — an export missing
    // rows is a false statement to the data subject it's made for. No
    // Content-Disposition here: this response must never be mistaken for
    // a completed download.
    console.error("[gdpr] export route: failed to build the export", { customerId: id, error });
    return Response.json(
      {
        error: "export-failed",
        message:
          "This export could not be completed — some of this customer's data failed to read. Nothing was downloaded.",
      },
      { status: 500 },
    );
  }

  return new Response(blob, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="customer-${id}.json"`,
    },
  });
}
