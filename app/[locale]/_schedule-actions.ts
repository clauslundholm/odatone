"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { END, SNAP, START, isFallback } from "@/lib/schedule";

/* ==================================================================== *
 *  Writing the weekly schedule
 *
 *  Everything here goes through RLS as whoever is asking — never the
 *  service role — so tenancy is the database's answer, not a check
 *  written twice. That shapes the error handling, because the two kinds
 *  of refusal do not look alike:
 *
 *    INSERT refused by a with-check  -> raises 42501
 *    UPDATE/DELETE refused by using  -> matches zero rows, no error
 *
 *  So an insert reads `error`, and an update or delete has to ask how
 *  many rows it touched. A write that silently did nothing and reported
 *  success is the failure mode this file exists to avoid.
 * ==================================================================== */

export type Result = { ok: true; id?: string } | { ok: false; error: string };

/* The schedule lives under two localised routes; a write from either has
   to expire both, because the other is the same data. */
function expire() {
  revalidatePath("/da/spilleplan");
  revalidatePath("/en/schedule");
}

const OVERLAP = "23P01";

/** Shared shape check. The database enforces all of this too (0016) —
    this is here so a slip in the client reads as a sentence rather than
    as a Postgres constraint name. */
function badRange(from: number, to: number): string | null {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return "invalid-range";
  if (from % SNAP || to % SNAP) return "not-quarter";
  if (from < START || to > END || from >= to) return "invalid-range";
  return null;
}

export async function createBlock(input: {
  locationId: string;
  playlistId: string;
  weekday: number;
  from: number;
  to: number;
}): Promise<Result> {
  const bad = badRange(input.from, input.to);
  if (bad) return { ok: false, error: bad };
  if (input.weekday < 0 || input.weekday > 6) return { ok: false, error: "invalid-weekday" };

  const supabase = await createClient();
  /* customer_id is not taken from the client: it is read off the
     location the caller can see, so a forged id fails the select rather
     than being written alongside someone else's block. */
  const { data: loc } = await supabase
    .from("locations")
    .select("customer_id")
    .eq("id", input.locationId)
    .maybeSingle();
  if (!loc) return { ok: false, error: "no-location" };

  const { data, error } = await supabase
    .from("schedule_blocks")
    .insert({
      customer_id: loc.customer_id,
      location_id: input.locationId,
      playlist_id: input.playlistId,
      weekday: input.weekday,
      from_min: input.from,
      to_min: input.to,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.code === OVERLAP ? "overlap" : "denied" };
  expire();
  return { ok: true, id: data.id };
}

export async function moveBlock(input: {
  id: string;
  weekday: number;
  from: number;
  to: number;
}): Promise<Result> {
  const bad = badRange(input.from, input.to);
  if (bad) return { ok: false, error: bad };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .update({ weekday: input.weekday, from_min: input.from, to_min: input.to })
    .eq("id", input.id)
    .select("id");

  if (error) return { ok: false, error: error.code === OVERLAP ? "overlap" : "denied" };
  if (!data?.length) return { ok: false, error: "denied" };
  expire();
  return { ok: true };
}

export async function setBlockPlaylist(id: string, playlistId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .update({ playlist_id: playlistId })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "denied" };
  expire();
  return { ok: true };
}

export async function deleteBlock(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("schedule_blocks").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "denied" };
  expire();
  return { ok: true };
}

/**
 * Copy one block onto other weekdays, replacing whatever it lands on.
 *
 * Replacing rather than refusing is the design's own answer, and it is
 * the right one: "copy Monday to the rest of the week" is said by
 * someone who wants the rest of the week to look like Monday. The count
 * of what was replaced comes back so the page can say so rather than
 * quietly removing a block somebody wrote.
 */
export async function copyBlockToDays(
  id: string,
  weekdays: number[],
): Promise<Result & { replaced?: number }> {
  if (!weekdays.length) return { ok: false, error: "no-days" };
  if (weekdays.some((d) => d < 0 || d > 6)) return { ok: false, error: "invalid-weekday" };

  const supabase = await createClient();
  const { data: src } = await supabase
    .from("schedule_blocks")
    .select("customer_id, location_id, playlist_id, from_min, to_min, weekday")
    .eq("id", id)
    .maybeSingle();
  if (!src) return { ok: false, error: "denied" };

  const days = weekdays.filter((d) => d !== src.weekday);
  if (!days.length) return { ok: true, replaced: 0 };

  /* Clear the landing strip first. Deleting by overlap rather than by
     whole day: copying an 08–10 block should not take out the evening. */
  const { data: clashes } = await supabase
    .from("schedule_blocks")
    .select("id, weekday, from_min, to_min")
    .eq("location_id", src.location_id)
    .in("weekday", days);

  const doomed = (clashes ?? [])
    .filter((c) => c.from_min < src.to_min && src.from_min < c.to_min)
    .map((c) => c.id);

  let replaced = 0;
  if (doomed.length) {
    const { data: gone } = await supabase
      .from("schedule_blocks")
      .delete()
      .in("id", doomed)
      .select("id");
    replaced = gone?.length ?? 0;
  }

  /* One statement, uniform keys — PostgREST rejects a bulk insert whose
     objects do not all carry the same columns (PGRST102). */
  const { error } = await supabase.from("schedule_blocks").insert(
    days.map((weekday) => ({
      customer_id: src.customer_id,
      location_id: src.location_id,
      playlist_id: src.playlist_id,
      weekday,
      from_min: src.from_min,
      to_min: src.to_min,
    })),
  );
  if (error) return { ok: false, error: error.code === OVERLAP ? "overlap" : "denied" };
  expire();
  return { ok: true, replaced };
}

export async function setFallback(locationId: string, fallback: string): Promise<Result> {
  if (!isFallback(fallback)) return { ok: false, error: "invalid-fallback" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ fallback })
    .eq("id", locationId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "denied" };
  expire();
  return { ok: true };
}

/**
 * Copy a whole week onto other locations, replacing theirs.
 *
 * The design says plainly that the existing plan is replaced, and the
 * notice in the dialog says so too — so this deletes first and does not
 * try to merge. Each target is cleared and refilled; a target the caller
 * cannot see simply matches no rows and contributes nothing, which is
 * RLS doing the tenancy check rather than a second one here.
 */
export async function copyWeekToLocations(
  fromLocationId: string,
  targetIds: string[],
): Promise<Result & { copied?: number }> {
  if (!targetIds.length) return { ok: false, error: "no-locations" };

  const supabase = await createClient();
  const { data: src } = await supabase
    .from("schedule_blocks")
    .select("customer_id, playlist_id, weekday, from_min, to_min")
    .eq("location_id", fromLocationId);

  /* Only locations the caller can actually see get written to, and the
     customer_id comes from those rows rather than from the source — a
     block must match its own location's customer (0016). */
  const { data: targets } = await supabase
    .from("locations")
    .select("id, customer_id")
    .in("id", targetIds);
  if (!targets?.length) return { ok: false, error: "denied" };

  await supabase
    .from("schedule_blocks")
    .delete()
    .in("location_id", targets.map((t) => t.id));

  const rows = targets.flatMap((t) =>
    (src ?? []).map((b) => ({
      customer_id: t.customer_id,
      location_id: t.id,
      playlist_id: b.playlist_id,
      weekday: b.weekday,
      from_min: b.from_min,
      to_min: b.to_min,
    })),
  );
  if (rows.length) {
    const { error } = await supabase.from("schedule_blocks").insert(rows);
    if (error) return { ok: false, error: "denied" };
  }
  expire();
  return { ok: true, copied: targets.length };
}
