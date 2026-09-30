import { NextResponse } from "next/server";

import { submitSignup } from "@/app/actions";
import { parseAppSignup } from "@/lib/app-signup";
import type { ActionResult } from "@/lib/forms";

/* The mobile app's way in to the same signup the web form runs. A native
   app cannot call a server action, and it cannot do this work itself:
   creating a customer needs the service role (see submitSignup's own
   comment), which never leaves the server.

   No session is read and none is needed — signing up is what an anonymous
   visitor does. Everything the body can influence is validated by
   buildSignup inside submitSignup, exactly as for the web form. */
export async function POST(request: Request) {
  const invalid: ActionResult = { ok: false, errors: { form: "invalid" } };

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json(invalid, { status: 400 });
  }

  const formData = parseAppSignup(raw);
  if (!formData) return NextResponse.json(invalid, { status: 400 });

  try {
    return NextResponse.json(await submitSignup(formData));
  } catch (err) {
    console.error("[odatone] app signup failed unexpectedly", err);
    const failed: ActionResult = { ok: false, errors: { form: "server" } };
    return NextResponse.json(failed, { status: 500 });
  }
}
