/* ==================================================================== *
 *  Build lib/catalogue/catalogue.generated.ts from the live 1000trax
 *  catalogue.
 *
 *    node scripts/ingest-trax.ts
 *
 *  Offline on purpose. Their playlist service returns a whole pool in
 *  one response with no paging -- `def=vox` alone is 2.25 MB of JSON --
 *  so nothing here can run per request, and the site must not depend on
 *  their host being up to render a page. Audio still streams live,
 *  through /api/audio.
 *
 *  What this does that a naive fetch would not:
 *
 *    - drops their advertising. A third of every demo-tier response is
 *      `Effects/1000trax.com.voiceover.only-*.mp3`.
 *    - only reads SINGLE-genre, single-language pools, so a track's
 *      genre, vocals and language are facts off the pool name rather
 *      than guesses (see isUnambiguous).
 *    - interleaves the pools before capping, so the cap costs every
 *      pool a little rather than cutting the last ones off entirely.
 * ==================================================================== */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  TRAX_GENRE,
  isUnambiguous,
  moodFor,
  musicOnly,
  toTrack,
  usablePools,
  type TraxMetrics,
  type TraxPlaylistResponse,
  type UsablePool,
} from "../lib/catalogue/trax.ts";
import { BPM_MAX, BPM_MIN, type Track } from "../lib/tracks.ts";

const API = "https://www.1000trax.com/services/playlist";

/** Kept small deliberately. This array is imported by client components,
    so every track is bytes in someone's browser; 600 is enough for every
    filter combination to return something real without shipping a
    megabyte of JSON to a café owner on a phone. */
const CAP_TOTAL = 600;
const CAP_PER_POOL = 60;

/** Their service is a supplier's, not ours. Space the calls out. */
const SPACING_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

