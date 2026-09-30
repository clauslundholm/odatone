/* The mobile app's signup body, turned into the FormData that
   submitSignup (app/actions.ts) already takes from the web form. Kept
   apart from the route handler so it runs under plain `node --test`,
   the same split lib/signup.ts makes from app/actions.ts.

   Nothing here validates a value. buildSignup (lib/signup.ts) is the one
   place a signup field is judged, for the web form and the app alike;
   this only decides which keys are allowed to reach it. */

/** A real signup is a few hundred characters. This is a ceiling on what
    gets parsed at all, not a field limit — those are buildSignup's. */
export const MAX_BODY_CHARS = 10_000;

/** The field names SignupFlow.tsx sends, minus the venue step's. A key
    that is not on this list never reaches submitSignup. */
const FIELDS = [
  "name",
  "company",
  "email",
  "cvr",
  "phone",
  "address",
  "postcode",
  "city",
  "planId",
  "billing",
  "locations",
  "ean",
  "po",
] as const;

export function parseAppSignup(raw: string): FormData | null {
  if (raw.length > MAX_BODY_CHARS) return null;

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;

  const record = body as Record<string, unknown>;
  const fd = new FormData();
  for (const key of FIELDS) {
    const value = record[key];
    if (typeof value === "string") fd.set(key, value);
    else if (typeof value === "number" && Number.isFinite(value)) fd.set(key, String(value));
  }
  /* The app has no card form. Set here rather than trusted from the
     body, so a hand-written request cannot claim otherwise. */
  fd.set("paymentMethod", "invoice");
  return fd;
}
