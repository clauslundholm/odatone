import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Shell from "@/components/v4/Shell";
import { ListForm, ListMatches, ListProvider, type EditableList, type Scheduled } from "@/components/v4/list/Editor";
import { LinkButton } from "@/components/ui/Button";
import { v4 as t } from "@/lib/content/v4";
import { kr } from "@/lib/format";
import { isLocale, type Locale } from "@/lib/i18n";
import { activePlans } from "@/lib/plans-server";
import { quote } from "@/lib/pricing";
import { GENRES, isLang, type Genre } from "@/lib/tracks";
import { createClient } from "@/lib/supabase/server";
import { hasSession, loadAccount } from "@/lib/v4/account";

type PlaylistRow = {
  id: string;
  name: string;
  based_on: string | null;
  genres: string[] | null;
  bpm_low: number;
  bpm_high: number;
  vox: boolean | null;
  langs: string[] | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENRE_IDS = new Set<string>(GENRES.map((g) => g.id));

export const listMetadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Rediger liste: one of the customer's own saved lists, inside the
 * product shell.
 *
 * The table behind this shipped with 0015_playlists_and_schedule.sql,
 * whose own header names this screen as the thing it was written for —
 * and then the screen was never built, so a saved list could be dragged
 * onto the week but never renamed or re-tuned. This is it.
 *
 * A list is rules, not a frozen set of track ids (0015's own reasoning),
 * so the right rail shows what the rules match at this moment and says
 * out loud that the answer will change as the library grows.
 *
 * Every read is RLS-scoped as whoever is asking: `playlists_read`
 * narrows the table to this customer, so an id belonging to someone else
 * comes back as no row and is reported as "not found" — the same answer
 * a made-up id gets, which is the only answer that does not confirm
 * another customer's list exists.
 */
export async function renderList(raw: string, expected: Locale, id: string) {
  if (!isLocale(raw) || raw !== expected) notFound();
  const locale: Locale = raw;

  const plans = await activePlans();
  const cheapest = plans.reduce<(typeof plans)[number] | null>(
    (low, p) => (!low || p.monthly < low.monthly ? p : low),
    null,
  );
  const priceFrom = cheapest ? kr(Math.round(quote(cheapest, "monthly", 1).perLocation), locale) : "—";

  const account = await loadAccount(locale);
  /* Not `account !== null`: that is also null for staff, who should
     not be shown the price pitch meant for visitors. */
  const signedIn = await hasSession();

  if (!account) {
    return (
      <Shell locale={locale} signedIn={signedIn} priceFrom={priceFrom} active="build">
        <Notice locale={locale} message={t.list.signedOut[locale]} />
      </Shell>
    );
  }

  const list = UUID.test(id) ? await loadList(id) : null;

  if (!list) {
    return (
      <Shell
        locale={locale}
        signedIn={signedIn}
        priceFrom={priceFrom}
        active="build"
        account={account.chrome}
        lists={account.lists}
      >
        <Notice locale={locale} message={t.list.notFound[locale]} />
      </Shell>
    );
  }

  const scheduled = await loadScheduled(id);

  /* The provider wraps Shell, not the page body: the form sits in the
     shell's main column and the live match count in its right rail, and
     only a common ancestor can hold the state both read. */
  return (
    <ListProvider list={list}>
      <Shell
        locale={locale}
        signedIn={signedIn}
        priceFrom={priceFrom}
        active="build"
        account={account.chrome}
        lists={account.lists}
        rail={<ListMatches locale={locale} scheduled={scheduled} />}
      >
        <ListForm locale={locale} />
      </Shell>
    </ListProvider>
  );
}

function Notice({ locale, message }: { locale: Locale; message: string }) {
  return (
    <section className="u-card flex flex-col items-start gap-3 p-8">
      <p className="text-[0.9375rem] leading-relaxed text-ink-2">{message}</p>
      <LinkButton href={`/${locale}`} size="md" variant="outline">
        {t.rail.home[locale]}
      </LinkButton>
    </section>
  );
}

async function loadList(id: string): Promise<EditableList | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select("id, name, based_on, genres, bpm_low, bpm_high, vox, langs")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[list] failed to read playlist", error);
    return null;
  }
  if (!data) return null;

  const row = data as PlaylistRow;
  return {
    id: row.id,
    name: row.name,
    basedOn: row.based_on,
    /* The column is a bare text[] with no check constraint, so a genre
       the catalogue no longer has is possible — dropped rather than
       rendered as a chip nobody can turn off. */
    genres: (row.genres ?? []).filter((g) => GENRE_IDS.has(g)) as Genre[],
    bpmLow: row.bpm_low,
    bpmHigh: row.bpm_high,
    vox: row.vox,
    /* The column holds bare two-letter codes and the catalogue owns
       which ones exist (lib/tracks.ts's LANGS), so a code this build
       does not know is dropped rather than rendered as a chip nobody
       can turn off — the same treatment `genres` gets above. */
    langs: (row.langs ?? []).filter(isLang),
  };
}

/**
 * How many blocks this list holds in the week, and across how many
 * rooms.
 *
 * `location_id` arrived with 0016_schedule_per_location.sql. On a
 * database that has not had it applied the select fails, and the panel
 * says "not on the weekly plan yet" rather than taking the page down
 * with it — the same soft landing the account's Lokationer tab gives
 * that migration's other column.
 */
async function loadScheduled(playlistId: string): Promise<Scheduled> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("id, location_id")
    .eq("playlist_id", playlistId);

  if (error) {
    console.error("[list] failed to read schedule blocks", error);
    return { blocks: 0, locations: 0 };
  }

  const rows = (data ?? []) as { id: string; location_id: string | null }[];
  const locations = new Set(rows.map((r) => r.location_id).filter(Boolean));
  return { blocks: rows.length, locations: locations.size };
}
