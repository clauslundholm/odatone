import Link from "next/link";
import { notFound } from "next/navigation";

import Schedule, { type SchedulePlaylist } from "@/components/v4/Schedule";
import Shell from "@/components/v4/Shell";
import { v4 as t } from "@/lib/content/v4";
import { isLocale, type Locale } from "@/lib/i18n";
import { kr } from "@/lib/format";
import { activePlans } from "@/lib/plans-server";
import { quote } from "@/lib/pricing";
import type { ScheduleBlock } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

type BlockRow = { id: string; playlist_id: string; weekday: number; from_hour: number; to_hour: number };

/**
 * Spilleplan, inside the product shell exactly as the design draws it.
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
 * (0015_playlists_and_schedule.sql).
 */
export async function renderSchedule(raw: string, expected: Locale) {
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

  let blocks: ScheduleBlock[] = [];
  let playlists: SchedulePlaylist[] = [];
  if (signedIn) {
    const [{ data: blockRows, error: blockError }, { data: listRows, error: listError }] = await Promise.all([
      supabase.from("schedule_blocks").select("id, playlist_id, weekday, from_hour, to_hour").order("weekday"),
      supabase.from("playlists").select("id, name").order("created_at"),
    ]);
    for (const [label, error] of [["schedule_blocks", blockError], ["playlists", listError]] as const) {
      if (error) console.error(`[spilleplan] failed to read ${label}`, error);
    }
    blocks = ((blockRows ?? []) as BlockRow[]).map((r) => ({
      id: r.id, playlistId: r.playlist_id, weekday: r.weekday,
      fromHour: r.from_hour, toHour: r.to_hour,
    }));
    playlists = (listRows ?? []) as SchedulePlaylist[];
  }

  return (
    <Shell locale={locale} priceFrom={priceFrom} active="schedule">
      <div className="flex flex-col gap-7">
        <header className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="u-title text-[1.125rem] text-ink">{t.schedule.heading[locale]}</h1>
            <p className="text-[0.8125rem] text-ink-3">{t.schedule.lede[locale]}</p>
          </div>
        </header>

        {signedIn ? (
          <Schedule locale={locale} blocks={blocks} playlists={playlists} />
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-[var(--radius-xl)] bg-surface p-8">
            <p className="text-[0.9375rem] text-ink-2">{t.schedule.signedOut[locale]}</p>
            <Link
              href="/my-odatone"
              className="rounded-full bg-accent px-5 py-2.5 text-[0.875rem] font-medium text-accent-ink"
            >
              {t.schedule.signIn[locale]}
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
