# 1000TRAX — everything we can get out of the API

What the API actually answers, probed anonymously on **2026-10-29**. This
is the companion to `1000trax-api-requirements.md`, which is about what we
have asked them *for*; this one is about what is on the table today.

Nothing here is a published contract. It is observed behaviour of their
demo tier, and some of it is surprising enough that it should be re-checked
before anything important is built on it.

---

## 1. The endpoints

Three, and only three, answer without credentials.

| | |
|---|---|
| `GET https://www.1000trax.com/services/playlist` | the catalogue |
| `GET https://www.1000trax.com/services/playlist/metrics` | the shape of the catalogue |
| `GET https://demo.1000trax.com/<folder>/<file>` | the audio |

Everything else tried returns the website's 404 page, including the two
their own player references: `/services/session-user` and
`/services/trax/{id}`. So there is no track-detail endpoint, no search, no
artist endpoint, no genre endpoint and no session, anonymously.

---

## 2. `/services/playlist`

```
?def=<pool>&history=<ids>&low=<bpm>&high=<bpm>&lang=<code>
```

Returns `{ resultCompositions: [...], resultFilters: [] }`. `resultFilters`
was `[]` on every call made; nothing has ever been seen in it.

### The parameters, and which of them work

**`def`** — the pool. Required. The 156 legal values are the keys of
`metricSets` (§3). An unknown pool is **HTTP 500 with an HTML body**, not a
400 and not JSON, so a typo'd pool name crashes a naive client rather than
erroring cleanly.

**`low` / `high`** — a BPM window, and the trap in this API.

They are honoured **only when the pool's own `tempoSelection` is `true`**
(118 of 156 pools). On the other 38 they are ignored silently and the whole
pool comes back:

| call | rows | BPM range |
|---|---|---|
| `def=pop` (tempoSelection true), no window | 3,390 | 60–125 |
| `def=pop&low=100&high=110` | 1,292 | 100–109 ✓ |
| `def=pop&low=75&high=85` | 251 | 75–84 ✓ |
| `def=pop&low=200&high=250` | 0 | — ✓ |
| `def=chillout` (tempoSelection **false**), no window | 251 | 55–70 |
| `def=chillout&low=100&high=120` | 250 | **55–70** ✗ |
| `def=chillout&low=55&high=55` | 251 | **55–70** ✗ |

So a tempo window is a request, not a guarantee. Anything that depends on
tempo has to filter again on our side — which `scripts/ingest-trax.ts`
does, and which is why the café day arc is correct despite this.

**`lang`** — the language of the **advert**, not of the music. `lang=da`
returns Spanish-titled compositions next to a Danish voiceover. Only `da`
and `en` voiceovers exist; `es` and `it` silently fall back to `da`. The
music's language comes from the pool name instead (`pop_danish`,
`lounge_english`).

**`history`** — a comma-joined list of ids, documented by their player as
how a pool avoids repeats. **It does nothing.** Passing 40 ids back
returned all 40 again. Avoiding repeats is our problem.

### A music row — all ten fields

| field | type | notes |
|---|---|---|
| `iCompositionID` | int | stable id, the only key we have |
| `vcTitle` | string | one string, not localised |
| `vcFolder` | string | `MusicShort/` on every music row seen |
| `vcFile` | string | e.g. `250219.002@v10.mp3`; the `@v10` is a version |
| `iDuration` | int | seconds — of the FULL composition, 117–871 observed |
| `dBpm` | number | integer in practice, occasionally fractional |
| `hasShortVersion` | bool | `true` on every row seen, all 250 of them |
| `filters` | string | **empty on every row seen**, all 250 |
| `ageDays` | int | days since release, 135–1,976 observed |
| `randomizedSortVal` | float | re-rolled per request; the pool arrives pre-shuffled |

### An Effects row — a different shape entirely

A third of every response is advertising, with its own field set:

