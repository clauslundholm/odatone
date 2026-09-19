"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { landingFor, type Role } from "@/lib/tenancy";

/* Same action shape as app/admin/login/actions.ts (Task 9), and the same
   two security properties apply for the identical reason: GoTrue
   short-circuits an email with no matching row but runs a real bcrypt
   verify against one that exists, so a wrong password against a real
   account takes measurably longer than an unknown address. Every return
   path below pays the same wall-clock floor before resolving, so the
   branches read as flat from outside — see that file's own comment for
   the measured before/after numbers, which apply here unchanged since
   it's the same GoTrue instance and the same signInWithPassword call.

   Messages are intentionally NOT decided here: this file returns only a
   short, locale-agnostic code ("invalid" / "no-access" / "service"), and
   LoginForm.tsx maps it through lib/content/portal.ts using whichever
   locale the visitor already has — the server action has no reliable way
   to know that without adding a round-trip, and doesn't need to. */
const MIN_RESPONSE_MS = 800;

async function padTo(startedAt: number) {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function signIn(_prev: unknown, formData: FormData) {
  const startedAt = Date.now();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  /* One message for a wrong password and an unknown address alike: telling them
     apart turns the form into a way to discover who has an account. */
  if (error || !data.user) {
    await padTo(startedAt);
    return { error: "invalid" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();

  /* Past this point the caller has already proved a valid password, so
     distinguishing these branches from "wrong password" cannot reopen the
     enumeration hole above — only someone who already holds working
     credentials for this address can ever reach them. PGRST116 is
     PostgREST's "no rows" code for .single(): a real account somehow
     missing its profiles row. Any other error is a genuine service
     failure. */
  if (profileError && profileError.code !== "PGRST116") {
    console.error("my-odatone signIn: failed to read profile role", profileError);
    await padTo(startedAt);
    return { error: "service" };
  }
  if (!profile) {
    await padTo(startedAt);
    return { error: "no-access" };
  }

  /* landingFor, not a hard-coded "/my-odatone": a staff credential typed
     into the customer door lands on /admin, not on a portal that would
     404 them straight back out — the same behaviour app/admin/login's
     own signIn already gives a customer who wanders in through its door. */
  await padTo(startedAt);
  redirect(landingFor(profile.role as Role));
}
