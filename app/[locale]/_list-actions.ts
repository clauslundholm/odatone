"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/forms";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { GENRES, isLang, type Genre, type Lang } from "@/lib/tracks";
import { listHref } from "@/lib/v4/account-routes";
import { createClient } from "@/lib/supabase/server";

/* The bounds the table itself enforces (0015_playlists_and_schedule.sql):
   a name of 1–80 characters after trimming, BPM between 0 and 300 with
   the low end strictly below the high. Checked here as well so a bad
   value comes back as a field error on the form rather than as a
   constraint violation the visitor cannot read. */
const NAME_MAX = 80;
const BPM_FLOOR = 0;
const BPM_CEIL = 300;

const GENRE_IDS = new Set<string>(GENRES.map((g) => g.id));

type Rules = {
  genres: Genre[];
  bpm_low: number;
  bpm_high: number;
  vox: boolean | null;
  langs: Lang[];
};

/** The rule fields, read off whichever form sent them. Unknown genre ids
    are dropped rather than rejected: they can only come from a stale tab
    or a hand-made request, and an empty genre list is a legitimate
    "every genre", so there is nothing a visitor could usefully be told. */
function parseRules(formData: FormData): Rules | { error: string } {
  const genres = formData
    .getAll("genre")
    .map(String)
    .filter((g) => GENRE_IDS.has(g)) as Genre[];

  const low = Number(formData.get("bpmLow"));
  const high = Number(formData.get("bpmHigh"));
  if (!Number.isInteger(low) || !Number.isInteger(high)) return { error: "tempo" };
  if (low < BPM_FLOOR || high > BPM_CEIL || low >= high) return { error: "tempo" };

  const raw = String(formData.get("vox") ?? "");
  const vox = raw === "true" ? true : raw === "false" ? false : null;

  /* A language only narrows a vocal, so "instrumental only" drops them
     all — the pair describes an empty set and the database refuses it
     (playlists_langs_need_vocals, 0017). Dropped rather than rejected:
     it is the form's own cleanup, not a mistake the visitor made.
     Unknown codes go the same way as unknown genres above. */
  const langs = (vox === false ? [] : formData.getAll("lang").map(String).filter(isLang)) as Lang[];

  return { genres, bpm_low: low, bpm_high: high, vox, langs };
}

function parseName(raw: string): { value: string } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { error: "required" };
  if (trimmed.length > NAME_MAX) return { error: "long" };
  return { value: trimmed };
}

function localeOf(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * The caller's own `customer_id`.
 *
 * The one id these actions read explicitly, and they read it off the
 * caller's own `profiles` row — `profiles_read_own` scopes that table to
 * `id = auth.uid()`, so there is no bare "give me my profile" query
 * without it. It is needed because `playlists.customer_id` is NOT NULL
 * and PostgREST has no equivalent of the column default
 * `auth_customer_id()` would be; `playlists_owner_write`'s `with check`
 * clause then refuses any value but this one, so supplying it here is a
 * convenience for the insert, not the authorisation.
 */
async function ownCustomerId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[list] failed to read profile", error);
    return null;
  }
  return (data as { customer_id: string | null } | null)?.customer_id ?? null;
}

/**
 * Saves the rules currently set in the front page's builder as a list of
 * the customer's own, then opens it in the editor.
 *
 * This is what "Gem listen" has always promised and never did: the
 * button was a link to signup, which is the right answer for a visitor
 * and a dead end for somebody already signed in. A list is rules, not a
 * frozen set of tracks (0015's own comment on why), so what is saved
 * here is exactly what the builder is showing — and the list keeps
 * matching new music as the catalogue grows.
 */
export async function createList(formData: FormData) {
  const locale = localeOf(formData);
  const rules = parseRules(formData);
  if ("error" in rules) return;

  const name = parseName(String(formData.get("name") ?? ""));
  if ("error" in name) return;

  const supabase = await createClient();
  const customerId = await ownCustomerId(supabase);
  /* Signed out, or signed in as staff: there is no account to save to.
     The button that reaches this is only rendered for a customer, so
     this is the crafted-request case, and it ends in nothing happening
     rather than in an error page. */
  if (!customerId) redirect(`/${locale}`);

  const { data, error } = await supabase
    .from("playlists")
    .insert({
      customer_id: customerId,
      name: name.value,
      based_on: String(formData.get("basedOn") ?? "").trim() || null,
      genres: rules.genres,
      bpm_low: rules.bpm_low,
      bpm_high: rules.bpm_high,
      vox: rules.vox,
      langs: rules.langs,
    })
    .select("id")
    .single();

  if (error || !data) {
    /* An INSERT that RLS refuses raises 42501 rather than matching zero
       rows, unlike the UPDATE and DELETE below — so unlike those, this
       branch really is "it failed", not "it was not allowed". */
    console.error("[list] failed to create", error);
    redirect(`/${locale}`);
  }

  const id = (data as { id: string }).id;
  revalidatePath(`/${locale}`);
  redirect(listHref(locale, id));
}

/**
 * Saves a change to one of the customer's own lists.
 *
 * The row is found by its id alone. That is safe for the same reason
 * app/[locale]/_account-actions.ts's own update is: `playlists_owner_write`
 * restricts every statement to `customer_id = auth_customer_id()`, so an
 * id belonging to another customer matches no row at all. RLS does not
 * raise for an UPDATE whose `using` clause excludes every candidate row —
 * it simply affects none and returns no error — so `.select("id")` is
 * what tells that refusal apart from a real save, and an empty result is
 * reported as a refusal rather than as a silent, false "saved".
 */
export async function updateList(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const locale = localeOf(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, errors: { form: "save" } };

  const name = parseName(String(formData.get("name") ?? ""));
  const rules = parseRules(formData);

  const errors: Record<string, string> = {};
  if ("error" in name) errors.name = name.error;
  if ("error" in rules) errors.form = rules.error;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlists")
    .update({
      name: (name as { value: string }).value,
      genres: (rules as Rules).genres,
      bpm_low: (rules as Rules).bpm_low,
      bpm_high: (rules as Rules).bpm_high,
      vox: (rules as Rules).vox,
      langs: (rules as Rules).langs,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[list] failed to save", error);
    return { ok: false, errors: { form: "save" } };
  }
  if (!data || data.length === 0) return { ok: false, errors: { form: "forbidden" } };

  revalidatePath(listHref(locale, id));
  revalidatePath(`/${locale}`);
  return { ok: true };
}

/**
 * Deletes one of the customer's own lists.
 *
 * Any week it was scheduled into goes with it: `schedule_blocks` has
 * `on delete cascade` on `playlist_id` (0015), which is the right
 * behaviour — a block pointing at a list that no longer exists has
 * nothing to play. The editor says so before the button is pressed.
 */
export async function deleteList(formData: FormData) {
  const locale = localeOf(formData);
  const id = String(formData.get("id") ?? "");

  if (id) {
    const supabase = await createClient();
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    /* A row belonging to someone else matches nothing and deletes
       nothing — the same zero-row refusal the update above interprets.
       Here there is nothing to report either way: the visitor lands back
       on the front page and their own lists are whatever they are. */
    if (error) console.error("[list] failed to delete", error);
  }

  revalidatePath(`/${locale}`);
  redirect(`/${locale}`);
}
