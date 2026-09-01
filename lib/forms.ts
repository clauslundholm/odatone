/** Shared form shapes. Kept out of app/actions.ts, where "use server"
 *  only permits async function exports. */

export type FieldErrors = Record<string, string>;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; errors: FieldErrors };

export type SalesLead = {
  name: string;
  company: string;
  email: string;
  phone: string;
  locations: string;
  message: string;
};

export type SignupSubmission = {
  name: string;
  company: string;
  cvr: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  planId: string;
  billing: string;
  locations: number;
  venueType: string;
  m2: number;
  paymentMethod: "card" | "invoice";
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function digits(value: string): string {
  return value.replace(/\D/g, "");
}
