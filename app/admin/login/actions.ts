"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { landingFor, type Role } from "@/lib/tenancy";

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  /* One message for a wrong password and an unknown address alike: telling them
     apart turns the form into a way to discover who has an account. */
  if (error || !data.user) return { error: "invalid" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();
  if (!profile) return { error: "invalid" };

  redirect(landingFor(profile.role as Role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
