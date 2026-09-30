# Odatone — app

An Expo / React Native app for the Odatone catalogue, built around three
things: **the player, the playlists, and search**. It is the same product
as the website (the repository root, one folder up) and deliberately the same design system —
light first, near-monochrome, and the only colour in the room comes from
the logo's own gradient.

```
npm install
npm run import-tracks     # copies the catalogue + audio from the website
npm start                 # then press i / a, or scan with Expo Go
```

`npm run import-tracks` reads the website from the repository root (`..`).
Point it somewhere else with `node tools/import-tracks.mjs ../some/path`.

---

## What is in it

**Player.** One `expo-audio` instance lives in `src/audio/PlayerProvider.tsx`
and every screen shares it, so audio survives navigation. A mini bar sits
above the tab bar on every tab and on playlist screens; tapping it raises
the full player with the waveform scrubber, transport, shuffle, repeat and
the queue. Before the first play the bar shows an invitation rather than an
empty strip — same behaviour as the dock on the website.

**Playlists.** Five moods and seven curated lists, defined declaratively in
`src/data/catalog.ts` as rules (`{ mood, genres, vox, energy, bpm }`)
rather than as stored track ids, so importing a larger catalogue fills the
lists out on its own. One screen, `app/playlist/[id].tsx`, serves both
kinds: `mood-calm` and `friday`.

**Search.** Live filtering over title, artist, genre and mood — **in both
languages at once**, so "calm" finds the same tracks as "rolig" whichever
language the app is set to. Mood, genre and vocal filters stack on top.
Recent searches persist in `AsyncStorage`.

**Account.** Log in, create an account, reset a password, log out. Playback
is for customers: a signed-in account whose subscription is `pending`,
`trialing`, `active` or `past_due` (or a staff account) can play; anyone
can browse. The rule is `src/auth/entitlement.ts`, and
`src/auth/AuthProvider.tsx` holds the session.

Signing up places the same order as the website's form, through
`POST /api/app/signup` on the website, in two steps: the plan, then the
account (name, company, CVR, email, address, and the terms). The CVR is
required, as on the website, and is checked with the same rule (`DK`,
spaces, dots and dashes are allowed; eight digits are sent). The app
collects no payment details at all: the first 14 days are free, and card
entry belongs on the website, so the app stays clear of App Store and
card-security rules. Login, the emailed 6-digit codes
and reading the customer's own subscription go straight to Supabase with
the public anon key; row-level security decides what is visible.

A phone that cannot reach the server keeps playing on its last known
answer for 7 days.

The account is re-read at login, whenever the app returns to the
foreground, on pull-to-refresh on the Account tab, and every 30 minutes
while the app stays open. The play button waits at most 8 seconds
for an answer, and an account read is given up after 15, after which
the app says it couldn't check rather than keep waiting. Logging out
signs out this device only, not the same login on other phones. Play from the lock screen or a headphone
button is held to the same rule as the play button.

## Configuration

Copy `.env.example` to `.env` and fill in the three values. The Supabase
URL and anon key are the website's public ones (`NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the repository root's `.env.local`);
`EXPO_PUBLIC_API_URL` is the website's address with no trailing slash.
Restart `npm start` after changing `.env`.

The signup email must print a 6-digit code. See
`../docs/supabase-email-templates.md` for the dashboard step.

## Tests

`npm test` runs the pure modules under `node --test`: who may play, which
stored identity counts when the auth server cannot be reached, how auth
errors are worded, the signup form's rules, and how the signup endpoint's
answer is read.

## Known limits

- None of the screens, the play gate sheet or the lock-screen behaviour
  has been checked on a device or simulator yet.
- If the account cannot be read and nothing stored says the customer may
  play (the first read after a fresh login fails, or the phone has been
  offline past the 7 days), the play gate says it couldn't check the
  subscription. "Check again", and pull-to-refresh on the Account tab,
  ask once more: they read the account, first getting the session back
  from the auth server (waiting up to 8 seconds for it) if the app was
  opened without reaching it. One exception: for a minute after a failed
  attempt to renew the session, supabase-js answers from that failure
  without asking the server again, so "Check again" can come straight
  back to the same sheet; after the minute it asks for real. The gate
  only says the subscription isn't active when the server has said so.
- The session handling in `AuthProvider` has no automated tests beyond
  its pure functions.
- The app collects no payment details: no card and no invoice (EAN or
  purchase-order) fields. Whatever payment the website takes, it takes
  there.
