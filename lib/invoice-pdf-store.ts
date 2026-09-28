import "server-only";

import { renderInvoicePdf, type InvoicePdfInput } from "./invoice-pdf";
import { createAdminClient } from "./supabase/admin";

/**
 * Renders an invoice and files it under `<customer_id>/<invoice_id>.pdf`.
 *
 * Returns null rather than throwing. By the time this runs the invoice row
 * already exists with a real number, and a number, once consumed, cannot be
 * given back — so a failure here must not unwind the invoice. A missing PDF
 * is recoverable (regenerate it); a gap in the numbering is not.
 */
export async function storeInvoicePdf(
  invoiceId: string,
  customerId: string,
  input: InvoicePdfInput,
): Promise<string | null> {
  const path = `${customerId}/${invoiceId}.pdf`;
  try {
    const pdf = await renderInvoicePdf(input);
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("invoices")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (error) {
      console.error("[odatone] invoice pdf: upload failed", { invoiceId, error });
      return null;
    }
    const { error: pathError } = await admin
      .from("invoices").update({ pdf_path: path }).eq("id", invoiceId);
    if (pathError) {
      console.error("[odatone] invoice pdf: stored but pdf_path not set", { invoiceId, error: pathError });
      return null;
    }
    return path;
  } catch (error) {
    /* Covers rendering, client construction, and anything the storage or
       PostgREST client throws rather than returns. Deliberately broad: the
       invoice already exists with a consumed number, so nothing here may
       escape as an exception. */
    console.error("[odatone] invoice pdf: could not render or store", { invoiceId, error });
    return null;
  }
}
