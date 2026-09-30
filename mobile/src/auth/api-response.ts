/* What POST /api/app/signup answered, read defensively. Pure, so the
   odd cases — an HTML error page, an empty body — are tested without a
   network. */

export type SignupResult =
  | { kind: "ok"; invited: boolean }
  | { kind: "errors"; errors: Record<string, string> }
  | { kind: "unreachable" };

const UNREACHABLE: SignupResult = { kind: "unreachable" };

export function readSignupResponse(status: number, body: string): SignupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* Not JSON at all: the route is not deployed (a 404 page), or
       something in front of it answered instead. */
    return UNREACHABLE;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return UNREACHABLE;

  const { ok, message, errors } = parsed as Record<string, unknown>;

  if (ok === true) {
    if (status !== 200) return UNREACHABLE;
    /* "no-invite": the account was created but the email could not be
       sent (submitSignup, app/actions.ts). */
    return { kind: "ok", invited: message !== "no-invite" };
  }

  if (ok === false && typeof errors === "object" && errors !== null) {
    const clean: Record<string, string> = {};
    for (const [field, code] of Object.entries(errors)) {
      if (typeof code === "string") clean[field] = code;
    }
    return Object.keys(clean).length > 0 ? { kind: "errors", errors: clean } : UNREACHABLE;
  }

  return UNREACHABLE;
}
