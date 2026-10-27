import { INVOICE_STATUS_LABEL, localizeStatus } from "@/lib/content/portal";
import { v4 as t } from "@/lib/content/v4";
import { pct } from "@/lib/format";
import { href, type Locale } from "@/lib/i18n";
import { formatDkk } from "@/lib/money";
import { VAT_PCT } from "@/lib/pricing";
import { longDate, priceExVat, shortDate, vatAmount, type Account } from "@/lib/v4/account";
import { Empty, Field, Panel, PanelLink, Pill, TablePanel, Td, Th, Tr, tone } from "./Parts";

export type AccountInvoice = {
  id: string;
  number: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  totalOre: number;
  status: string;
  /** Null for every invoice with no archived document: the "no-pdf"
      outcome storeInvoicePdf (lib/invoice-pdf-store.ts) deliberately
      fails soft into, and every row predating invoice storage. The row
      withholds the download link rather than sending the customer to the
      PDF route's 409 JSON body. */
  pdfPath: string | null;
};

/**
 * The status a row actually displays. An `open` invoice whose `due_at`
 * has passed reads as "overdue" — computed here, from `due_at < now`,
 * and never written back to `invoices.status`. The identical rule
 * app/admin/billing/page.tsx applies, deliberately the same computation
 * rather than a second one: "overdue" must not grow two definitions.
 *
 * `now` is threaded in, not read per row, so every row on one render is
 * judged against the same instant.
 */
function displayStatus(row: AccountInvoice, now: Date): string {
  if (row.status === "open" && row.dueAt && new Date(row.dueAt) < now) return "overdue";
  return row.status;
}

/** "1. okt – 31. okt 2026". The long form set the column wide enough to
    push the status and the download link out of the card on a laptop,
    and a billing period is read as a span rather than as two dates. */
function period(from: string | null, to: string | null, l: Locale): string {
  if (!from && !to) return "—";
  return `${from ? shortDate(from, l) : "—"} – ${to ? shortDate(to, l) : "—"}`;
}

/** Fakturering: what the subscription costs, how it is paid, and every
    invoice issued so far. */
export function Billing({
  locale: l,
  account,
  invoices,
}: {
  locale: Locale;
  account: Account;
  invoices: AccountInvoice[];
}) {
  const a = t.account;
  const { plan, subscription } = account;
  const now = new Date();
  const vat = vatAmount(account, l);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title={a.plan.panel[l]}
          action={<PanelLink href={href(l, "contact")}>{a.plan.change[l]}</PanelLink>}
        >
          {plan && subscription ? (
            <dl className="grid gap-5 sm:grid-cols-3">
              <Field label={a.plan.plan[l]}>{plan.name}</Field>
              <Field label={a.plan.billing[l]}>
                {subscription.billing === "annual" ? a.plan.annual[l] : a.plan.monthly[l]}
              </Field>
              <Field label={a.plan.price[l]}>
                <span className="u-tabular">{priceExVat(account, l)}</span>
              </Field>
              <Field label={a.plan.renews[l]}>{longDate(subscription.currentPeriodEnd, l)}</Field>
              <Field label={a.plan.vat[l]}>
                <span className="u-tabular">
                  {vat
                    ? a.plan.vatValue[l].replace("{pct}", pct(VAT_PCT, l)).replace("{amount}", vat)
                    : "—"}
                </span>
              </Field>
            </dl>
          ) : (
            <p className="text-[0.9375rem] leading-relaxed text-ink-2">{a.plan.none[l]}</p>
          )}
        </Panel>

        {/* The design draws a stored card ending 4242. There is none: no
            payment provider is connected (components/signup/SignupFlow.tsx
            says the same about the card it collects and never charges),
            so this panel states how the money actually moves instead of
            inventing four digits a customer would go looking for. */}
        <Panel title={a.payment.panel[l]}>
          <div className="flex flex-col gap-2">
            <p className="text-[1.0625rem] font-semibold text-ink">{a.payment.none[l]}</p>
            <p className="text-[0.875rem] leading-relaxed text-ink-2">{a.payment.noneNote[l]}</p>
            <p className="truncate text-[0.875rem] text-ink-3">
              {a.payment.sentTo[l].replace("{email}", account.customer.billingEmail)}
            </p>
          </div>
        </Panel>
      </div>

      {invoices.length === 0 ? (
        <Empty title={a.invoices.emptyHeading[l]} body={a.invoices.emptyBody[l]} />
      ) : (
        <TablePanel title={a.invoices.panel[l]}>
          <thead>
            <tr>
              <Th>{a.invoices.number[l]}</Th>
              <Th>{a.invoices.period[l]}</Th>
              <Th>{a.invoices.due[l]}</Th>
              <Th right>{a.invoices.amount[l]}</Th>
              <Th>{a.invoices.status[l]}</Th>
              <Th right>
                <span className="sr-only">{a.invoices.download[l]}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((row) => {
              const status = displayStatus(row, now);
              return (
                <Tr key={row.id}>
                  <Td>
                    <span className="u-tabular">{row.number}</span>
                  </Td>
                  <Td muted>
                    {period(row.periodStart, row.periodEnd, l)}
                  </Td>
                  <Td muted>{row.dueAt ? shortDate(row.dueAt, l) : "—"}</Td>
                  <Td right>
                    <span className="u-tabular">{formatDkk(row.totalOre, l)}</span>
                  </Td>
                  <Td>
                    <Pill tone={tone(status)}>{localizeStatus(INVOICE_STATUS_LABEL, status, l)}</Pill>
                  </Td>
                  {/* The link only exists where the document does. An
                      invoice whose PDF was never stored has a null
                      pdf_path, and offering a download for it sent the
                      customer to the PDF route's raw
                      `{"error":"pdf-not-ready"}` JSON, in English, off a
                      bilingual page. A localised line says so instead. */}
                  <Td right>
                    {row.pdfPath ? (
                      <a
                        href={`/api/invoices/${row.id}/pdf`}
                        className="text-[0.8125rem] font-medium text-accent underline-offset-2 hover:underline"
                        aria-label={`${a.invoices.download[l]} ${row.number}`}
                      >
                        {a.invoices.download[l]}
                      </a>
                    ) : (
                      <span className="text-[0.8125rem] text-ink-3">{a.invoices.notReady[l]}</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TablePanel>
      )}

      <p className="max-w-[80ch] text-[0.8125rem] leading-relaxed text-ink-3">
        {a.invoices.note[l].replace("{email}", account.customer.billingEmail)}
      </p>
    </div>
  );
}
