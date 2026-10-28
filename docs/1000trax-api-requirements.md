# Odatone ⇄ 1000TRAX — API requirements

Odatone is rebuilding its website and shipping a native iOS/Android app. Both
need to play the 1000TRAX catalogue. This document sets out what we need from
an API so we can plan against it, and the questions we cannot answer from the
outside.

It is written against what the current player at `odatone.1000trax.com/app`
does, which we read from its own JavaScript and one anonymous request. Where
we have guessed, we say so — please correct us.

---

## 1. What we observe today

| | |
|---|---|
| Catalogue | `GET /services/playlist?def=<pool>&history=<ids>&low=<bpm>&high=<bpm>&lang=<code>` |
| Response | `{ resultCompositions: [...], resultFilters: ... }` |
| A row | `iCompositionID`, `vcTitle`, `vcFolder`, `vcFile`, `iDuration`, `dBpm`, `hasShortVersion`, `filters`, `ageDays`, `randomizedSortVal` |
| Audio URL | built client-side: `https://demo.1000trax.com/` + `vcFolder` + `vcFile` |
| Playback | `<audio src=…>`, plain progressive MP3 |
| Genres | The player config names eight. `/services/playlist/metrics` lists **156 pools**, including `house`, `downbeat`, `unplugged`, `jazzy`, `xmas` and `medit_inst`, and the language and `_vox`/`_novox` variants of each. Note `jazz_slowjazz` — which `combinableWith` says is legal — is not among them. |
| Other services | `GET /services/playlist/metrics` (BPM distributions, `languagesAvailable`), `GET /services/session-user` |

`def=lounge` returned 2,163 compositions in one 487 KB response, pre-shuffled
via `randomizedSortVal`, with no paging and no session.

---

## 1b. Two things we only found by building against it

Added 2026-10-28, after reading `/services/playlist/metrics` properly and
running the audio through a real browser. Both are blocking and neither
appears anywhere above.

### A third of every response is your advertising — **blocking**

`GET /services/playlist?def=vox&history=&low=80&high=120&lang=da` returns
**9,952 rows: 6,635 compositions and 3,317 jingles** from `Effects/`, each
`iCompositionID: -1` and named
`1000trax.com.voiceover.only-20250804-da.mp3`.

We cannot play these. Odatone's customers are cafés, shops and clinics who
are paying precisely so that nothing speaks over their room, and the file
advertises a competing product to their customers. We drop every `Effects/`
row on ingest (`isAdvertisement`). **We need a tier, or a parameter, that
does not inject them at all** — filtering them client-side means we are
still paying to download a third of every response.

Incidentally, `lang` appears to select the language of the *jingle*, not of
the music: `def=vox&lang=da` returned Spanish-titled compositions alongside
a Danish-voiced advert. If that is wrong, please say so, because we have
built the language filter on the pool names instead.

### `demo.1000trax.com` sends a CORS header no browser can use — **blocking**

```
Access-Control-Allow-Origin: 1000trax.com
```

That is a bare host. The header must be an origin — `https://odatone.com`,
or `*` — so this value matches nothing and is treated as absent. Any
`crossOrigin` request for the audio therefore fails outright.

This is not cosmetic for us: our player feeds an `AnalyserNode` to draw a
spectrum, which requires `crossOrigin="anonymous"`, and a tainted media
element connected to Web Audio is silenced by Chrome. So on the direct URL
we can have the audio or the visualiser, never both.

We are shipping a proxy on our own origin to work around it
(`app/api/audio/[...path]/route.ts`), which means **your audio now costs us
egress on every play**. Returning a valid `Access-Control-Allow-Origin`
would let us delete that route and go straight to your CDN.

### While we are here: the demo files are 60 seconds

`iDuration` is the composition's real length, but the file under
`MusicShort/` is a 60-second cut — a row saying 239s resolves to 960,723
bytes, which at 128 kbps is exactly 60s. Our interface prints runtimes from
`iDuration`, so a list we describe as 52 minutes currently plays for about
13. Covered by §2.2, but worth stating as the concrete symptom.

---

## 2. What we need

### 2.1 Authenticated, signed audio URLs — **blocking**

Today the MP3s are unsigned and world-readable: `HEAD` returns `200` with no
credentials, `Accept-Ranges: bytes`, `Cache-Control: max-age=604800, public`.
Anyone who sees a URL has the file, permanently, and can share it.

Odatone is sold to businesses on the promise that every right is paid for
before they press play. That promise is not enforceable while the files
themselves are open, and it is the first thing a serious customer's IT
department will test.

