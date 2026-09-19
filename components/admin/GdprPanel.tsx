"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, buttonClass } from "@/components/ui/Button";
import { eraseCustomer } from "@/app/admin/customers/[id]/gdpr-actions";

const ERASE_ERRORS: Record<string, string> = {
  forbidden: "Only staff_admin can erase a customer's data.",
  "not-found": "This customer no longer exists.",
  erase: "Something went wrong erasing this customer. Try again in a moment.",
  audit: "The customer was erased, but recording it in the audit log failed. Tell an admin.",
};

/**
 * Task 15: export and erasure. Export is a plain `<a download>` to
 * ../export/route.ts, not a button wired to a handler — see that file's own
 * comment on why a Server Action's return value can't drive a browser
 * download directly.
 *
 * Erasure calls `eraseCustomer` (../gdpr-actions.ts) directly rather than
 * through `useActionState`/`<form action=...>`: that binding is for a
 * `(prevState, formData)` action, and `eraseCustomer`'s own signature —
 * `(id: string) => Promise<{ error?: string }>` — takes the id this
 * component already has as a prop, not a FormData a `<form>` would
 * serialise. `useTransition` gives the same pending/disabled behaviour
 * `useActionState` would have, for a function that isn't shaped like one.
 *
 * The typed-name confirmation is enforced here, in the client, by keeping
 * the button `disabled` until the input exactly matches `customerName` —
 * `eraseCustomer` itself takes no confirmation argument (see its own
 * signature, unchanged from the task's interface), so this is the only
 * gate standing between a misclick and an irreversible action. That is a
 * deliberate, narrow trade: the confirmation is a safeguard against staff
 * error, not a security boundary — the security boundary is
 * `currentStaffAdmin()` inside `eraseCustomer` itself, which a client-side
 * check can't be trusted to replace.
 */
export function GdprPanel({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmed = confirmText.trim().length > 0 && confirmText.trim() === customerName;

  function handleErase() {
    setError(null);
    startTransition(async () => {
      const result = await eraseCustomer(customerId);
      if (result.error) {
        setError(ERASE_ERRORS[result.error] ?? "Something went wrong erasing this customer.");
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[0.875rem] font-medium text-ink">Export this customer&rsquo;s data</h3>
          <p className="text-[0.8125rem] text-ink-2">
            Every row referencing this customer — their record, locations, users, subscription and invoices — as one
            JSON file.
          </p>
        </div>
        <a
          href={`/admin/customers/${customerId}/export`}
          download={`customer-${customerId}.json`}
          className={buttonClass("outline", "sm", "shrink-0")}
        >
          Export data
        </a>
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-bad/30 bg-bad-soft p-4">
        <div>
          <h3 className="text-[0.875rem] font-medium text-ink">Erase this customer</h3>
          <p className="text-[0.8125rem] text-ink-2">
            Replaces this customer&rsquo;s name, CVR, address, phone and email — and their locations&rsquo; own names and
            addresses — with a tombstone, cancels their subscription and deletes their users — they can no longer sign
            in. Their invoices are kept, unchanged, because Danish bookkeeping law requires accounting records to be
            kept for five years. This cannot be undone.
          </p>
        </div>

        {!done && (
          <label className="flex flex-col gap-2">
            <span className="u-label text-ink-2">
              Type <span className="font-mono normal-case text-ink">{customerName}</span> to confirm
            </span>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={customerName}
              disabled={pending}
              className="w-full max-w-sm rounded-[var(--radius-md)] border border-line bg-surface px-4 py-2.5 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="text-[0.8125rem] text-bad">
            {error}
          </p>
        )}
        {done && !error && (
          <p role="status" className="text-[0.8125rem] text-ok">
            Erased. This customer&rsquo;s personal data is gone; their invoices remain for the legally required period.
          </p>
        )}

        {!done && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="w-fit"
            onClick={handleErase}
            disabled={!confirmed || pending}
          >
            {pending ? "Erasing…" : "Erase customer"}
          </Button>
        )}
      </div>
    </div>
  );
}
