"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buttonClass } from "@/components/ui/Button";
import { Field, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/admin/Modal";
import { issueInvoice, markInvoicePaid, voidInvoice } from "@/app/admin/customers/[id]/invoice-actions";
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

/** `startIso` (`YYYY-MM-DD`) plus `months`, as UTC calendar-month
    arithmetic — the same approach `defaultPeriod` uses for "today", pulled
    out so `defaultPeriod` and the dialog's own period-length check
    (`periodMismatch`, below) can't compute "one term later" two different
    ways. Returns null for an unparseable `startIso` rather than NaN
    propagating into a silently wrong date. */
function addMonthsIso(startIso: string, months: number): string | null {
  const start = new Date(`${startIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  return isoDate(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate())));
}

/** Today, plus one billing term. `monthly` gets a month, `annual` gets
    twelve — the same "months" issue_invoice's caller (buildInvoiceLines,
    lib/invoicing.ts) already multiplies an annual rate by. Uses UTC month
    arithmetic so a customer's local timezone can never roll the result
    onto the wrong day. */
export function defaultPeriod(billing: Billing, today: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startIso = isoDate(start);
  return { start: startIso, end: addMonthsIso(startIso, billing === "annual" ? 12 : 1) ?? startIso };
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
 * closes the dialog once the action reports the ordinary `ok: true` —
 * never optimistically. `ok: true, message: "no-pdf"` is also a genuine
 * success (the invoice exists and is numbered; see invoice-actions.ts's
 * own comment on why a storage failure must never unwind it) but is
 * deliberately *not* treated the same: it is the one outcome where staff
 * are left holding something that needs a follow-up (regenerating the
 * PDF), so the form below stays open with an explicit warning and Close
 * button instead of vanishing like every other successful submit.
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

  // storeInvoicePdf fails soft (invoice-actions.ts's own comment: a numbered
  // invoice must never be rolled back for a storage hiccup), so `ok: true`
  // covers two different outcomes. Only the happy one closes the dialog —
  // "no-pdf" means real money now exists on the ledger with no archived
  // document behind it, which is exactly the state a silent close would
  // hide from the one person who could still do anything about it.
  const issuedWithoutPdf = state.ok && state.message === "no-pdf";

  useEffect(() => {
    if (state.ok && state.message !== "no-pdf") onIssued();
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

  // The amount is priced from plan/term/locations alone (lib/invoicing.ts's
  // buildInvoiceLines) — period length never enters it, so a staff member
  // free-typing a period could set a monthly customer's period to three
  // months, get a line still reading "monthly", and incidentally slip past
  // invoices_customer_period_uq's per-period lock for a second, overlapping
  // invoice. Not blocked — a part-period invoice for a customer joining
  // mid-month is legitimate — just surfaced, with a three-day tolerance for
  // the ordinary case of nudging a date by a day or two.
  const periodMismatch = useMemo(() => {
    const expectedEnd = addMonthsIso(periodStart, billing === "annual" ? 12 : 1);
    if (!expectedEnd) return false;
    const actual = Date.parse(`${periodEnd}T00:00:00Z`);
    const expected = Date.parse(`${expectedEnd}T00:00:00Z`);
    if (Number.isNaN(actual) || Number.isNaN(expected)) return false;
    return Math.abs(actual - expected) / 86_400_000 > 3;
  }, [periodStart, periodEnd, billing]);

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
          disabled={issuedWithoutPdf}
          required
        />
        <Field
          label="Period end"
          name="periodEnd"
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          disabled={issuedWithoutPdf}
          required
        />
      </div>

      {!issuedWithoutPdf && preview && periodMismatch && (
        <p role="status" className="text-[0.8125rem] text-warn">
          This period is not one {billing === "annual" ? "annual" : "monthly"} term. The amount does not change with
          the period length.
        </p>
      )}

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
        disabled={issuedWithoutPdf}
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

      {issuedWithoutPdf ? (
        <>
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-warn/30 px-4 py-3 text-[0.8125rem] text-ink"
            style={{ backgroundColor: "color-mix(in srgb, var(--c-warn) 10%, transparent)" }}
          >
            Invoice issued, but its PDF could not be stored. The invoice is valid; the document can be regenerated.
          </p>
          <button type="button" onClick={onIssued} className={buttonClass("outline", "sm", "self-start")}>
            Close
          </button>
        </>
      ) : (
        <button type="submit" disabled={pending || !preview} className={buttonClass("primary", "sm", "self-start")}>
          {pending ? "Issuing…" : "Issue invoice"}
        </button>
      )}
    </form>
  );
}

/** Every code markInvoicePaid (../[id]/invoice-actions.ts) can return in
    `errors.form`. "void" reads oddly as a Record key but matches the
    literal error string the action returns for that refusal. */
const MARK_PAID_ERRORS: Record<string, string> = {
  forbidden: "Only staff can mark invoices paid.",
  invalid: "That invoice could not be found.",
  "already-paid": "This invoice is already marked paid.",
  void: "A voided invoice cannot be marked paid.",
  conflict: "This invoice changed elsewhere. Reload the page and try again.",
  service: "Something went wrong marking this invoice paid. Try again in a moment.",
};

const PAYMENT_METHOD_ERRORS: Record<string, string> = {
  invalid: "Choose how this invoice was paid.",
};

/**
 * The "Mark paid" button on one invoice row, and the dialog it opens.
 *
 * Same shape as `IssueInvoiceDialog` above: a trigger button with its own
 * ref, a `Modal`, and a form driven by `useActionState` that closes on the
 * ordinary `ok: true` — there is no partial-success outcome here the way
 * `issueInvoice`'s "no-pdf" is, so every `ok: true` closes the dialog.
 */
export function MarkPaidDialog({ invoiceId, number }: { invoiceId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={buttonClass("outline", "sm")}>
        Mark paid
      </button>
      <Modal open={open} onClose={close} title={`Mark ${number} paid`} trigger={triggerRef}>
        <MarkPaidForm invoiceId={invoiceId} onPaid={close} />
      </Modal>
    </>
  );
}

function MarkPaidForm({ invoiceId, onPaid }: { invoiceId: string; onPaid: () => void }) {
  const [state, formAction, pending] = useActionState(markInvoicePaid, INITIAL_STATE);

  useEffect(() => {
    if (state.ok) onPaid();
  }, [state, onPaid]);

  const formError = !state.ok ? state.errors.form : undefined;
  const paymentMethodError = !state.ok ? state.errors.paymentMethod : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <label className="flex flex-col gap-2">
        <span className="u-label text-ink-2">Payment method</span>
        <select
          name="paymentMethod"
          defaultValue="bank_transfer"
          aria-invalid={paymentMethodError ? true : undefined}
          className={`w-full rounded-[var(--radius-md)] border bg-surface px-4 py-3 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)] ${paymentMethodError ? "border-warn" : "border-line"}`}
        >
          <option value="bank_transfer">Bank transfer</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
        {paymentMethodError && (
          <span className="text-[0.8125rem] text-warn">
            {PAYMENT_METHOD_ERRORS[paymentMethodError] ?? paymentMethodError}
          </span>
        )}
      </label>

      <Field label="Payment reference" name="paymentReference" hint="optional" type="text" />

      {formError && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {MARK_PAID_ERRORS[formError] ?? "Something went wrong marking this invoice paid."}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary", "sm", "self-start")}>
        {pending ? "Saving…" : "Mark paid"}
      </button>
    </form>
  );
}

/** Every code voidInvoice (../[id]/invoice-actions.ts) can return in
    `errors.form`. */
const VOID_ERRORS: Record<string, string> = {
  forbidden: "Only staff can void invoices.",
  invalid: "That invoice could not be found.",
  "already-void": "This invoice is already void.",
  paid: "A paid invoice cannot be voided directly — that needs a credit note.",
  conflict: "This invoice changed elsewhere. Reload the page and try again.",
  service: "Something went wrong voiding this invoice. Try again in a moment.",
};

const VOID_REASON_ERRORS: Record<string, string> = {
  required: "Enter a reason for voiding this invoice.",
};

/**
 * The "Void" button on one invoice row, and the dialog it opens.
 *
 * Same shape as `MarkPaidDialog` above. `voidInvoice` rejects a blank or
 * whitespace-only reason itself, before the database's own
 * `invoices_void_reason_ck` (0010_invoice_lines.sql) has to — so the reason
 * field is `required` here for the ordinary case, but the server action is
 * still what actually enforces it against a crafted or JS-disabled submit.
 */
export function VoidInvoiceDialog({ invoiceId, number }: { invoiceId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={buttonClass("danger", "sm")}>
        Void
      </button>
      <Modal open={open} onClose={close} title={`Void ${number}`} trigger={triggerRef}>
        <VoidInvoiceForm invoiceId={invoiceId} onVoided={close} />
      </Modal>
    </>
  );
}

function VoidInvoiceForm({ invoiceId, onVoided }: { invoiceId: string; onVoided: () => void }) {
  const [state, formAction, pending] = useActionState(voidInvoice, INITIAL_STATE);

  useEffect(() => {
    if (state.ok) onVoided();
  }, [state, onVoided]);

  const formError = !state.ok ? state.errors.form : undefined;
  const voidReasonError = !state.ok ? state.errors.voidReason : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <p className="text-[0.8125rem] text-ink-2">
        Voiding cannot be undone. The invoice stays on record, marked void, and its number is never reused.
      </p>

      <TextField
        label="Reason"
        name="voidReason"
        error={voidReasonError ? (VOID_REASON_ERRORS[voidReasonError] ?? voidReasonError) : undefined}
        required
      />

      {formError && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {VOID_ERRORS[formError] ?? "Something went wrong voiding this invoice."}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass("danger", "sm", "self-start")}>
        {pending ? "Voiding…" : "Void invoice"}
      </button>
    </form>
  );
}
