import Link from "next/link";
import { notFound } from "next/navigation";

import Planner, { type PlannerLocation } from "@/components/v4/schedule/Planner";
import type { WeekList } from "@/components/v4/schedule/Week";
import Shell from "@/components/v4/Shell";
import { v4 as t } from "@/lib/content/v4";
import { isLocale, type Locale } from "@/lib/i18n";
import { kr } from "@/lib/format";
import { activePlans } from "@/lib/plans-server";
import { quote } from "@/lib/pricing";
import { isFallback, type ScheduleBlock } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

type BlockRow = { id: string; playlist_id: string; weekday: number; from_min: number; to_min: number };
type ListRow = { id: string; name: string; based_on: string | null };
type LocationRow = { id: string; name: string; fallback: string };

/**
 * Ugeplan, inside the product shell exactly as the design draws it.
 *
 * That placement has one consequence worth naming: a schedule belongs to
 * a customer, so this page can only show anything to someone signed in —
 * but it sits in the same chrome as the public landing page. Rather than
 * bounce a visitor to a login (which would be a dead end arrived at from
 * what looks like the public site), the shell renders and the content
 * column asks them to sign in. The rail, the search and the player keep
 * working, because none of those need an account.
 *
 * Nothing is fetched with the service role: the rows come back through
 * RLS as whoever is asking, so an unauthenticated read returns an empty
 * set by policy rather than by a check written here
 * (0015, 0016_schedule_per_location.sql).
 */
export async function renderSchedule(
  raw: string,
  expected: Locale,
  search: Record<string, string | string[] | undefined>,
) {
  if (!isLocale(raw) || raw !== expected) notFound();
  const locale: Locale = raw;

  const plans = await activePlans();
  const cheapest = plans.reduce<(typeof plans)[number] | null>(
    (low, p) => (!low || p.monthly < low.monthly ? p : low),
    null,
  );
  const priceFrom = cheapest ? kr(Math.round(quote(cheapest, "monthly", 1).perLocation), locale) : "—";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = typeof claims?.claims?.sub === "string";

  let locations: PlannerLocation[] = [];
  let lists: WeekList[] = [];
  let blocks: ScheduleBlock[] = [];
  let locationId = "";

  if (signedIn) {
    const [{ data: locRows, error: locError }, { data: listRows, error: listError }] = await Promise.all([
      supabase.from("locations").select("id, name, fallback").order("created_at"),
      supabase.from("playlists").select("id, name, based_on").order("created_at"),
    ]);
    for (const [label, error] of [["locations", locError], ["playlists", listError]] as const) {
      if (error) console.error(`[ugeplan] failed to read ${label}`, error);
    }

    locations = ((locRows ?? []) as LocationRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      /* The column is checked in the database, so an unknown value here
         means the check was widened without this being told. Fall back
         to silence rather than crash the page on it. */
      fallback: isFallback(r.fallback) ? r.fallback : "silence",
    }));
    lists = ((listRows ?? []) as ListRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      basedOn: r.based_on,
    }));

    /* ?sted= picks the location, so a chain can bookmark one and the
       back button works. An id that is not theirs falls back to the
       first rather than erroring: the list it came from is their own. */
    const wanted = Array.isArray(search.sted) ? search.sted[0] : search.sted;
    locationId = locations.find((x) => x.id === wanted)?.id ?? locations[0]?.id ?? "";

    if (locationId) {
      const { data: blockRows, error: blockError } = await supabase
        .from("schedule_blocks")
        .select("id, playlist_id, weekday, from_min, to_min")
        .eq("location_id", locationId)
        .order("weekday");
      if (blockError) console.error("[ugeplan] failed to read schedule_blocks", blockError);
      blocks = ((blockRows ?? []) as BlockRow[]).map((r) => ({
        id: r.id,
        playlistId: r.playlist_id,
        weekday: r.weekday,
        from: r.from_min,
        to: r.to_min,
      }));
    }
  }

  return (
    <Shell locale={locale} priceFrom={priceFrom} active="schedule" lists={lists}>
      {!signedIn ? (
        <SignedOut locale={locale} />
      ) : !locationId ? (
        <Notice>{t.planner.noLocations[locale]}</Notice>
      ) : (
        <Planner
          locale={locale}
          locations={locations}
          locationId={locationId}
          blocks={blocks}
          lists={lists}
        />
      )}
    </Shell>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-8">
      <p className="text-[0.9375rem] text-ink-2">{children}</p>
    </div>
  );
}

function SignedOut({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-xl)] border border-line bg-surface p-8">
      <h1 className="u-title text-[1.125rem] text-ink">{t.planner.heading[locale]}</h1>
      <p className="text-[0.9375rem] text-ink-2">{t.schedule.signedOut[locale]}</p>
      <Link
        href="/my-odatone"
        className="rounded-full bg-accent px-5 py-2.5 text-[0.875rem] font-medium text-accent-ink"
      >
        {t.schedule.signIn[locale]}
      </Link>
    </div>
  );
}
