import { cookies } from "next/headers";

import {
  EDIT_COOKIE,
  HINT_COOKIE,
  SESSION_DAYS,
  passwordMatches,
  signSession,
  verifySession,
} from "@/lib/edit-session";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/* Guessing protection for a single shared password. Per-instance and
   deliberately simple: enough to make an online guessing attack impractical
   without pulling in a rate-limiting service. */
const attempts = new Map<string, { count: number; since: number }>();

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const seen = attempts.get(ip);
  if (!seen || now - seen.since > WINDOW_MS) {
    attempts.set(ip, { count: 1, since: now });
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_ATTEMPTS;
}

export async function GET() {
  const jar = await cookies();
  const editable =
    process.env.NODE_ENV === "development" ||
    verifySession(jar.get(EDIT_COOKIE)?.value, process.env.EDIT_PASSWORD);
  return Response.json({ editable });
}

export async function POST(request: Request) {
  const secret = process.env.EDIT_PASSWORD;
  if (!secret) {
    return Response.json({ error: "Editing is not configured" }, { status: 500 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(ip)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }

  let password: string | undefined;
  try {
    ({ password } = (await request.json()) as { password?: string });
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!passwordMatches(password ?? "", secret)) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const jar = await cookies();
  jar.set(EDIT_COOKIE, signSession(expiresAt, secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  /* Carries no authority: it only saves every other visitor a request. */
  jar.set(HINT_COOKIE, "1", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return Response.json({ ok: true });
}
