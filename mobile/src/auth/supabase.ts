import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False when the build has no Supabase values. createClient() throws on
    an empty URL, and a thrown error at import time is a white screen —
    so it is handed a placeholder instead, and AuthProvider checks this
    flag and reports a service error rather than calling a fake host. */
export const configured = url !== "" && anonKey !== "";

/** The website: POST /api/app/signup and the /my-odatone portal. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/** Named so sign-out can clear the stored session itself when the
    server cannot be asked to. */
export const AUTH_STORAGE_KEY = "odatone.auth.v1";

/* The anon key, never the service role: everything this client reads is
   decided by row-level security (supabase/migrations/0003_tenancy.sql),
   which lets a signed-in user see their own profile, customer and
   subscriptions and nothing else. */
export const supabase = createClient(configured ? url : "http://localhost", configured ? anonKey : "missing", {
  auth: {
    storage: AsyncStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    /* There is no URL to read a session from in a native app; leaving
       this on makes supabase-js look for window.location. */
    detectSessionInUrl: false,
  },
});