We need per-customer credentials and audio URLs that expire. We can see your
player already has the hook — it reads an optional `token` config value and
appends `&token=` to the playlist request — but the page we looked at never
sets it. Please tell us what that token is, how it is issued, and whether it
also protects the audio host or only the metadata.

### 2.2 Production audio, not the demo tier — **blocking**

The hardcoded base is `demo.1000trax.com` and every row carries
`hasShortVersion: true`, with files under `MusicShort/`. We assume these are
trimmed previews.

We need the production host, the full-length path, and confirmation of the
format and bitrate we are licensed to serve. If short and full versions have
different identifiers, we need both on the row rather than a path convention
we have to infer.

### 2.3 Paging or sync — **blocking for the app**

Half a megabyte per pool is tolerable in a browser tab. It is not on a phone
on cellular, and the Odatone app is specified to keep working offline for
seven days, which means it must hold a local copy and update it
incrementally.

Either:

- `limit` / `offset` (or a cursor) on the playlist endpoint, **or**
- a sync endpoint taking `updatedSince` and returning additions, changes and
  removals.

The second is what we would prefer. `ageDays` on each row suggests you
already track this.

### 2.4 Artist and rights credits — **blocking for one of our pages**

A composition carries no artist. Your player sets `artist` to the brand name,
so in the current app every track is credited to "Odatone". `GET
/services/trax/{id}` returns `404` to an anonymous caller, so we cannot tell
whether credits exist behind authentication.

Odatone markets the catalogue as recorded by professional musicians and has a
page about them. We need, per composition: performing artist, composer, and
whatever rights identifiers you hold (ISRC, or your own). If that data is not
available for licensing reasons, tell us — we would rather change the
marketing than guess at a name.

### 2.5 Per-row genre — **important**

A composite pool such as `bossa_rnb` returns rows that do not say which genre
they came from. We cannot label or filter them correctly; every track in the
pool would have to be tagged with the same genre, which is wrong for half of
them.

Please return the genre codename (or `tagID`) on each composition.

### 2.6 Per-row vocal flag — **important**

Vocals are currently a property of the pool (`hasVocals`,
`vocalsSelectable`) and of the `lang` parameter, not of a composition. The
`filters` field was empty on every row we sampled.

Odatone sells vocal control as a plan feature, so we need to know per track
whether it has vocals and in which language.

### 2.7 Waveform peaks — **nice to have**

Our player draws a waveform scrubber from ~180 normalised amplitude buckets.
If you can supply them we will use them; otherwise we will generate them on
ingest, which is fine but means we must download every file once.

---

## 3. Questions we cannot answer from outside

1. **Is this the whole catalogue?** Odatone advertises "over 4,000 tracks".
   One pool returned 2,163. Is that the total, the pool, or the demo subset?
2. **Genre coverage.** Your eight genres are pop, lounge, bossa, jazz,
   slowjazz, rnb, funk and chillout. Odatone's plans currently promise eight
   genres of its own, three of which — electronic, hip-hop and classical —
   have nothing corresponding in your catalogue. Is there material we are not
   seeing, or should we change what we advertise?
3. **Does mood exist on your side?** We group music into five moods (calm,
   focus, warm, evening, energy). Nothing in your API expresses this, so we
   currently derive each one from a genre pool plus a BPM window. If you have
   a mood or usage dimension, we would rather use yours than invent ours.
4. **Reporting.** Do you require play reporting for rights accounting, and in
   what form? We see `track.listen_full` and `playlist/metrics` in the client
   but cannot tell what is obligatory.
5. **Rate limits and availability.** What may we call, how often, and what
   uptime should we design for? Is there a sandbox?
6. **Seasonal pools.** Genres carry `seasonStart` / `seasonEnd`, both null
   today. How are these meant to be used?

---

## 4. A small correction

The audio host returns `Access-Control-Allow-Origin: 1000trax.com`. That is
not a valid CORS origin — it needs a scheme, e.g. `https://1000trax.com`.
Browsers reject it as malformed. It does not affect your player today
because `<audio src>` is not CORS-checked, but it will break any client that
fetches the bytes directly, which includes offline caching in a mobile app
and anything using the Web Audio API.

---

## 5. What we have built against the current behaviour

So that you can see our assumptions rather than take them on trust,
`lib/catalogue/trax.ts` in the Odatone repository contains our reading of
your wire format, our genre mapping and our mood-to-pool table, with the
reasoning written out and unit tests pinned to a real response row. It is
deliberately a thin, replaceable layer — we expect to rewrite the transport
once this document is answered.

**Contact:** Claus Lundholm · claus@lundholm.com