async function main() {
  process.stdout.write("reading /services/playlist/metrics ... ");
  const metrics = await getJson<TraxMetrics>(`${API}/metrics`);
  const all = usablePools(metrics);
  const sets = metrics.metricSets;

  /* A pool that does not say whether it sings is only worth reading when
     nothing better exists. `pop` returns 3,143 tracks and `pop_vox`
     returns 3,142 of the same ones, so filing the bare pool as
     instrumental -- the conservative default toTrack applies when a pool
     is silent -- would mislabel almost the whole pop catalogue. Where a
     `_vox`/`_novox` sibling exists, read those instead and skip the
     parent.

     What is left over is the handful with no vocal sibling at all:
     bossa, chillout, house, downbeat, unplugged, jazz, jazzy, slowjazz.
     Those keep the conservative default, which is right for the beatless
     pools and a guess for the rest -- it is on the list for 1000trax. */
  const statesVocals = (name: string) => `${name}_vox` in sets || `${name}_novox` in sets;
  const pools = all
    .filter(isUnambiguous)
    .filter((p) => p.facets.vox !== null || !statesVocals(p.name));
  console.log(
    `${Object.keys(metrics.metricSets).length} sets, ` +
      `${all.length} mappable, ${pools.length} unambiguous`,
  );
  console.log(`languages: ${metrics.languagesAvailable.join(", ")}`);

  const perPool: Track[][] = [];
  const seen = new Set<number>();

  for (const pool of pools) {
    const { facets } = pool;
    const genre = facets.genres[0];
    const lang = facets.langs[0] ?? null;

    /* Their low/high are a BPM window, and ours is narrower than theirs:
       asking outside BPM_MIN..BPM_MAX returns tracks the player's own
       tempo slider can never select again. */
    const low = Math.max(BPM_MIN, pool.lowMinimum || BPM_MIN);
    const high = Math.min(BPM_MAX, pool.lowMaximum || BPM_MAX);

    const url =
      `${API}?def=${encodeURIComponent(pool.name)}&history=` +
      `&low=${low}&high=${high}&lang=da`;

    let res: TraxPlaylistResponse;
    try {
      res = await getJson<TraxPlaylistResponse>(url);
    } catch (err) {
      console.warn(`  ! ${pool.name}: ${(err as Error).message}`);
      continue;
    }

    const rows = musicOnly(res.resultCompositions);
    const ads = (res.resultCompositions?.length ?? 0) - rows.length;

    const taken: Track[] = [];
    for (const row of rows) {
      if (taken.length >= CAP_PER_POOL) break;
      if (seen.has(row.iCompositionID)) continue;
      const bpm = Math.round(row.dBpm);
      if (!Number.isFinite(bpm) || bpm < BPM_MIN || bpm > BPM_MAX) continue;
      if (!row.iDuration || row.iDuration <= 0) continue;
      seen.add(row.iCompositionID);
      taken.push(
        toTrack(row, {
          mood: moodFor(genre, bpm),
          genre,
          vox: facets.vox,
          lang,
        }),
      );
    }

    console.log(
      `  ${pool.name.padEnd(26)} ${String(rows.length).padStart(5)} music ` +
        `${String(ads).padStart(5)} ads  -> ${taken.length}`,
    );
    if (taken.length) perPool.push(taken);
    await sleep(SPACING_MS);
  }

  /* Two round-robins, not one. Flattening the pools directly let `rnb`
     take 230 of 600 places -- it has ten pools where `unplugged` has one
     -- and starved the three genres with a single pool each down to 17.
     Interleaving within a genre first, then across genres, spends the
     cap on breadth: a customer filtering by House finds a House
     catalogue rather than a rounding error. */
  const interleave = (buckets: Track[][], limit: number): Track[] => {
    const out: Track[] = [];
    for (let i = 0; out.length < limit; i++) {
      let moved = false;
      for (const b of buckets) {
        if (i >= b.length) continue;
        out.push(b[i]);
        moved = true;
        if (out.length >= limit) break;
      }
      if (!moved) break;
    }
    return out;
  };

  const byOurGenre = new Map<string, Track[][]>();
  for (const bucket of perPool) {
    const g = bucket[0].genre;
    if (!byOurGenre.has(g)) byOurGenre.set(g, []);
    byOurGenre.get(g)!.push(bucket);
  }
  const genreBuckets = [...byOurGenre.values()].map((bs) => interleave(bs, CAP_TOTAL));
  const tracks = interleave(genreBuckets, CAP_TOTAL);

  const byGenre: Record<string, number> = {};
  const byMood: Record<string, number> = {};
  const byLang: Record<string, number> = {};
  for (const t of tracks) {
    byGenre[t.genre] = (byGenre[t.genre] ?? 0) + 1;
    byMood[t.mood] = (byMood[t.mood] ?? 0) + 1;
    const k = t.vox ? (t.lang ?? "vox") : "instrumental";
    byLang[k] = (byLang[k] ?? 0) + 1;
  }

  const header = `/* ==================================================================== *
 *  GENERATED by scripts/ingest-trax.ts -- do not edit by hand.
 *
 *  ${tracks.length} tracks from the live 1000trax catalogue, read on
 *  ${new Date().toISOString().slice(0, 10)}.
 *
 *  Genre, vocals and language are facts off each pool's name, not
 *  guesses: only single-genre, single-language pools are read. Mood is
 *  ours and is derived (see moodFor). Advertising from Effects/ is
 *  dropped on the way in.
 *
 *  Two fields are honestly empty rather than invented:
 *    - \`artist\` is the brand on every row, because their response
 *      carries no artist at all (TRAX_GAPS.artist);
 *    - \`peaks\` is [], so the scrubber can tell "no waveform" from a
 *      flat one (TRAX_GAPS.peaks).
 *
 *  genres: ${JSON.stringify(byGenre)}
 *  moods:  ${JSON.stringify(byMood)}
 *  vocals: ${JSON.stringify(byLang)}
 * ==================================================================== */

import type { Track } from "../tracks";

export const CATALOGUE_READ_ON = "${new Date().toISOString().slice(0, 10)}";

export const CATALOGUE: Track[] = `;

  const body = JSON.stringify(tracks, null, 2).replace(/\n/g, "\n");
  const out = join(import.meta.dirname, "..", "lib", "catalogue", "catalogue.generated.ts");
  writeFileSync(out, `${header}${body};\n`, "utf8");

  console.log(`\nwrote ${out}`);
  console.log(`tracks ${tracks.length}`);
  console.log(`genres ${JSON.stringify(byGenre)}`);
  console.log(`moods  ${JSON.stringify(byMood)}`);
  console.log(`vocals ${JSON.stringify(byLang)}`);
  const missing = Object.values(TRAX_GENRE).filter((g) => !byGenre[g]);
  if (missing.length) console.warn(`\n! no tracks for: ${[...new Set(missing)].join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
