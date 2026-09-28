import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** How long a minted download link stays good for. Short on purpose: this
    URL is handed to the browser as a redirect target, used once, and
    discarded -- it never needs to outlive the request that asked for it. */
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * The entire authorisation boundary for invoice PDFs. The `invoices` bucket
 * (0013_invoice_storage.sql) is private and no storage RLS policy is relied
 * on -- this route is the only thing standing between a request and the
 * document, which is why the read below goes through the *session* client
 * rather than straight to storage.
 *
 * `invoices_read` (0003_tenancy.sql) already admits the owning customer and
 * any staff member and nobody else, so a plain `select` here, under RLS, is
 * the whole check: a row comes back for a caller entitled to see it, and no
 * row comes back for anyone else. A request for someone else's invoice is
 * therefore indistinguishable from a request for an invoice that doesn't
 * exist -- both answer 404. Answering 403 instead would tell a stranger the
 * id is real, which is exactly the fact this route must not leak.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    /* A malformed id fails the uuid cast (PostgREST 22P02) and is genuinely
       "no such invoice" -- same 404 a mismatched-tenant id gets under RLS,
       neither may say more. Anything else here -- an unreachable database, a
       PostgREST 5xx, a rejected token -- is a fault, not a miss: answering
       404 for it would make an outage indistinguishable from a missing
       invoice, and invisible in the logs, since nothing else here would
       report it. A 500 leaks no more about whether the invoice exists than
       the 404 already does. */
    if (error.code === "22P02") {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    console.error("[odatone] invoice pdf: failed to read the invoice", { id, error });
    return NextResponse.json({ error: "service" }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  /* storeInvoicePdf (lib/invoice-pdf-store.ts) returns null, rather than
     throwing, precisely so a failed render/upload leaves a numbered invoice
     with no pdf_path instead of an invoice that never existed. That is a
     known, recoverable state -- not this route's problem to fix -- so it is
     reported plainly and must never fall through to a 500. */
  if (!invoice.pdf_path) {
    return NextResponse.json(
      { error: "pdf-not-ready", message: "This invoice's PDF is still being generated. Try again shortly." },
      { status: 409 },
    );
  }

  /* Constructed only now that the session client's read above has already
     succeeded under RLS. This client bypasses every policy in
     0003_tenancy.sql, so nothing from here on is protected by them -- the
     check above is the only thing standing between a stranger and the
     document.

     Wrapped in a try/catch because createAdminClient throws outright when
     the service-role key is unset (lib/supabase/admin.ts) -- the one place
     on this boundary that would otherwise escape as an unhandled 500
     instead of the shaped one every other failure on this path returns. */
  try {
    const admin = createAdminClient();
    const { data: signed, error: signError } = await admin.storage
      .from("invoices")
      .createSignedUrl(invoice.pdf_path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error("[odatone] invoice pdf: could not sign url", { invoiceId: id, error: signError });
      return NextResponse.json({ error: "service" }, { status: 500 });
    }

    /* This redirect's Location carries a 60-second credential. A 307 is not
       cacheable by default and Next already sets private, no-store headers
       on a dynamic response, but that credential's non-reuse should not
       rest on framework and CDN defaults alone -- so it is set here,
       explicitly, on the response itself. */
    return NextResponse.redirect(signed.signedUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[odatone] invoice pdf: could not construct the admin client or sign", { invoiceId: id, error });
    return NextResponse.json({ error: "service" }, { status: 500 });
  }
}