- There is no in-app purchase. Ordering a subscription in the app without
  one may not pass App Store review.

## Structure

```
app/                        expo-router file routes
  _layout.tsx               providers + stack + the trial notice
  (tabs)/                   index (player) · playlists · search · account
  now-playing.tsx           the full player, presented as a modal
  playlist/[id].tsx         a mood or a curated list
src/
  audio/PlayerProvider.tsx  queue, shuffle, repeat, trial clock
  audio/assets.ts           GENERATED — the static require() map
  data/tracks.ts            GENERATED — the catalogue
  data/catalog.ts           moods, genres, playlist rules
  theme/                    tokens ported from the site's globals.css
  i18n/                     every string, in { da, en }
  components/               Cover, TrackRow, Waveform, MiniPlayer, TabBar…
tools/import-tracks.mjs     the importer
```

Nothing holds copy of its own: strings live in `src/i18n/strings.ts` and
catalogue text lives in `{ da, en }` pairs, exactly like the website's
`lib/content`.

## Things worth knowing

**The audio is placeholder material.** All 24 files were synthesised by the
website's `tools/generate-placeholder-audio.py`, and every artist name is
invented. None of it is Odatone's catalogue. Replace the files in the
website's `public/audio`, re-run `npm run import-tracks`, and set
`TRACKS_ARE_PLACEHOLDER = false`.

**Why the tracks are bundled, not streamed.** They ship inside the app so
it runs with no server at all. That is right for a prototype and wrong for
a real catalogue — a shipping app should stream and cache. When that
happens, `src/audio/assets.ts` goes away and the `AudioSource` in
`PlayerProvider` becomes a URL.

**Metro cannot `require()` a path built at runtime**, which is why
`assets.ts` names all 24 files literally. That file is generated; do not
hand-edit it.

**There is no cover art**, and inventing some would have been worse than
having none. Each track gets a deterministic face instead: the brand
gradient rotated by a hash of its id, with the track's own waveform peaks
drawn over it. A track looks the same in the app as in the browser.

**No Inter.** The website self-hosts Inter as a variable `woff2`, which
React Native cannot load. The app uses the platform grotesque (SF Pro,
Roboto) with the same tight tracking. Bundling `Inter.ttf` is a ~400 KB
decision that can be made later in `src/theme/tokens.ts`.

**The 7-day demo** is a timestamp in `AsyncStorage`
(`odatone.player.trial.v1`). When it runs out, playback is refused and a
notice appears. The visible **Reset demo** button on the Account tab is a
development affordance — remove it before any real release.

**Lock-screen controls and background audio** are wired up
(`setActiveForLockScreen`, `UIBackgroundModes: ["audio"]`, the Android
media-playback foreground service permissions), but the lock-screen part
needs a development build. In Expo Go the audio plays and the controls
simply do not appear.

**Placeholders inherited from the website**: the plan name and price on the
Account tab are hard-coded, and there is no real account — there is no
backend in this project at all.

## Verified

`tsc --noEmit` clean (also with `--noUnusedLocals`), and
`expo export` bundles for iOS and for web without errors. Every screen was
rendered and walked through in a browser at 390×844 in both light and dark:
playback, shuffle, the queue, playlist and mood screens, search with
filters, recents, and the language and appearance switches. It has **not**
been run on a physical device or a simulator — that is the first thing to
do with it.

## If Expo Go shows a red screen or closes on launch

`expo-router` lists `react-native-gesture-handler`, `react-native-reanimated`
and `react-native-worklets` as *optional* peer dependencies, and npm installs
optional peers at their newest published version. That put gesture-handler on
3.2.1, reanimated on 4.6.0 and worklets on 0.12.1 — all ahead of the native
code Expo Go ships for SDK 57 (2.32.0 / 4.5.1 / 0.10.1). The JS half then talks
to native modules that are not there, and the app dies before the first frame.

They are pinned to the bundled versions in `package.json` for that reason. If
you ever add a package and npm drifts them again:

```
npx expo install --check     # lists anything off the SDK's bundled set
npm install
npx expo start -c            # -c clears the Metro cache
```

The app itself does not use any of the three; they are only present because
expo-router pulls them in.

If the phone simply never connects, it is the network rather than the
packages — the Mac and the phone must be on the same Wi-Fi, and a VPN or a
guest network will block it. `npx expo start --tunnel` routes around that.
