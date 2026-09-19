/* Erasure anonymises rather than deletes. Danish bookkeeping law requires
   accounting records be kept five years, and an invoice with no customer is
   not a record of anything. The tombstone keeps the invoice attributable to a
   case without naming a person. Confirm with whoever owns compliance before
   launch — this is the reading the spec adopts, not settled advice. */
export function anonymisedCustomer(id: string): Record<string, string> {
  return {
    name: `Slettet kunde ${id}`,
    billing_email: `erased+${id}@odatone.invalid`,
    cvr: "",
    address: "",
    postcode: "",
    city: "",
  };
}
