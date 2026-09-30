/* What can go wrong when talking to Supabase Auth, reduced to the five
   things the app has a sentence for. Pure: takes the two fields of a
   supabase-js AuthError that matter, so it runs under `node --test`. */

export type AuthErrorCode = "invalid" | "code" | "weak" | "rate" | "service";
export type AuthResult = { ok: true } | { ok: false; error: AuthErrorCode };

/** Which email a code came from, which is also the `type` verifyOtp
    needs: the signup invite, a re-sent sign-in code, or a password reset. */
export type CodeKind = "invite" | "email" | "recovery";

/** The website's own minimum (lib/use-invite-fragment.ts). */
export const MIN_PASSWORD = 8;

/** Phone keyboards capitalise the first letter and add a space after an
    autocompleted address. The server lower-cases on its side
    (lib/signup.ts), so an address that differs only by case or a space
    must be the same address here too. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

type Failure = { code?: string; status?: number };

const RATE_CODES = ["over_email_send_rate_limit", "over_request_rate_limit"];

function isRate(f: Failure): boolean {
  return f.status === 429 || (f.code !== undefined && RATE_CODES.includes(f.code));
}

/** supabase-js reports a request that never got an answer as status 0,
    or with no status at all. */
function isOutage(f: Failure): boolean {
  return f.status === undefined || f.status === 0 || f.status >= 500;
}

/** Deliberately one answer for a wrong password and an unknown address,
    the same as the website's login (see lib/content/portal.ts). */
export function signInError(f: Failure): AuthErrorCode {
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  return "invalid";
}

export function codeError(f: Failure): AuthErrorCode {
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  return "code";
}

/** null means "not an error": choosing the password you already had is
    fine, the customer is in either way. */
export function passwordError(f: Failure): AuthErrorCode | null {
  if (f.code === "same_password") return null;
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  if (f.code === "weak_password" || f.status === 422) return "weak";
  return "service";
}

/** For "send me a code". Any refusal that would tell a stranger whether
    the address has an account is swallowed; only a rate limit or an
    outage is worth saying out loud. */
export function sendError(f: Failure): AuthErrorCode | null {
  if (isRate(f)) return "rate";
  if (isOutage(f)) return "service";
  return null;
}

/** A code is single-use. If it was accepted but saving the password then
    failed, the customer is already signed in, and asking them for the
    code again would fail every time — so the second attempt skips
    straight to saving the password. */
export function shouldVerifyCode(sessionEmail: string | null, email: string): boolean {
  return sessionEmail === null || normalizeEmail(sessionEmail) !== normalizeEmail(email);
}
