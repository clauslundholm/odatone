"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { landingFor, type Role } from "@/lib/tenancy";

/* GoTrue short-circuits an email with no matching row but runs a real bcrypt
   verify against one that exists, so a wrong password against a real
   account takes measurably longer than an unknown address -- ~94ms apart
   with zero overlap across five local trials (see task-9-report.md's
   Fix-round 1 section). Identical response bodies do not close that
   channel: an attacker who cannot tell two responses apart by content can
   still tell them apart by how long they took to arrive. Every return path
   below pays this same wall-clock floor before resolving, so the branches
   read as flat from outside. This doesn't make timing perfectly uniform --
   scheduler jitter and GC pauses still vary run to run -- but it removes
   the *reliable* signal an automated enumeration attempt needs. 800ms was
   chosen with generous headroom over the slowest branch measured locally
   (~200ms); see the report for before/after numbers. */
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
     enumeration hole above -- only someone who already holds working
     credentials for this address can ever reach them. PGRST116 is
     PostgREST's "no rows" code for .single(): a real account somehow
     missing its profiles row (Task 7 treats that the same way everywhere
     else -- denied, not silently let through). Any other error is a
     genuine service failure (an outage, a rate limit, ...), and reporting
     that as a credential problem would be its own kind of lie. */
  if (profileError && profileError.code !== "PGRST116") {
    console.error("signIn: failed to read profile role", profileError);
    await padTo(startedAt);
    return { error: "service" };
  }
  if (!profile) {
    await padTo(startedAt);
    return { error: "no-access" };
  }

  await padTo(startedAt);
  redirect(landingFor(profile.role as Role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
