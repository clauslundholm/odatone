"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buttonClass } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/admin/Modal";
import { issueInvoice } from "@/app/admin/customers/[id]/invoice-actions";
import type { ActionResult } from "@/lib/forms";
import { ISSUER, ISSUER_IS_PLACEHOLDER } from "@/lib/invoice-issuer";
import { buildInvoiceLines, lineTotals, type InvoiceLineDraft } from "@/lib/invoicing";
import { formatDkk } from "@/lib/money";
import { VAT_PCT, type Billing, type Plan } from "@/lib/pricing";

const INITIAL_STATE: ActionResult = { ok: false, errors: {} };

/** Every code issueInvoice (../[id]/invoice-actions.ts) can return in
    `errors.form`, mapped to what staff actually read. "duplicate-period"
    is the P0104 path from issue_invoice (supabase/migrations/0012) —
    worded the same way the brief asked for, not as a raw SQLSTATE. */
const FORM_ERRORS: Record<string, string> = {
  forbidden: "Only staff can issue invoices.",
  invalid: "Check the period dates and try again.",
  "no-subscription": "This customer has no billable subscription.",
  "no-locations": "This customer has no locations to invoice.",
  "duplicate-period": "This customer already has an invoice for this period.",
  service: "Something went wrong issuing this invoice. Try again in a moment.",
};

const DUE_DAYS_ERRORS: Record<string, string> = {
  invalid: "Enter a whole number of days between 0 and 365.",
};

/** Formats an ISO date as an `<input type="date">` value expects it
    (`YYYY-MM-DD`) — a plain slice, since every date this dialog handles is
    already a calendar date with no time-of-day component. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today, plus one billing term. `monthly` gets a month, `annual` gets
    twelve — the same "months" issue_invoice's caller (buildInvoiceLines,
    lib/invoicing.ts) already multiplies an annual rate by. Uses UTC month
    arithmetic so a customer's local timezone can never roll the result
    onto the wrong day. */
export function defaultPeriod(billing: Billing, today: Date = new Date()): { start: string; end: string } {
  const months = billing === "annual" ? 12 : 1;
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
  return { start: isoDate(start), end: isoDate(end) };
}

/**
 * The button on the customer page's invoice section that opens the issue
 * dialog, and the dialog itself.
 *
 * `plan`, `billing` and `locationCount` come from the server page as
 * props — they are exactly what the page already resolved (via
 * `resolvePlan`/`planMap`, lib/admin/plans.ts) to price this customer's
 * subscription elsewhere on the same page, so this dialog prices the
 * preview from the same numbers rather than re-fetching and risking the
 * two disagreeing.
 *
 * Follows components/admin/ProductsBoxes.tsx's shape: a trigger button
 * with its own ref (so focus returns to it on close, per Modal's own
 * contract), a Modal, and a form inside driven by useActionState that
 * closes the dialog once the action actually reports `ok: true` — never
 * optimistically, and never on the "no-pdf" fallback message alone, which
 * *is* a success (see invoice-actions.ts's own return).
 */
export function IssueInvoiceDialog({
  customerId,
  plan,
  billing,
  locationCount,
}: {
  customerId: string;
  plan: Plan;
  billing: Billing;
  locationCount: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "sm")}>
        Issue invoice
      </button>
      <Modal open={open} onClose={close} title="Issue invoice" trigger={triggerRef}>
        <IssueInvoiceForm
          customerId={customerId}
          plan={plan}
          billing={billing}
          locationCount={locationCount}
          onIssued={close}
        />
      </Modal>
    </>
  );
}

