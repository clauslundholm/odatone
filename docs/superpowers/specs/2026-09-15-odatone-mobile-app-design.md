# Odatone Mobile App — Design

**Date:** 2026-09-15
**Status:** Approved in brainstorming, pending spec review
**Scope:** A native iOS and Android app, built with React Native and Expo, that brings the web player to phones and tablets.

## Summary

The app is the Odatone music player, not the marketing site. A venue picks a mood or browses the library, and the app plays background music that keeps going with the screen locked. It lives in a new `mobile/` directory beside the existing Next.js site. The web publishes its track catalogue as one prerendered JSON route; the app fetches that catalogue and streams audio from the site, so the catalogue keeps a single source of truth and changes to it need no app release.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| What is the app for? | The music player | The most app-native use: a device left playing in a venue. The marketing pages are content people read once. |
| Devices | Phones and tablets, iOS and Android | Tablets fit a device behind the counter; phones are universal. |
| Trial | Keep the 7-day trial, like the web | Chosen by the product owner. See [Risks](#risks) for the review consideration. |
| Offline | Online only, for now | The audio already streams from the site and is placeholder material. |
| Architecture | Sibling Expo app; the web publishes the catalogue | Single-sourced catalogue, updatable without a release, no risk to the deployed site. |
| Phone navigation | Tabs: Moods · Library · Settings | The pattern people know from music apps. |
| Appearance | Follow the device's light or dark setting, with an override | Expected of an app, and a white screen glares in a dim venue at night. |

Rejected architectures, for the record: a pnpm monorepo with a shared package (relocates the live web app, invites React version conflicts between Next and Expo, and compiles the catalogue into the app, needing a release per catalogue change), and a standalone app with copied data (the catalogue drifts from the web once the real one arrives).

## Context and constraints

These facts from the repository shape the design:

- **There is no account backend.** `app/actions.ts` validates signup and sales leads and logs them; nothing is persisted, and there is no login, authentication or subscription. The real product app lives at `odatone.1000trax.com/app`.
- **The audio is placeholder.** `lib/tracks.ts` states that the 24 files in `public/audio` are synthesised and the artists fictional, pending the real catalogue.
- **The trial is client-side.** `lib/audio/trial.ts` keeps a 7-day start date in `localStorage`.
- **The redesign is served from `odatone.vercel.app`, not `odatone.com`.** `SITE.url` is `https://odatone.com`, but that domain does not serve the redesign (HTTP 455) or the audio (404). The app must not use `SITE.url`.
- **Expo is on SDK 57**, which pins its own React Native and React versions. The app therefore has its own `package.json`; it cannot share the web's dependencies.

## 1. Architecture

### Repository layout

```
odatone/
  app/, components/, lib/     existing Next.js site, unchanged except below
  app/catalogue.json/route.ts  NEW — publishes the catalogue
  public/app-artwork.png       NEW — lock-screen artwork, see section 4
  mobile/                      NEW — the Expo app, its own package.json
```

Those are the only two additions to the web: one route and one static image.

### The catalogue route

`app/catalogue.json/route.ts` serves `GET /catalogue.json`, built from `lib/tracks.ts`:

```ts
type Catalogue = {
  version: 1;
  placeholder: boolean;             // TRACKS_ARE_PLACEHOLDER
  bpm: { min: number; max: number }; // BPM_MIN, BPM_MAX
  genres: { id: Genre; label: L10n }[];
  moods: { id: Mood; label: L10n; blurb: L10n }[];
  tracks: Track[];                  // src stays relative: "/audio/soft-open.mp3"
};
```

It must be prerendered. In this version of Next, route handlers are **not** cached by default, so the file declares `export const dynamic = "force-static"`. It reads no request data. Paths stay relative so the route does not need to know its domain.

### How the app uses it

- One base URL, `EXPO_PUBLIC_SITE_URL`, defaulting to `https://odatone.vercel.app`. It moves to `odatone.com` only when the redesign is served there.
- On launch the app fetches `${SITE_URL}/catalogue.json`, validates it, and resolves each track's `src` against the base URL.
- The last valid catalogue is stored on the device, so a failed fetch at launch still shows the library. Only playback needs the network.
- Everything the app keeps on the device — the cached catalogue, the trial start date, the resume state and the appearance and language settings — goes in `@react-native-async-storage/async-storage`.

### Copied into the app deliberately

Each is small and stable; copying keeps the app independent of the web's build.

| From the web | Into the app |
| --- | --- |
| Design tokens in `app/globals.css` | `mobile/src/theme.ts` |
| The player strings in `lib/content/player.ts` that apply on a device — not the web's keyboard hints or browser-autoplay messages — plus the app's own strings | `mobile/src/copy.ts` |
| `filterTracks` in `lib/tracks.ts` | `mobile/src/catalogue/filter.ts`, guarded by a parity test |
| The trial rule in `lib/audio/trial.ts` | `mobile/src/player/trial.ts`, on device storage |
| Icons in `components/player/Icons.tsx` | `mobile/src/ui/icons.tsx` |

### Language

Danish on a Danish device, English otherwise, matching the web's locales. Settings offers a switch.

### Keeping the web deploy safe

- The root `tsconfig.json` includes `**/*.ts` and `**/*.tsx`, so `next build` would type-check `mobile/` against React Native types and fail. The root config excludes `mobile`.
- A `.vercelignore` excludes `mobile/` from the Vercel upload.

## 2. Screens and navigation

### Phone

Three tabs, with a mini player pinned above the tab bar on every tab.

- **Moods** — the five venue moods as cards (Calm, Focus, Warm, Evening, Energy), each with its venue blurb. Tapping one sets the mood filter and starts playing.
- **Library** — the full catalogue with filters: genres (multiple), BPM range, and vocals (any, with, without). Tapping a track plays it within the current queue.
- **Settings** — appearance override, language, trial status, and links to pricing and signup on the website.

Tapping the mini player opens the **Now Playing** screen: the dark player moment, with cover, title, mood and tempo, the waveform scrubber, and play/pause, previous, next and shuffle.

### Tablet

A split layout. The library, with its filters, fills the left; the Now Playing panel is always visible on the right. There is no separate full-screen player, since the player never leaves the screen.

The layout is chosen by **window width, not device type**: at 768 points wide or more the split layout is used, and below that the phone layout. A tablet in portrait, or an iPad running the app in split-screen, therefore gets whichever layout fits the space it actually has.

### Trial gate

When the trial has expired, playback is blocked and a screen explains why, with a link to signup on the website.

## 3. Playback

### One player for the whole app

A `PlayerProvider` owns a single `AudioPlayer`, created with `createAudioPlayer` and kept for the app's lifetime, and changes track with `replace()`.

`AudioPlaylist` is not used. It has no lock-screen API, and on Android background audio stops after about three minutes unless the player is active for the lock screen. A playlist would cut the music mid-service.

### Queue

The queue is the catalogue passed through the ported `filterTracks`, in filter order. When a track finishes, the next plays, wrapping at the end. The next track is preloaded so the change is quick.

Shuffle works as it does on the web: it does not reorder the queue, but makes next and previous jump to a random other track. Previous restarts the current track instead when it is more than 3 seconds in.

### Background playback and the lock screen

- The `expo-audio` config plugin sets `enableBackgroundPlayback: true`.
- At startup: `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" })`. `doNotMix` is required for the lock screen to attach to the player.
- On each track: `setActiveForLockScreen(true, { title, artist, artworkUrl })`, then `updateLockScreenMetadata` on later changes.
- **The lock screen offers play/pause and seek only.** `expo-audio`'s lock-screen options expose no next or previous track control. Skipping happens in the app.
- On Android, notification permission is requested on first play, since media controls need it on Android 13 and later.

### Trial

The 7-day window starts at first play and is kept in on-device storage. An expired trial blocks the next track rather than cutting off the current one.

### Resuming

The last track, position, shuffle state and filters are restored on launch, **paused**. The app never starts playing on its own when opened.

### Adapted from the web

- **Volume** uses the device's hardware buttons. The web's volume slider and mute exist because browsers have no hardware control.
- **Interruptions:** a phone call pauses playback. Disconnecting headphones or a Bluetooth speaker stops it, which is operating-system behaviour. The mini player shows the paused state so staff notice.
- **The live spectrum is not ported.** `expo-audio` can sample playback, but on Android that requires the microphone permission, which a music player should not ask for. The waveform is drawn from each track's `peaks`, with the playhead following playback.

## 4. Visual language

- **Appearance** follows the device's light or dark setting, using the web's own light and dark token sets. Settings can force either. The Now Playing screen is always dark, as the web's player moment is.
- **Tokens** — colours, radii from 6 to 36px, and the brand gradient (`#db00ff → #7a3aff → #3d7aff`) are ported unchanged.
- **Type** is Inter throughout. The web self-hosts a variable `.woff2`, which React Native does not support, so the app loads Inter's static weights.
- **Covers** are generated as on the web: the brand gradient at an angle taken from a hash of the track id, over bars sampled from the track's peaks.
- **Icons** are the web's own, ported rather than replaced with a generic set.
- **Motion** is restrained. The Now Playing screen slides up from the mini player.
- **Lock-screen artwork** needs an image URL, and generated covers are not images. Every track uses one branded artwork: a square PNG made from the existing `public/odatone-logo_colour.svg` on the web's light ground (`#f5f5f7`), served as `/app-artwork.png`. The logo's "tone." wordmark is black and drawn for light backgrounds, so on a dark ground or the brand gradient half of it disappears — confirmed by rendering both.

## 5. Failure handling

| Situation | Behaviour |
| --- | --- |
| Catalogue unreachable, nothing cached | A "can't reach Odatone" screen with a retry button, never an empty library |
| Catalogue unreachable, cache present | Uses the cache quietly; fetches again next launch |
| Catalogue malformed, or `version` newer than the app supports | Rejected; falls back to the cache and suggests updating the app |
| A track fails to load, or the connection drops mid-track | Skips to the next track; stops after 3 consecutive failures with a message |
| Buffering | Shown in the mini player |
| Trial expires during a track | The track finishes; the next is blocked |
| Device storage unreadable | Falls back to defaults |

## 6. Testing

### Automated

- **App unit tests** with `jest-expo`: filtering, the trial calculation, queue and shuffle order, catalogue validation and URL resolution, cover hashing.
- **Filter parity.** `scripts/filter-golden.mjs`, at the repository root, writes `mobile/src/catalogue/__fixtures__/filter-golden.json`: a snapshot of each track's filterable fields, plus the track ids the web's `filterTracks` returns for a fixed set of filter combinations. The app's test runs its port over that snapshot and must match every entry exactly.
  - **Staleness is caught on the web side.** The app cannot see `lib/tracks.ts`, so it cannot tell that the file is out of date. Instead the web's `node --test` suite regenerates the golden data in memory and fails if the committed file differs. A catalogue or filter change therefore cannot leave a stale file passing silently: it fails the web tests until the script is rerun.
- **Web catalogue route**, in the web's existing `node --test` suite: the JSON matches `lib/tracks.ts`, and the build lists `/catalogue.json` as static rather than dynamic.

### On devices

Background playback and lock-screen controls work only in a development build, not in Expo Go. Expo Go is used for building the interface; a development build is used for:

- Android playback continuing past 5 minutes with the screen locked
- lock-screen play/pause and seek on iOS and Android
- a phone call interrupting and playback resuming
- a Bluetooth speaker disconnecting
- declining notification permission on Android, and what happens to playback after 3 minutes

Tablet layouts are checked on an iPad simulator and an Android tablet emulator.

## Out of scope

- Accounts, login and subscriptions
- In-app purchase
- Offline playback and caching audio
- The marketing pages: home, savings calculator, pricing, artists, about, contact, legal
- Push notifications
- Live copy edits from the web's override store appearing in the app
- Next and previous controls on the lock screen
- The real catalogue, which the app picks up once the web serves it

## Risks

- **Declined notification permission on Android.** It is not established whether declining it stops background playback at the three-minute limit. This is tested on a device before the app is considered working.
- **App Store review.** A trial that expires and directs people to pay on a website is the kind of flow reviewers scrutinise. The product owner chose to keep the trial; the risk is recorded here, not re-argued.
- **Bluetooth disconnect stops the music.** Operating-system behaviour the app cannot override. Venues running Bluetooth speakers will notice.
- **The base URL is temporary.** It must change when the redesign moves to `odatone.com`, or the app will fetch a catalogue that does not exist there.
- **The catalogue will not scale as it stands.** Every track carries 180 waveform peaks. That is trivial for 24 placeholder tracks, but the real catalogue of over 4,000 would make one JSON document of several megabytes, fetched at every launch and cached whole. Before the real catalogue is published, peaks should move out of the catalogue into a per-track request. This design does not do that now, because nothing needs it yet.