| field | value |
|---|---|
| `iCompositionID` | `-1` |
| `vcFolder` | `Effects/` |
| `vcTitle` | `1000TRAX Advertising` |
| `vcFile` | `1000trax.com.voiceover.only-20250804-<lang>.mp3` |
| `iDuration` | `20` |
| `dBpm` | `0` |
| `iEnergy`, `vcKeyResult`, `randomizer`, `variantBasename` | present here and on no music row |

One distinct advert file per language. `isAdvertisement` in
`lib/catalogue/trax.ts` drops them all.

---

## 3. `/services/playlist/metrics`

150 KB, no parameters, and the most useful thing they expose.

```
{ languagesAvailable: ["en","it","es","da"], tempoSelection: …, metricSets: { …156… } }
```

Each of the 156 sets carries exactly seven fields:

| field | meaning |
|---|---|
| `id` | their internal pool id |
| `formula` | the pool's definition |
| `lowMinimum` / `lowMaximum` | the tempo range their own picker offers |
| `tempoSelection` | **whether `low`/`high` work at all** (118 true, 38 false) |
| `visibleForSelection` | `true` on all 156 |
| `stats` | a tempo histogram |

`stats` is `{ columns, rows }` with columns:

```
bpmbase · tracks · minDuration · maxDuration · totalDuration
        · avgBpm · avgDuration · tracksShare · allowed
```

One row per 5-BPM bucket. **This is a full census of the catalogue** — how
many tracks exist at every tempo in every pool, their shortest, longest and
total running time. It is what the café day arc's tempo windows were
derived from, and it can answer "how much music do we have for X" without
fetching a single track.

Pool names are facets joined by `_`: `lounge_mix_english_danish` is lounge,
mixed, sung in English or Danish. `parsePoolName` decodes them into genre,
language, vocals.

---

## 4. The audio

`https://demo.1000trax.com/<folder>/<vcFile>`, two folders, same filename:

| folder | bytes (same track) | length | bitrate |
|---|---|---|---|
| `MusicShort/` | 960,723 | 60s | 128 kbps |
| `Music/` | 6,296,972 | full | 192 kbps |

- `Accept-Ranges: bytes`, and a Range request returns a proper `206`, so
  seeking works.
- `Cache-Control: max-age=604800` — a week.
- Directory listing is `403`; the host root is `200`. Files are only
  reachable if you know the name, and every name is in the playlist
  response.
- `Effects/` is reachable by URL. Nothing stops anyone fetching the advert.
- `Access-Control-Allow-Origin: 1000trax.com` — a bare host, not a legal
  origin, so it matches nothing. This is why `/api/audio` exists.

`iDuration` describes the **full** composition even on a `MusicShort/` row,
so any runtime computed from the API is roughly four times what the demo
tier actually plays.

---

## 5. What we can derive that is not given

| we want | how we get it |
|---|---|
| genre per track | the pool name it was fetched from — exact only for single-genre pools |
| vocals / instrumental | the pool's `_vox` / `_novox` suffix |
| language | the pool's language suffix, never the `lang` parameter |
| mood | ours, computed from genre + BPM (`moodFor`) |
| energy 1–5 | bucketed from `dBpm`, a guess dressed as a number |
| "how much music at tempo X" | the metrics histogram, no fetching needed |
| bitrate / real file length | `Content-Length` of the audio, divided by duration |

---

## 6. What is simply not there

No artist, composer, performer or rights holder — their own player
hardcodes the brand name as the artist. No per-row genre, vocal flag or
language. No album art. No ISRC or any external identifier. No release
date beyond `ageDays`. No key or energy on a music row. No waveform peaks.
No lyrics. No search by title or id. No paging, no cursor, no
`Last-Modified` — a pool arrives whole or not at all, and `def=vox` is
2.25 MB. No webhook, no change feed: the only way to learn the catalogue
has changed is to fetch it again and diff.

The first of those is the one that costs us a page: "Mød musikerne" was
removed from the landing page because every track would have been credited
to "Odatone".