function IssueInvoiceForm({
  customerId,
  plan,
  billing,
  locationCount,
  onIssued,
}: {
  customerId: string;
  plan: Plan;
  billing: Billing;
  locationCount: number;
  onIssued: () => void;
}) {
  const [state, formAction, pending] = useActionState(issueInvoice, INITIAL_STATE);

  // Computed once, on mount, from "today" — not re-derived on every
  // render, or a dialog left open across midnight would keep sliding its
  // own defaults out from under whatever staff had already typed.
  const [defaults] = useState(() => defaultPeriod(billing));
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [dueDays, setDueDays] = useState<number>(ISSUER.paymentTermsDays);

  useEffect(() => {
    if (state.ok) onIssued();
  }, [state, onIssued]);

  // The exact function the action calls server-side (lib/invoicing.ts is
  // pure and carries no server-only import), so what staff see here is
  // what gets written — not a second, hand-rolled approximation of the
  // same arithmetic that could silently drift from it.
  const preview: { lines: InvoiceLineDraft[]; totals: ReturnType<typeof lineTotals> } | null = useMemo(() => {
    try {
      const lines = buildInvoiceLines({ plan, billing, locations: locationCount, periodStart, periodEnd });
      return { lines, totals: lineTotals(lines) };
    } catch {
      return null;
    }
  }, [plan, billing, locationCount, periodStart, periodEnd]);

  const formError = !state.ok ? state.errors.form : undefined;
  const dueDaysError = !state.ok ? state.errors.dueDays : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="customerId" value={customerId} />

      {ISSUER_IS_PLACEHOLDER && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-warn/30 px-4 py-3 text-[0.8125rem] text-ink"
          style={{ backgroundColor: "color-mix(in srgb, var(--c-warn) 10%, transparent)" }}
        >
          Odatone&rsquo;s own CVR, address and bank details are still placeholders — this invoice&rsquo;s PDF will not
          be a valid Danish invoice.
        </p>
      )}

      <p className="text-[0.8125rem] text-ink-2">
        {plan.name} · {billing === "annual" ? "Annual" : "Monthly"} · {locationCount}{" "}
        {locationCount === 1 ? "location" : "locations"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Period start"
          name="periodStart"
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          required
        />
        <Field
          label="Period end"
          name="periodEnd"
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          required
        />
      </div>

      <Field
        label="Due in"
        name="dueDays"
        hint="days"
        type="number"
        min={0}
        max={365}
        value={dueDays}
        onChange={(e) => setDueDays(Number(e.target.value))}
        error={dueDaysError ? (DUE_DAYS_ERRORS[dueDaysError] ?? dueDaysError) : undefined}
        required
      />

      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line bg-surface-2/50 p-4">
        <h3 className="u-label text-ink-2">Preview</h3>
        {preview ? (
          <>
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="text-ink-2">
                  <th className="py-1 font-medium">Description</th>
                  <th className="py-1 text-right font-medium">Qty</th>
                  <th className="py-1 text-right font-medium">Unit price</th>
                  <th className="py-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.position} className="border-t border-line">
                    <td className="py-1.5 pr-2 text-ink">{line.description}</td>
                    <td className="u-tabular py-1.5 text-right text-ink-2">{line.quantity}</td>
                    <td className="u-tabular py-1.5 text-right text-ink-2">{formatDkk(line.unitOre, "en")}</td>
                    <td className="u-tabular py-1.5 text-right text-ink">
                      {formatDkk(line.quantity * line.unitOre, "en")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="flex flex-col gap-1 border-t border-line pt-2 text-[0.8125rem]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="u-tabular text-ink">{formatDkk(preview.totals.subtotalOre, "en")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">VAT ({VAT_PCT}%)</dt>
                <dd className="u-tabular text-ink">{formatDkk(preview.totals.vatOre, "en")}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt className="text-ink">Total</dt>
                <dd className="u-tabular text-ink">{formatDkk(preview.totals.totalOre, "en")}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-[0.8125rem] text-ink-2">Enter a period end after the period start to preview this invoice.</p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {FORM_ERRORS[formError] ?? "Something went wrong issuing this invoice."}
        </p>
      )}

      <button type="submit" disabled={pending || !preview} className={buttonClass("primary", "sm", "self-start")}>
        {pending ? "Issuing…" : "Issue invoice"}
      </button>
    </form>
  );
}
