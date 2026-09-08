import { createHmac, timingSafeEqual } from "node:crypto";

/* Re-exported so server code has one import for the whole session concern. */
export { EDIT_COOKIE, HINT_COOKIE, SESSION_DAYS } from "./edit-cookies.ts";

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signSession(expiresAt: number, secret: string): string {
  const payload = String(expiresAt);
  return `${payload}.${mac(payload, secret)}`;
}

/** A session is valid only if the signature matches and it has not expired.
    No secret configured means no valid sessions — editing fails closed. */
export function verifySession(
  token: string | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!equal(signature, mac(payload, secret))) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function passwordMatches(candidate: string, secret: string | undefined): boolean {
  if (!secret || !candidate) return false;
  return equal(candidate, secret);
}
