import { Document, Font, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

import { ISSUER } from "./invoice-issuer";
import { formatDkk } from "./money";
import type { InvoiceLineDraft } from "./invoicing";

export type InvoicePdfInput = {
  number: string;
  issuedAt: string;
  dueAt: string;
  periodStart: string;
  periodEnd: string;
  customer: {
    name: string;
    cvr: string | null;
    address: string | null;
    postcode: string | null;
    city: string | null;
    country: string;
  };
  lines: InvoiceLineDraft[];
  subtotalOre: number;
  vatOre: number;
  totalOre: number;
};

/* Helvetica is built into react-pdf and covers æ, ø and å, so no font file
   needs shipping. Do not switch to a webfont without checking those three. */

/* react-pdf will not break a token with no space or hyphen in it, so a
   200-character SKU or URL in a description runs the full page width and is
   drawn on top of the amounts column — silently, because renderToBuffer does
   not fail on it. Chunking long tokens is what stops that. The callback is
   global, so short words are returned untouched: ordinary wrapping must be
   left exactly as it was. 36 characters is comfortably inside the ~50 that
   fit the 52%-wide description column at 10pt Helvetica. */
Font.registerHyphenationCallback((word) =>
  word.length > 36 ? (word.match(/.{1,36}/g) ?? [word]) : [word],
);

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#18181d" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#56565f" },
  row: { flexDirection: "row" },
  parties: { flexDirection: "row", justifyContent: "space-between", marginTop: 28, marginBottom: 28 },
  /* Fixed width with wrapping: a long company name must push its own block
     taller, never bleed into the amounts column beside it. */
  party: { width: "45%" },
  partyName: { fontFamily: "Helvetica-Bold", marginBottom: 3 },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#18181d", paddingBottom: 5, marginBottom: 5, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#e6e6eb" },
  cDesc: { width: "52%", paddingRight: 8 },
  cQty: { width: "10%", textAlign: "right" },
  cUnit: { width: "19%", textAlign: "right" },
  cAmt: { width: "19%", textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: "48%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: "#18181d", fontFamily: "Helvetica-Bold" },
  pay: { marginTop: 32, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#e6e6eb" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 28, fontSize: 8, color: "#8b8b95", textAlign: "center" },
});

const kr = (ore: number) => formatDkk(ore, "da");

function InvoiceDocument({ inv }: { inv: InvoicePdfInput }) {
  return (
    <Document title={`Faktura ${inv.number}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Faktura</Text>
        <Text style={s.muted}>Fakturanummer {inv.number}</Text>
        <Text style={s.muted}>Fakturadato {inv.issuedAt} · Betalingsfrist {inv.dueAt}</Text>
        <Text style={s.muted}>Periode {inv.periodStart} – {inv.periodEnd}</Text>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyName}>Sælger</Text>
            <Text>{ISSUER.legalName}</Text>
            <Text>{ISSUER.address}</Text>
            <Text>{ISSUER.postcode} {ISSUER.city}</Text>
            <Text>{ISSUER.country}</Text>
            <Text>CVR {ISSUER.cvr}</Text>
          </View>
          <View style={s.party}>
            <Text style={s.partyName}>Kunde</Text>
            <Text>{inv.customer.name}</Text>
            {inv.customer.address && <Text>{inv.customer.address}</Text>}
            <Text>{[inv.customer.postcode, inv.customer.city].filter(Boolean).join(" ")}</Text>
            <Text>{inv.customer.country}</Text>
            {inv.customer.cvr && <Text>CVR {inv.customer.cvr}</Text>}
          </View>
        </View>

        <View style={s.thead} fixed>
          <Text style={s.cDesc}>Beskrivelse</Text>
          <Text style={s.cQty}>Antal</Text>
          <Text style={s.cUnit}>Stykpris</Text>
          <Text style={s.cAmt}>Beløb</Text>
        </View>
        {inv.lines.map((l) => (
          <View style={s.tr} key={l.position} wrap={false}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cUnit}>{kr(l.unitOre)}</Text>
            <Text style={s.cAmt}>{kr(l.quantity * l.unitOre)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Subtotal</Text><Text>{kr(inv.subtotalOre)}</Text></View>
          <View style={s.totalRow}><Text>Moms 25%</Text><Text>{kr(inv.vatOre)}</Text></View>
          <View style={s.grand}><Text>I alt</Text><Text>{kr(inv.totalOre)}</Text></View>
        </View>

        <View style={s.pay}>
          <Text style={s.partyName}>Betaling</Text>
          <Text>Betales senest {inv.dueAt} til {ISSUER.bankName}.</Text>
          <Text>Reg. {ISSUER.bankReg} · Konto {ISSUER.bankAccount}</Text>
          <Text>IBAN {ISSUER.iban} · SWIFT {ISSUER.swift}</Text>
          <Text style={s.muted}>Anfør fakturanummer {inv.number} ved betaling.</Text>
        </View>

        <Text style={s.footer} fixed>
          {ISSUER.legalName} · CVR {ISSUER.cvr} · {ISSUER.email}
        </Text>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(inv: InvoicePdfInput): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument inv={inv} />);
}
