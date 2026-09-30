import { readSignupResponse, type SignupResult } from "./api-response.ts";
import { API_URL } from "./supabase";

/** Long enough for a cold serverless start plus the invite email; short
    enough that a dead connection does not leave the button spinning. */
const TIMEOUT_MS = 20_000;

/** Places the order. Never throws: every way this can fail to get an
    answer comes back as `unreachable`. */
export async function postSignup(payload: Record<string, string | number>): Promise<SignupResult> {
  if (!API_URL) return { kind: "unreachable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/app/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return readSignupResponse(res.status, await res.text());
  } catch {
    return { kind: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
