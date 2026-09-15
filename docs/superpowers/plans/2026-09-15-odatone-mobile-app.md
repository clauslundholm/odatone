# Odatone Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native iOS and Android player, built with React Native and Expo, that streams the Odatone catalogue published by the website.

**Architecture:** The Next.js site gains one prerendered route, `/catalogue.json`, and one static image. A new Expo app in `mobile/` fetches that catalogue, caches it, and streams audio from the site through a single `expo-audio` player that stays alive in the background and on the lock screen. Pure logic (filtering, trial, queue, resume, covers) lives in small tested modules; React providers wire them to the audio engine and the screens.

**Tech Stack:** Next.js 16 (web, unchanged apart from the route); Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6.0, Expo Router 57, `expo-audio`, AsyncStorage, `react-native-svg`, Inter via `@expo-google-fonts/inter`, Jest via `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-09-15-odatone-mobile-app-design.md`

## Global Constraints

- Expo's own guidance for this SDK: read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code against an Expo API. The web's `AGENTS.md` equally says to read `node_modules/next/dist/docs/` before Next code.
- Install every mobile dependency with `npx expo install`, never `npm install <pkg>`, so versions match SDK 57.
- The app's base URL defaults to `https://odatone.vercel.app`. Never use `SITE.url` (`odatone.com` does not serve the redesign or its audio).
- `mobile/tsconfig.json` must set `"types": ["jest"]`. TypeScript 6 no longer includes `@types` packages automatically; without it every test file fails typecheck.
- `expo-asset` must be installed: `expo-audio` requires it as a peer and the app can crash outside Expo Go without it.
- Use the JS `Tabs` from `expo-router/tabs`, not `NativeTabs`: the mini player must sit above the tab bar, and on tablets the tabs live in a left pane.
- Use one `AudioPlayer` from `createAudioPlayer`, not `AudioPlaylist`, which has no lock-screen API.
- `useColorScheme()` can return `'unspecified'`; treat it as light.
- The app never asks for the microphone. `expo-audio`'s plugin sets `microphonePermission: false` and `recordAudioAndroid: false`.
- The web's route handlers are not cached by default in this Next version: the catalogue route declares `export const dynamic = "force-static"`.
- Web tests are `node --test` and import `lib/` modules by relative path with a `.ts` extension; the `@/` alias only works inside Next.
- Mobile tests cover pure logic only (spec section 6). Screens and the audio engine are verified by running the app.
- Pushing `main` deploys the website to production. Ask the user before every push.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Map

**Web (repository root)**

| File | Responsibility |
| --- | --- |
| `lib/catalogue.ts` | Builds the catalogue document from `lib/tracks.ts` |
| `app/catalogue.json/route.ts` | Serves it, prerendered |
| `lib/filter-golden.ts` | Golden data for the app's filter port |
| `scripts/filter-golden.mjs` | Writes the golden file into the app |
| `scripts/render-app-artwork.mjs` | Renders `public/app-artwork.png` |
| `test/catalogue.test.ts`, `test/filter-golden.test.ts` | Web tests |
| `tsconfig.json`, `.vercelignore` | Keep `mobile/` out of the web build and upload |

**Mobile (`mobile/src/`)**

| File | Responsibility |
| --- | --- |
| `config.ts` | Site URL and artwork URL |
| `i18n.ts`, `copy.ts`, `links.ts` | Locales, strings, links to the website |
| `theme.ts` | Colours, radii, fonts, breakpoint |
| `storage.ts` | Never-throwing JSON storage |
| `catalogue/types.ts`, `filter.ts`, `range.ts` | Catalogue shapes, filtering, tempo range |
| `catalogue/validate.ts`, `load.ts`, `CatalogueGate.tsx` | Parsing, fetching with cache, the loading/error gate |
| `settings/preferences.ts`, `SettingsProvider.tsx` | Appearance and language |
| `player/trial.ts`, `queue.ts`, `session.ts` | Trial, next/previous, resume |
| `player/engine.ts`, `PlayerProvider.tsx` | `expo-audio` wrapper and player state |
| `ui/*` | Text, covers, icons, waveform, buttons, mini player, now playing, notices |
| `app/*` | Expo Router routes |

---

### Task 1: Publish the catalogue from the website

**Files:**
- Create: `lib/catalogue.ts`
- Create: `app/catalogue.json/route.ts`
- Create: `test/catalogue.test.ts`
- Create: `.vercelignore`
- Modify: `tsconfig.json` (the `exclude` array)

**Interfaces:**
- Consumes: `TRACKS`, `GENRES`, `MOODS`, `BPM_MIN`, `BPM_MAX`, `TRACKS_ARE_PLACEHOLDER`, types `Genre`, `Mood`, `Track` from `lib/tracks.ts`; `L10n` from `lib/i18n.ts`.
- Produces: `CATALOGUE_VERSION = 1`; `type Catalogue`; `buildCatalogue(): Catalogue`; `GET /catalogue.json`.

- [ ] **Step 1: Write the failing test**

Create `test/catalogue.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCatalogue, CATALOGUE_VERSION } from "../lib/catalogue.ts";
import { BPM_MAX, BPM_MIN, GENRES, MOODS, TRACKS } from "../lib/tracks.ts";

test("carries the schema version the app checks", () => {
  assert.equal(CATALOGUE_VERSION, 1);
  assert.equal(buildCatalogue().version, CATALOGUE_VERSION);
});

test("publishes every track, in the order lib/tracks lists them", () => {
  assert.deepEqual(
    buildCatalogue().tracks.map((t) => t.id),
    TRACKS.map((t) => t.id),
  );
});

test("keeps audio paths relative, so the route never needs to know its domain", () => {
  for (const track of buildCatalogue().tracks) {
    assert.match(track.src, /^\/audio\/[a-z0-9-]+\.mp3$/, track.id);
  }
});

test("publishes the genre and mood labels and the tempo bounds", () => {
  const catalogue = buildCatalogue();
  assert.deepEqual(catalogue.genres, GENRES);
  assert.deepEqual(catalogue.moods, MOODS);
  assert.deepEqual(catalogue.bpm, { min: BPM_MIN, max: BPM_MAX });
});

test("every track carries the waveform peaks the app draws", () => {
  for (const track of buildCatalogue().tracks) {
    assert.ok(track.peaks.length > 0, track.id);
  }
});

test("survives a JSON round trip unchanged", () => {
  const catalogue = buildCatalogue();
  assert.deepEqual(JSON.parse(JSON.stringify(catalogue)), catalogue);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test test/catalogue.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/catalogue.ts`.

- [ ] **Step 3: Write the catalogue builder**

Create `lib/catalogue.ts`:

```ts
/* The catalogue as the mobile app reads it: everything the player needs from
   lib/tracks, as one document. Imports are relative with the extension because
   the test runner loads this file directly and does not read the "@/" alias. */
import {
  BPM_MAX,
  BPM_MIN,
  GENRES,
  MOODS,
  TRACKS,
  TRACKS_ARE_PLACEHOLDER,
  type Genre,
  type Mood,
  type Track,
} from "./tracks.ts";
import type { L10n } from "./i18n.ts";

/** Raised only for a change that would break an app already installed. */
export const CATALOGUE_VERSION = 1;

export type Catalogue = {
  version: number;
  placeholder: boolean;
  bpm: { min: number; max: number };
  genres: { id: Genre; label: L10n }[];
  moods: { id: Mood; label: L10n; blurb: L10n }[];
  tracks: Track[];
};

export function buildCatalogue(): Catalogue {
  return {
    version: CATALOGUE_VERSION,
    placeholder: TRACKS_ARE_PLACEHOLDER,
    bpm: { min: BPM_MIN, max: BPM_MAX },
    genres: GENRES,
    moods: MOODS,
    tracks: TRACKS,
  };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test test/catalogue.test.ts`
Expected: 6 tests pass. If the `src` test fails, a track's path is not `/audio/<lowercase-hyphenated>.mp3`; report which one rather than loosening the pattern.

- [ ] **Step 5: Add the route**

Create `app/catalogue.json/route.ts`:

```ts
import { buildCatalogue } from "@/lib/catalogue";

/* Route handlers are not cached by default in this version of Next. Without
   this the catalogue would be rendered on every request. It reads nothing from
   the request, so rendering it once at build is correct. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildCatalogue());
}
```

- [ ] **Step 6: Keep the future `mobile/` directory out of the web build**

In `tsconfig.json`, change the `exclude` array from `["node_modules"]` to:

```json
  "exclude": [
    "node_modules",
    "mobile"
  ]
```

Create `.vercelignore`:

```
# The Expo app has its own dependencies and is never part of the web deploy.
mobile/
```

- [ ] **Step 7: Verify the route is prerendered and serves JSON**

Run: `pnpm test && npx tsc --noEmit && npx next build 2>&1 | grep -E "catalogue.json|● /da$"`
Expected: all web tests pass, tsc exits 0, and the route table shows `○ /catalogue.json` (static) while `● /da` is still SSG. If it shows `ƒ /catalogue.json`, the `dynamic` export is missing — stop and fix.

The spec puts "the route stays prerendered" in the web's test suite. It is checked here, and again in Task 13, as a build check instead: proving it means running `next build`, which would make every `pnpm test` take minutes.

Then: `npx next start -p 3300 & sleep 5; curl -s http://localhost:3300/catalogue.json | head -c 160; kill %1`
Expected: JSON beginning `{"version":1,"placeholder":true,"bpm":{"min":55,"max":130}`.

- [ ] **Step 8: Commit**

```bash
git add lib/catalogue.ts app/catalogue.json/route.ts test/catalogue.test.ts tsconfig.json .vercelignore
git commit -m "Publish the track catalogue for the mobile app

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Deploy (ask the user first)**

Pushing `main` deploys production. Ask the user; only on a yes, run `git push origin main`, wait for the deployment to be Ready (`vercel list --yes`), then:

Run: `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://odatone.vercel.app/catalogue.json`
Expected: `200 application/json`.

If the user declines, later tasks point the app at a local server instead (Task 10, Step 7).

---

### Task 2: Scaffold the Expo app

**Files:**
- Create: `mobile/` (via `create-expo-app`), then delete its demo code
- Modify: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`
- Create: `mobile/src/config.ts`, `mobile/src/config.test.ts`
- Create: `mobile/src/app/_layout.tsx`, `mobile/src/app/index.tsx` (placeholders)

**Interfaces:**
- Produces: `DEFAULT_SITE_URL`, `normaliseSiteUrl(raw: string | undefined): string`, `SITE_URL: string`, `ARTWORK_URL: string`; `npm test` and `npm run typecheck` in `mobile/`.

- [ ] **Step 1: Create the project**

From the repository root: `npx create-expo-app@latest mobile --yes`
Expected: `✅ Your project is ready!`. It does not create a nested git repository (verified); confirm with `ls -d mobile/.git` → no such file.

- [ ] **Step 2: Remove the template's demo code**

```bash
cd mobile
rm -rf src/app src/components src/constants src/hooks src/global.css scripts
```

- [ ] **Step 3: Install the app's dependencies**

```bash
npx expo install expo-audio expo-asset expo-localization @react-native-async-storage/async-storage react-native-svg @expo-google-fonts/inter
npx expo install jest-expo jest @types/jest -- --save-dev
```

- [ ] **Step 4: Configure scripts, Jest and TypeScript**

```bash
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.name = "odatone-mobile";
delete pkg.scripts["reset-project"];
pkg.scripts.test = "jest";
pkg.scripts.typecheck = "tsc --noEmit";
pkg.jest = { preset: "jest-expo", setupFiles: ["<rootDir>/jest.setup.ts"] };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
const ts = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
ts.compilerOptions.types = ["jest"];
fs.writeFileSync("tsconfig.json", JSON.stringify(ts, null, 2) + "\n");
'
```

Create `mobile/jest.setup.ts`:

```ts
/* AsyncStorage has no native module under Jest. The package ships this mock
   for exactly that; every test gets it, and tests clear it between runs. */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
```

- [ ] **Step 5: Configure the app**

Replace `mobile/app.json` entirely (installing `expo-audio` and `expo-localization` added plugin entries; this file supersedes them):

```json
{
  "expo": {
    "name": "Odatone",
    "slug": "odatone",
    "version": "1.0.0",
    "orientation": "default",
    "icon": "./assets/images/icon.png",
    "scheme": "odatone",
    "userInterfaceStyle": "automatic",
    "ios": {
      "icon": "./assets/expo.icon",
      "supportsTablet": true,
      "bundleIdentifier": "com.odatone.player"
    },
    "android": {
      "package": "com.odatone.player",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#f5f5f7",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 76
        }
      ],
      [
        "expo-audio",
        {
          "microphonePermission": false,
          "recordAudioAndroid": false,
          "enableBackgroundPlayback": true
        }
      ],
      "expo-localization"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

Why these differ from the template: `orientation: "default"` lets tablets rotate; `supportsTablet: true` stops iPads running a scaled iPhone app; both native identifiers are needed for development builds. `com.odatone.player` is an assumption — the README (Task 13) asks the owner to confirm it before any store submission.

- [ ] **Step 6: Write the failing config test**

Create `mobile/src/config.test.ts`:

```ts
import { DEFAULT_SITE_URL, normaliseSiteUrl } from "./config";

describe("normaliseSiteUrl", () => {
  test("defaults to the deployed redesign, not odatone.com", () => {
    expect(normaliseSiteUrl(undefined)).toBe("https://odatone.vercel.app");
    expect(DEFAULT_SITE_URL).not.toContain("odatone.com");
  });

  test("treats a blank value as unset", () => {
    expect(normaliseSiteUrl("   ")).toBe(DEFAULT_SITE_URL);
  });

  test("strips trailing slashes so paths append cleanly", () => {
    expect(normaliseSiteUrl("http://192.168.1.20:3000///")).toBe("http://192.168.1.20:3000");
  });
});
```

Run: `npm test`
Expected: FAIL, cannot find module `./config`.

- [ ] **Step 7: Write the config**

Create `mobile/src/config.ts`:

```ts
/** Where the redesigned site is served. Not SITE.url from the web: odatone.com
    does not serve the redesign or its audio. Change this when it does. */
export const DEFAULT_SITE_URL = "https://odatone.vercel.app";

/** Falls back to the default when unset or blank, and never ends in a slash,
    so paths append as "/catalogue.json". */
export function normaliseSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  return (value ? value : DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/* Read as process.env.EXPO_PUBLIC_SITE_URL directly: Expo inlines these at
   build time only when accessed statically, never through an object. */
export const SITE_URL = normaliseSiteUrl(process.env.EXPO_PUBLIC_SITE_URL);

/** One branded image for the lock screen, since generated covers are not files. */
export const ARTWORK_URL = `${SITE_URL}/app-artwork.png`;
```

- [ ] **Step 8: Add placeholder routes so the app boots**

Create `mobile/src/app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `mobile/src/app/index.tsx`:

```tsx
import { Text, View } from "react-native";

/* Placeholder so the scaffold boots. Task 10 replaces it with a playback
   check, and Task 11 deletes it in favour of the tabs. */
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Odatone</Text>
    </View>
  );
}
```

- [ ] **Step 9: Verify**

In `mobile/`:
- `npm test` → 3 tests pass
- `npm run typecheck` → exit 0
- `npx expo-doctor` → `No issues detected!`
- `git -C .. status --short mobile | grep -E "node_modules|\.expo/"` → no output (the template's `.gitignore` covers them)

From the repository root: `npx tsc --noEmit && pnpm test` → web still passes with `mobile/` present.

- [ ] **Step 10: Commit**

```bash
cd ..
git add mobile
git commit -m "Scaffold the Expo app

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Filter parity between web and app

**Files:**
- Create: `lib/filter-golden.ts`, `scripts/filter-golden.mjs`, `test/filter-golden.test.ts` (web)
- Create: `mobile/src/i18n.ts`, `mobile/src/catalogue/types.ts`, `mobile/src/catalogue/filter.ts`, `mobile/src/catalogue/filter.test.ts`
- Create (generated): `mobile/src/catalogue/__fixtures__/filter-golden.json`

**Interfaces:**
- Consumes: `TRACKS`, `BPM_MIN`, `BPM_MAX`, `filterTracks`, `Filters` from `lib/tracks.ts`.
- Produces (web): `GOLDEN_PATH`, `buildGolden(): Golden`.
- Produces (app): `type Locale = "da" | "en"`; `type L10n = Record<Locale, string>`; types `Genre`, `Mood`, `Track`, `Filters`, `BpmRange`, `Catalogue`; `GENRE_IDS`, `MOOD_IDS`; `defaultFilters(bpm: BpmRange): Filters`; `filterTracks(filters: Filters, tracks: readonly Track[]): Track[]`.

- [ ] **Step 1: Write the app's failing parity test**

Create `mobile/src/catalogue/filter.test.ts`:

```ts
import golden from "./__fixtures__/filter-golden.json";
import { defaultFilters, filterTracks } from "./filter";
import type { Filters, Track } from "./types";

/* The golden file holds only the fields filterTracks reads. The rest are inert
   values that must not change the result. */
const tracks = golden.tracks.map((t) => ({
  ...(t as unknown as Pick<Track, "id" | "genre" | "mood" | "bpm" | "vox">),
  title: { da: t.id, en: t.id },
  artist: "",
  energy: 1,
  duration: 0,
  src: "",
  peaks: [],
})) as Track[];

describe("filterTracks matches the web", () => {
  test.each(golden.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const ids = filterTracks(c.filters as unknown as Filters, tracks).map((t) => t.id);
    expect(ids).toEqual(c.ids);
  });
});

test("defaultFilters lets every track through", () => {
  const min = Math.min(...tracks.map((t) => t.bpm));
  const max = Math.max(...tracks.map((t) => t.bpm));
  expect(filterTracks(defaultFilters({ min, max }), tracks)).toHaveLength(tracks.length);
});
```

Run (in `mobile/`): `npm test -- filter`
Expected: FAIL, cannot find `./__fixtures__/filter-golden.json`.

- [ ] **Step 2: Write the web's failing staleness test**

Create `test/filter-golden.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { GOLDEN_PATH, buildGolden } from "../lib/filter-golden.ts";

test("the mobile app's filter golden file is up to date", () => {
  const file = path.join(import.meta.dirname, "..", GOLDEN_PATH);
  const committed = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(committed, buildGolden(), "The golden file is stale. Run: node scripts/filter-golden.mjs");
});

test("the golden cases include an empty and a full result", () => {
  const golden = buildGolden();
  assert.ok(golden.cases.some((c) => c.ids.length === 0));
  assert.ok(golden.cases.some((c) => c.ids.length === golden.tracks.length));
});
```

Run (repository root): `node --test test/filter-golden.test.ts`
Expected: FAIL, cannot find `lib/filter-golden.ts`.

- [ ] **Step 3: Write the golden generator**

Create `lib/filter-golden.ts`:

```ts
/* Golden data for the mobile app's port of filterTracks. scripts/filter-golden.mjs
   writes it into the app; test/filter-golden.test.ts regenerates it here and
   fails if the committed copy has drifted, because the app cannot see this file. */
import { BPM_MAX, BPM_MIN, TRACKS, filterTracks, type Filters } from "./tracks.ts";

export const GOLDEN_PATH = "mobile/src/catalogue/__fixtures__/filter-golden.json";

export type GoldenTrack = { id: string; genre: string; mood: string; bpm: number; vox: boolean };
export type GoldenCase = { name: string; filters: Filters; ids: string[] };
export type Golden = { tracks: GoldenTrack[]; cases: GoldenCase[] };

const all = (overrides: Partial<Filters>): Filters => ({
  genres: [],
  mood: null,
  bpm: [BPM_MIN, BPM_MAX],
  vox: null,
  ...overrides,
});

/* Chosen to cross every branch of filterTracks, including an exact tempo that
   tests both bounds are inclusive, and a range nothing can satisfy. */
function filterCases(): { name: string; filters: Filters }[] {
  const exactTempo = TRACKS[0].bpm;
  return [
    { name: "no filters", filters: all({}) },
    { name: "one genre", filters: all({ genres: ["jazz"] }) },
    { name: "two genres", filters: all({ genres: ["jazz", "acoustic"] }) },
    { name: "mood", filters: all({ mood: "warm" }) },
    { name: "instrumental only", filters: all({ vox: false }) },
    { name: "vocals only", filters: all({ vox: true }) },
    { name: "narrow tempo", filters: all({ bpm: [80, 100] }) },
    { name: "tempo bounds are inclusive", filters: all({ bpm: [exactTempo, exactTempo] }) },
    {
      name: "combined",
      filters: all({ genres: ["acoustic", "jazz"], mood: "warm", bpm: [70, 110], vox: false }),
    },
    { name: "nothing matches", filters: all({ bpm: [BPM_MAX + 1, BPM_MAX + 1] }) },
  ];
}

export function buildGolden(): Golden {
  return {
    tracks: TRACKS.map(({ id, genre, mood, bpm, vox }) => ({ id, genre, mood, bpm, vox })),
    cases: filterCases().map(({ name, filters }) => ({
      name,
      filters,
      ids: filterTracks(filters).map((t) => t.id),
    })),
  };
}
```

Create `scripts/filter-golden.mjs`:

```js
#!/usr/bin/env node
/* Regenerates the golden file the mobile app's filter test reads. Run it
   whenever filterTracks or the catalogue changes; the web tests fail until
   you do. Usage: node scripts/filter-golden.mjs */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { GOLDEN_PATH, buildGolden } from "../lib/filter-golden.ts";

const out = path.join(import.meta.dirname, "..", GOLDEN_PATH);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(buildGolden(), null, 2)}\n`);
console.log(`Wrote ${GOLDEN_PATH}`);
```

- [ ] **Step 4: Generate the golden file and pass the web test**

Run: `node scripts/filter-golden.mjs && node --test test/filter-golden.test.ts`
Expected: `Wrote mobile/src/catalogue/__fixtures__/filter-golden.json`, then 2 tests pass.

- [ ] **Step 5: Write the app's types**

Create `mobile/src/i18n.ts`:

```ts
export type Locale = "da" | "en";

/** A string in both of the app's languages. */
export type L10n = Record<Locale, string>;
```

Create `mobile/src/catalogue/types.ts`:

```ts
import type { L10n } from "@/i18n";

/* These mirror lib/tracks.ts on the web. parseCatalogue checks every field on
   arrival, so a mismatch shows up as a rejected catalogue, not a crash later. */

export type Genre =
  | "ambient"
  | "electronic"
  | "jazz"
  | "acoustic"
  | "hiphop"
  | "rnb"
  | "pop"
  | "classical";

export type Mood = "calm" | "focus" | "warm" | "evening" | "energy";

export const GENRE_IDS: readonly Genre[] = [
  "ambient",
  "electronic",
  "jazz",
  "acoustic",
  "hiphop",
  "rnb",
  "pop",
  "classical",
];

export const MOOD_IDS: readonly Mood[] = ["calm", "focus", "warm", "evening", "energy"];

export type Track = {
  id: string;
  title: L10n;
  artist: string;
  genre: Genre;
  mood: Mood;
  bpm: number;
  vox: boolean;
  /** 1 = barely there, 5 = drives the room. */
  energy: number;
  /** Seconds. */
  duration: number;
  /** Absolute once the catalogue has been parsed. */
  src: string;
  /** Normalised 0–1 waveform peaks. */
  peaks: number[];
};

export type Filters = {
  genres: Genre[];
  mood: Mood | null;
  bpm: [number, number];
  /** null = either, true = only with vocals, false = only instrumental. */
  vox: boolean | null;
};

export type BpmRange = { min: number; max: number };

export type Catalogue = {
  version: number;
  placeholder: boolean;
  bpm: BpmRange;
  genres: { id: Genre; label: L10n }[];
  moods: { id: Mood; label: L10n; blurb: L10n }[];
  tracks: Track[];
};
```

- [ ] **Step 6: Port the filter**

Create `mobile/src/catalogue/filter.ts`:

```ts
import type { BpmRange, Filters, Track } from "./types";

/** No filtering: every genre, any mood, the full tempo range, either vocals. */
export function defaultFilters(bpm: BpmRange): Filters {
  return { genres: [], mood: null, bpm: [bpm.min, bpm.max], vox: null };
}

/**
 * A port of filterTracks in the web's lib/tracks.ts, and it must stay one:
 * filter.test.ts checks it against a golden file the web generates. Order is
 * preserved and both tempo bounds are inclusive.
 */
export function filterTracks(filters: Filters, tracks: readonly Track[]): Track[] {
  return tracks.filter((t) => {
    if (filters.genres.length && !filters.genres.includes(t.genre)) return false;
    if (filters.mood && t.mood !== filters.mood) return false;
    if (t.bpm < filters.bpm[0] || t.bpm > filters.bpm[1]) return false;
    if (filters.vox !== null && t.vox !== filters.vox) return false;
    return true;
  });
}
```

- [ ] **Step 7: Run everything**

In `mobile/`: `npm test && npm run typecheck`
Expected: 11 test cases in `filter.test.ts` pass (10 golden cases plus `defaultFilters`), config tests still pass, typecheck exits 0.

Repository root: `pnpm test`
Expected: all web tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/filter-golden.ts scripts/filter-golden.mjs test/filter-golden.test.ts mobile/src/i18n.ts mobile/src/catalogue
git commit -m "Port the track filter to the app, checked against the web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Load and cache the catalogue

**Files:**
- Create: `mobile/src/storage.ts`
- Create: `mobile/src/catalogue/validate.ts`, `mobile/src/catalogue/validate.test.ts`
- Create: `mobile/src/catalogue/load.ts`, `mobile/src/catalogue/load.test.ts`
- Create: `mobile/src/catalogue/__fixtures__/catalogue.ts`

**Interfaces:**
- Consumes: types and `GENRE_IDS`, `MOOD_IDS` from Task 3; `L10n` from `@/i18n`.
- Produces:
  - `readJson(key: string): Promise<unknown>`; `writeJson(key: string, value: unknown): Promise<void>` — never throw.
  - `SUPPORTED_VERSION = 1`; `type ParseFailure = "malformed" | "unsupported-version"`; `type ParseResult = { ok: true; catalogue: Catalogue } | { ok: false; reason: ParseFailure }`; `parseCatalogue(input: unknown, siteUrl: string): ParseResult`.
  - `CATALOGUE_CACHE_KEY = "odatone.catalogue.v1"`; `type LoadFailure = "unreachable" | ParseFailure`; `type LoadResult = { status: "fresh"; catalogue: Catalogue } | { status: "cached"; catalogue: Catalogue; reason: LoadFailure } | { status: "unavailable"; reason: LoadFailure }`; `loadCatalogue(siteUrl: string, fetcher?: typeof fetch): Promise<LoadResult>`.
  - Fixtures: `TEST_SITE_URL = "https://example.test"`, `rawCatalogue()`, `parsedCatalogue(): Catalogue` — used by Tasks 7, 8.

- [ ] **Step 1: Write the fixture**

Create `mobile/src/catalogue/__fixtures__/catalogue.ts`:

```ts
import type { Catalogue } from "../types";
import { parseCatalogue } from "../validate";

export const TEST_SITE_URL = "https://example.test";

/** A small valid catalogue as the web publishes it, with relative audio paths.
    A function, so each test mutates its own copy. */
export function rawCatalogue() {
  return {
    version: 1,
    placeholder: true,
    bpm: { min: 55, max: 130 },
    genres: [
      { id: "jazz", label: { da: "Jazz", en: "Jazz" } },
      { id: "acoustic", label: { da: "Akustisk", en: "Acoustic" } },
    ],
    moods: [
      {
        id: "warm",
        label: { da: "Varm", en: "Warm" },
        blurb: { da: "Frokost, butik, salon", en: "Lunch, retail, salon" },
      },
      {
        id: "calm",
        label: { da: "Rolig", en: "Calm" },
        blurb: { da: "Morgenåbning, venteværelse, spa", en: "Opening hours, waiting rooms, spa" },
      },
    ],
    tracks: [
      {
        id: "soft-open",
        title: { da: "Soft Open", en: "Soft Open" },
        artist: "Test Artist",
        genre: "acoustic",
        mood: "calm",
        bpm: 72,
        vox: false,
        energy: 1,
        duration: 200,
        src: "/audio/soft-open.mp3",
        peaks: [0.527, 0.3, 0.8],
      },
      {
        id: "counter-run",
        title: { da: "Counter Run", en: "Counter Run" },
        artist: "Test Artist",
        genre: "jazz",
        mood: "warm",
        bpm: 96,
        vox: true,
        energy: 3,
        duration: 180,
        src: "/audio/counter-run.mp3",
        peaks: [0.253, 0.6, 0.4],
      },
      {
        id: "corner-table",
        title: { da: "Corner Table", en: "Corner Table" },
        artist: "Test Artist",
        genre: "jazz",
        mood: "warm",
        bpm: 88,
        vox: false,
        energy: 2,
        duration: 220,
        src: "/audio/corner-table.mp3",
        peaks: [0.735, 0.2, 0.5],
      },
    ],
  };
}

export function parsedCatalogue(): Catalogue {
  const result = parseCatalogue(rawCatalogue(), TEST_SITE_URL);
  if (!result.ok) throw new Error(`The fixture catalogue is invalid: ${result.reason}`);
  return result.catalogue;
}
```

- [ ] **Step 2: Write the failing validation tests**

Create `mobile/src/catalogue/validate.test.ts`:

```ts
import { TEST_SITE_URL, rawCatalogue } from "./__fixtures__/catalogue";
import { SUPPORTED_VERSION, parseCatalogue } from "./validate";

const parse = (input: unknown) => parseCatalogue(input, TEST_SITE_URL);

test("accepts a well-formed catalogue and resolves audio against the site", () => {
  const result = parse(rawCatalogue());
  if (!result.ok) throw new Error(result.reason);
  expect(result.catalogue.tracks).toHaveLength(3);
  expect(result.catalogue.tracks[0].src).toBe("https://example.test/audio/soft-open.mp3");
});

test("leaves an already absolute audio URL alone", () => {
  const raw = rawCatalogue();
  raw.tracks[0].src = "https://cdn.example.test/a.mp3";
  const result = parse(raw);
  if (!result.ok) throw new Error(result.reason);
  expect(result.catalogue.tracks[0].src).toBe("https://cdn.example.test/a.mp3");
});

test("rejects a newer version than this build understands", () => {
  expect(parse({ ...rawCatalogue(), version: SUPPORTED_VERSION + 1 })).toEqual({
    ok: false,
    reason: "unsupported-version",
  });
});

test.each([
  ["a string", "nope"],
  ["null", null],
  ["no version", { ...rawCatalogue(), version: undefined }],
  ["no tracks", { ...rawCatalogue(), tracks: [] }],
  ["reversed tempo bounds", { ...rawCatalogue(), bpm: { min: 130, max: 55 } }],
])("rejects %s", (_label, input) => {
  expect(parse(input)).toEqual({ ok: false, reason: "malformed" });
});

test.each([
  ["an unknown genre", { genre: "polka" }],
  ["an unknown mood", { mood: "sleepy" }],
  ["a missing Danish title", { title: { en: "Only English" } }],
  ["an unrooted audio path", { src: "audio/x.mp3" }],
  ["non-numeric peaks", { peaks: [0.1, "loud"] }],
])("rejects the whole catalogue when one track has %s", (_label, patch) => {
  const raw = rawCatalogue();
  Object.assign(raw.tracks[1], patch);
  expect(parse(raw)).toEqual({ ok: false, reason: "malformed" });
});
```

Run (in `mobile/`): `npm test -- validate`
Expected: FAIL, cannot find module `./validate`.

- [ ] **Step 3: Write storage and validation**

Create `mobile/src/storage.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

/*
 * Everything the app keeps on the device goes through these. Storage failing is
 * never fatal — the app falls back to defaults, as the web does without
 * localStorage — so neither function ever throws.
 */

export async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Not remembering is acceptable; crashing is not. */
  }
}
```

Create `mobile/src/catalogue/validate.ts`:

```ts
import type { L10n } from "@/i18n";

import { GENRE_IDS, MOOD_IDS, type Catalogue, type Genre, type Mood, type Track } from "./types";

/** The newest catalogue shape this build of the app understands. */
export const SUPPORTED_VERSION = 1;

export type ParseFailure = "malformed" | "unsupported-version";
export type ParseResult = { ok: true; catalogue: Catalogue } | { ok: false; reason: ParseFailure };

type Json = Record<string, unknown>;

const MALFORMED: ParseResult = { ok: false, reason: "malformed" };

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isL10n = (v: unknown): v is L10n => isObject(v) && isString(v.da) && isString(v.en);
const isGenre = (v: unknown): v is Genre => (GENRE_IDS as readonly unknown[]).includes(v);
const isMood = (v: unknown): v is Mood => (MOOD_IDS as readonly unknown[]).includes(v);
const isAbsolute = (s: string) => /^https?:\/\//.test(s);

function parseTrack(v: unknown, siteUrl: string): Track | null {
  if (!isObject(v)) return null;
  const { id, title, artist, genre, mood, bpm, vox, energy, duration, src, peaks } = v;
  if (!isString(id) || !id || !isL10n(title) || !isString(artist)) return null;
  if (!isGenre(genre) || !isMood(mood)) return null;
  if (!isNumber(bpm) || typeof vox !== "boolean" || !isNumber(energy) || !isNumber(duration)) return null;
  if (!isString(src) || !(src.startsWith("/") || isAbsolute(src))) return null;
  if (!Array.isArray(peaks) || !peaks.every(isNumber)) return null;
  return {
    id,
    title,
    artist,
    genre,
    mood,
    bpm,
    vox,
    energy,
    duration,
    src: isAbsolute(src) ? src : `${siteUrl}${src}`,
    peaks,
  };
}

/**
 * Checks a catalogue from the network or the cache. Anything short of a
 * complete, well-formed document is rejected whole: a half-trusted catalogue
 * would fail somewhere far less obvious than here.
 */
export function parseCatalogue(input: unknown, siteUrl: string): ParseResult {
  if (!isObject(input)) return MALFORMED;

  const version = input.version;
  if (!isNumber(version) || version < 1) return MALFORMED;
  if (version > SUPPORTED_VERSION) return { ok: false, reason: "unsupported-version" };

  const placeholder = input.placeholder;
  if (typeof placeholder !== "boolean") return MALFORMED;

  const bpm = input.bpm;
  if (!isObject(bpm)) return MALFORMED;
  const min = bpm.min;
  const max = bpm.max;
  if (!isNumber(min) || !isNumber(max) || min > max) return MALFORMED;

  const genres = input.genres;
  if (!Array.isArray(genres) || !genres.every((g) => isObject(g) && isGenre(g.id) && isL10n(g.label))) {
    return MALFORMED;
  }

  const moods = input.moods;
  if (
    !Array.isArray(moods) ||
    !moods.every((m) => isObject(m) && isMood(m.id) && isL10n(m.label) && isL10n(m.blurb))
  ) {
    return MALFORMED;
  }

  const tracks = input.tracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return MALFORMED;
  const parsed: Track[] = [];
  for (const raw of tracks) {
    const track = parseTrack(raw, siteUrl);
    if (!track) return MALFORMED;
    parsed.push(track);
  }

  return {
    ok: true,
    catalogue: {
      version,
      placeholder,
      bpm: { min, max },
      genres: genres as Catalogue["genres"],
      moods: moods as Catalogue["moods"],
      tracks: parsed,
    },
  };
}
```

Run: `npm test -- validate`
Expected: 13 tests pass.

- [ ] **Step 4: Write the failing loader tests**

Create `mobile/src/catalogue/load.test.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

import { TEST_SITE_URL, rawCatalogue } from "./__fixtures__/catalogue";
import { CATALOGUE_CACHE_KEY, loadCatalogue } from "./load";

const respond = (body: unknown, status = 200) =>
  jest.fn(
    async () =>
      ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response,
  );

const failing = () =>
  jest.fn(async (): Promise<Response> => {
    throw new TypeError("Network request failed");
  });

const notJson = () =>
  jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }) as unknown as Response,
  );

const cache = async (value: unknown) => AsyncStorage.setItem(CATALOGUE_CACHE_KEY, JSON.stringify(value));
const cached = async () => JSON.parse((await AsyncStorage.getItem(CATALOGUE_CACHE_KEY)) ?? "null");

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("asks the site for its catalogue", async () => {
  const fetcher = respond(rawCatalogue());
  await loadCatalogue(TEST_SITE_URL, fetcher);
  expect(fetcher).toHaveBeenCalledWith("https://example.test/catalogue.json");
});

test("uses a good response and caches it exactly as published", async () => {
  const result = await loadCatalogue(TEST_SITE_URL, respond(rawCatalogue()));
  expect(result.status).toBe("fresh");
  expect(await cached()).toEqual(rawCatalogue());
});

test("without a network, uses the cached copy and says why", async () => {
  await cache(rawCatalogue());
  expect(await loadCatalogue(TEST_SITE_URL, failing())).toMatchObject({
    status: "cached",
    reason: "unreachable",
  });
});

test("without a network or a cache, reports the catalogue unavailable", async () => {
  expect(await loadCatalogue(TEST_SITE_URL, failing())).toEqual({
    status: "unavailable",
    reason: "unreachable",
  });
});

test("counts a server error as unreachable", async () => {
  expect(await loadCatalogue(TEST_SITE_URL, respond({}, 500))).toEqual({
    status: "unavailable",
    reason: "unreachable",
  });
});

test("counts a body that is not JSON as malformed", async () => {
  expect(await loadCatalogue(TEST_SITE_URL, notJson())).toEqual({
    status: "unavailable",
    reason: "malformed",
  });
});

test("falls back to the cache when the site's catalogue is newer than the app", async () => {
  await cache(rawCatalogue());
  expect(await loadCatalogue(TEST_SITE_URL, respond({ ...rawCatalogue(), version: 2 }))).toMatchObject({
    status: "cached",
    reason: "unsupported-version",
  });
});

test("never overwrites a good cached copy with a rejected one", async () => {
  await cache(rawCatalogue());
  await loadCatalogue(TEST_SITE_URL, respond({ version: 1 }));
  expect(await cached()).toEqual(rawCatalogue());
});
```

Run: `npm test -- load`
Expected: FAIL, cannot find module `./load`.

- [ ] **Step 5: Write the loader**

Create `mobile/src/catalogue/load.ts`:

```ts
import { readJson, writeJson } from "@/storage";

import type { Catalogue } from "./types";
import { parseCatalogue, type ParseFailure } from "./validate";

export const CATALOGUE_CACHE_KEY = "odatone.catalogue.v1";

export type LoadFailure = "unreachable" | ParseFailure;

export type LoadResult =
  | { status: "fresh"; catalogue: Catalogue }
  | { status: "cached"; catalogue: Catalogue; reason: LoadFailure }
  | { status: "unavailable"; reason: LoadFailure };

async function fetchCatalogue(
  siteUrl: string,
  fetcher: typeof fetch,
): Promise<{ raw: unknown } | { failure: LoadFailure }> {
  let response: Response;
  try {
    response = await fetcher(`${siteUrl}/catalogue.json`);
  } catch {
    return { failure: "unreachable" };
  }
  if (!response.ok) return { failure: "unreachable" };
  try {
    return { raw: await response.json() };
  } catch {
    return { failure: "malformed" };
  }
}

/**
 * The network first, then the last good copy on the device.
 *
 * The cache holds the document as the site published it, relative paths and
 * all, and is parsed again on every read — so changing the site URL never
 * leaves the app streaming from the old one.
 */
export async function loadCatalogue(siteUrl: string, fetcher: typeof fetch = fetch): Promise<LoadResult> {
  const fetched = await fetchCatalogue(siteUrl, fetcher);

  let reason: LoadFailure;
  if ("raw" in fetched) {
    const parsed = parseCatalogue(fetched.raw, siteUrl);
    if (parsed.ok) {
      await writeJson(CATALOGUE_CACHE_KEY, fetched.raw);
      return { status: "fresh", catalogue: parsed.catalogue };
    }
    reason = parsed.reason;
  } else {
    reason = fetched.failure;
  }

  const fromCache = parseCatalogue(await readJson(CATALOGUE_CACHE_KEY), siteUrl);
  return fromCache.ok
    ? { status: "cached", catalogue: fromCache.catalogue, reason }
    : { status: "unavailable", reason };
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck`
Expected: every suite passes (load: 8 tests), typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/storage.ts mobile/src/catalogue
git commit -m "Load the catalogue with a cached fallback

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Language, copy, theme and preferences

**Files:**
- Modify: `mobile/src/i18n.ts`
- Create: `mobile/src/i18n.test.ts`, `mobile/src/copy.ts`, `mobile/src/theme.ts`, `mobile/src/links.ts`, `mobile/src/links.test.ts`
- Create: `mobile/src/settings/preferences.ts`, `mobile/src/settings/preferences.test.ts`, `mobile/src/settings/SettingsProvider.tsx`

**Interfaces:**
- Consumes: `Locale`, `L10n` (Task 3); `SITE_URL` (Task 2); `readJson`, `writeJson` (Task 4).
- Produces:
  - `localeFromLanguage(code: string | null | undefined): Locale`; `format(template: string, values: Record<string, string | number>): string`.
  - `copy` — an object of `L10n` strings with the keys listed in Step 3.
  - `type Scheme = "light" | "dark"`; `type Colors`; `palette: Record<Scheme, Colors>`; `playerColors: Colors`; `radius`; `fonts` (`regular`, `medium`, `semibold`); `coverGradient`; `WIDE_BREAKPOINT = 768`.
  - `type WebPage = "signup" | "pricing"`; `webUrl(page: WebPage, locale: Locale, siteUrl?: string): string`.
  - `type AppearancePref = "system" | Scheme`; `type LanguagePref = "system" | Locale`; `type Preferences`; `PREFERENCES_KEY`; `DEFAULT_PREFERENCES`; `resolveScheme(pref, system: string | null | undefined): Scheme`; `resolveLocale(pref, deviceLanguage): Locale`; `parsePreferences(raw: unknown): Preferences`.
  - `SettingsProvider`; `useSettings(): { ready, preferences, scheme, colors, locale, t(text: L10n): string, setAppearance(pref), setLanguage(pref) }`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/i18n.test.ts`:

```ts
import { format, localeFromLanguage } from "./i18n";

test.each([
  ["da", "da"],
  ["DA", "da"],
  ["en", "en"],
  ["sv", "en"],
  [null, "en"],
  [undefined, "en"],
])("a device language of %p reads as %p", (code, locale) => {
  expect(localeFromLanguage(code)).toBe(locale);
});

test("format fills placeholders", () => {
  expect(format("Free demo — {n} days left", { n: 3 })).toBe("Free demo — 3 days left");
});

test("format leaves an unknown placeholder visible", () => {
  expect(format("{n} of {total}", { n: 1 })).toBe("1 of {total}");
});
```

Create `mobile/src/links.test.ts`:

```ts
import { webUrl } from "./links";

test("signup follows the web's localised slugs", () => {
  expect(webUrl("signup", "da", "https://x.test")).toBe("https://x.test/da/kom-i-gang");
  expect(webUrl("signup", "en", "https://x.test")).toBe("https://x.test/en/get-started");
});

test("pricing follows the web's localised slugs", () => {
  expect(webUrl("pricing", "da", "https://x.test")).toBe("https://x.test/da/priser");
  expect(webUrl("pricing", "en", "https://x.test")).toBe("https://x.test/en/pricing");
});
```

Create `mobile/src/settings/preferences.test.ts`:

```ts
import { DEFAULT_PREFERENCES, parsePreferences, resolveLocale, resolveScheme } from "./preferences";

describe("resolveScheme", () => {
  test("follows the device", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
  });

  test("reads an unspecified device preference as light", () => {
    expect(resolveScheme("system", "unspecified")).toBe("light");
    expect(resolveScheme("system", null)).toBe("light");
  });

  test("an override wins over the device", () => {
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
  });
});

describe("resolveLocale", () => {
  test("follows the device", () => {
    expect(resolveLocale("system", "da")).toBe("da");
    expect(resolveLocale("system", "de")).toBe("en");
  });

  test("an override wins over the device", () => {
    expect(resolveLocale("en", "da")).toBe("en");
  });
});

describe("parsePreferences", () => {
  test("keeps valid stored preferences", () => {
    expect(parsePreferences({ appearance: "dark", language: "da" })).toEqual({ appearance: "dark", language: "da" });
  });

  test("replaces anything unrecognised with the defaults", () => {
    expect(parsePreferences({ appearance: "neon", language: 7 })).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });
});
```

Run (in `mobile/`): `npm test -- i18n links preferences`
Expected: FAIL — `localeFromLanguage` is not exported, and `./links` and `./preferences` do not exist.

- [ ] **Step 2: Extend i18n**

Append to `mobile/src/i18n.ts`:

```ts

/** Danish on a Danish device, English everywhere else, as on the web. */
export function localeFromLanguage(languageCode: string | null | undefined): Locale {
  return languageCode?.toLowerCase() === "da" ? "da" : "en";
}

/** Fills {name} placeholders. An unknown one is left visible rather than
    silently dropped, so a missing value gets noticed. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}
```

- [ ] **Step 3: Write the copy**

Create `mobile/src/copy.ts`:

```ts
import type { L10n } from "@/i18n";

/*
 * Strings for the app. Where the web says the same thing, the wording is
 * copied from lib/content/player.ts unchanged; the web's keyboard hints and
 * browser-autoplay messages have no place on a device and are left out.
 * Strings marked NEW exist only in the app and need a Danish review.
 */
export const copy = {
  tabMoods: { da: "Stemninger", en: "Moods" }, // NEW
  tabLibrary: { da: "Bibliotek", en: "Library" },
  tabSettings: { da: "Indstillinger", en: "Settings" }, // NEW

  moodsLede: { da: "Vælg rummet. Vi spiller musikken.", en: "Pick the room. We'll play the music." }, // NEW

  mood: { da: "Stemning", en: "Mood" },
  anyMood: { da: "Alle stemninger", en: "Any mood" },
  genre: { da: "Genre", en: "Genre" },
  tempo: { da: "Tempo", en: "Tempo" },
  vocals: { da: "Vokal", en: "Vocals" },
  voxAny: { da: "Begge", en: "Either" },
  voxOn: { da: "Med vokal", en: "With vocals" },
  voxOff: { da: "Instrumental", en: "Instrumental" },
  allGenres: { da: "Alle genrer", en: "All genres" },
  nothingMatches: { da: "Ingen numre matcher. Løsn et filter.", en: "Nothing matches. Loosen a filter." },
  reset: { da: "Nulstil filtre", en: "Reset filters" },
  tracksInQueue: { da: "{n} numre i kø", en: "{n} tracks queued" },
  trackInQueue: { da: "{n} nummer i kø", en: "{n} track queued" },
  slower: { da: "Langsommere", en: "Slower" }, // NEW
  faster: { da: "Hurtigere", en: "Faster" }, // NEW

  nowPlaying: { da: "Spiller nu", en: "Now playing" },
  shuffle: { da: "Bland", en: "Shuffle" },
  play: { da: "Afspil", en: "Play" }, // NEW
  pause: { da: "Pause", en: "Pause" }, // NEW
  next: { da: "Næste", en: "Next" }, // NEW
  previous: { da: "Forrige", en: "Previous" }, // NEW
  close: { da: "Luk afspilleren", en: "Close the player" },
  buffering: { da: "Indlæser…", en: "Loading…" }, // NEW
  idleTitle: { da: "Hør hvordan din forretning kommer til at lyde", en: "Hear how your business is going to sound" },
  bpmVox: { da: "BPM · med vokal", en: "BPM · with vocals" },
  bpmInst: { da: "BPM · instrumental", en: "BPM · instrumental" },

  trialRunning: { da: "Gratis demo — {n} dage tilbage", en: "Free demo — {n} days left" },
  trialLastDay: { da: "Gratis demo — sidste dag", en: "Free demo — last day" },
  trialNotStarted: { da: "Gratis demo — starter når du trykker play", en: "Free demo — starts when you press play" },
  expiredTitle: { da: "Demoen er slut.", en: "The demo is over." },
  expiredBody: {
    da: "Du har hørt {days} dage af biblioteket. Hele kataloget — over 4.000 numre — åbner i det øjeblik du starter en prøveperiode. 14 dage gratis, intet betalingskort.",
    en: "You have had {days} days of the library. The whole catalogue — over 4,000 tracks — opens the moment you start a trial. 14 days free, no card.",
  },
  lockedCta: { da: "Få 14 dage gratis", en: "Get 14 days free" },
  placeholderNote: {
    da: "Demobiblioteket her er syntetiserede eksempler, ikke Odatones rigtige katalog.",
    en: "This demo library is synthesised sample material, not Odatone's real catalogue.",
  },

  unreachableTitle: { da: "Kan ikke nå Odatone", en: "Can't reach Odatone" }, // NEW
  unreachableBody: { da: "Tjek forbindelsen, og prøv igen.", en: "Check the connection and try again." }, // NEW
  malformedBody: {
    da: "Biblioteket kom ikke helt igennem. Prøv igen om lidt.",
    en: "The library didn't arrive intact. Try again shortly.",
  }, // NEW
  updateTitle: { da: "Opdater appen", en: "Update the app" }, // NEW
  updateBody: {
    da: "Biblioteket er nyere end denne version af appen. Opdater den for at få det nyeste.",
    en: "The library is newer than this version of the app. Update it to get the latest.",
  }, // NEW
  staleNotice: { da: "Viser det senest hentede bibliotek.", en: "Showing the last library that loaded." }, // NEW
  retry: { da: "Prøv igen", en: "Try again" }, // NEW
  gaveUpTitle: { da: "Musikken stoppede", en: "The music stopped" }, // NEW
  gaveUpBody: {
    da: "Flere numre i træk kunne ikke afspilles. Tjek forbindelsen, og tryk play igen.",
    en: "Several tracks in a row couldn't play. Check the connection and press play again.",
  }, // NEW
  dismiss: { da: "OK", en: "OK" }, // NEW

  appearance: { da: "Udseende", en: "Appearance" }, // NEW
  matchDevice: { da: "Som enheden", en: "Match device" }, // NEW
  appearanceLight: { da: "Lyst", en: "Light" }, // NEW
  appearanceDark: { da: "Mørkt", en: "Dark" }, // NEW
  language: { da: "Sprog", en: "Language" }, // NEW
  languageDa: { da: "Dansk", en: "Dansk" },
  languageEn: { da: "English", en: "English" },
  demo: { da: "Demo", en: "Demo" }, // NEW
  pricing: { da: "Se priser", en: "See pricing" }, // NEW
} satisfies Record<string, L10n>;
```

- [ ] **Step 4: Write the theme and links**

Create `mobile/src/theme.ts`:

```ts
/* Ported from app/globals.css on the web: the light :root tokens and the
   :root[data-theme="dark"] set, unchanged. */

export type Scheme = "light" | "dark";

export type Colors = {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
};

export const palette: Record<Scheme, Colors> = {
  light: {
    bg: "#f5f5f7",
    surface: "#ffffff",
    surface2: "#ececee",
    surface3: "#e2e2e5",
    ink: "#1c1c1e",
    ink2: "#6e6e73",
    ink3: "#8e8e93",
    line: "rgba(0, 0, 0, 0.09)",
    lineStrong: "rgba(0, 0, 0, 0.2)",
    accent: "#7a3aff",
    accentInk: "#ffffff",
    accentSoft: "rgba(122, 58, 255, 0.1)",
  },
  dark: {
    bg: "#0b0b0c",
    surface: "#141416",
    surface2: "#1d1d20",
    surface3: "#27272b",
    ink: "#f5f5f7",
    ink2: "#a1a1a6",
    ink3: "#6e6e73",
    line: "rgba(255, 255, 255, 0.1)",
    lineStrong: "rgba(255, 255, 255, 0.24)",
    accent: "#8f4dff",
    accentInk: "#ffffff",
    accentSoft: "rgba(143, 77, 255, 0.16)",
  },
};

/** The player moment is dark in either theme, as the web's .on-dark islands are. */
export const playerColors: Colors = palette.dark;

export const radius = { sm: 6, md: 12, lg: 16, xl: 24, xxl: 36, pill: 999 } as const;

/** React Native cannot derive weights from one family, so each is its own font. */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
} as const;

/** Cover tiles use this two-stop gradient on the web, not the three-stop brand one. */
export const coverGradient = { from: "#db00ff", to: "#3d7aff" } as const;

/** At or above this window width, library and player sit side by side. */
export const WIDE_BREAKPOINT = 768;
```

Create `mobile/src/links.ts`:

```ts
import { SITE_URL } from "@/config";
import type { Locale } from "@/i18n";

/* The web's localised slugs, from SLUGS in lib/i18n.ts. */
const PATHS = {
  signup: { da: "/da/kom-i-gang", en: "/en/get-started" },
  pricing: { da: "/da/priser", en: "/en/pricing" },
} as const;

export type WebPage = keyof typeof PATHS;

/** A page on the website, in the app's current language. */
export function webUrl(page: WebPage, locale: Locale, siteUrl: string = SITE_URL): string {
  return `${siteUrl}${PATHS[page][locale]}`;
}
```

- [ ] **Step 5: Write the preferences**

Create `mobile/src/settings/preferences.ts`:

```ts
import { localeFromLanguage, type Locale } from "@/i18n";
import type { Scheme } from "@/theme";

export type AppearancePref = "system" | Scheme;
export type LanguagePref = "system" | Locale;
export type Preferences = { appearance: AppearancePref; language: LanguagePref };

export const PREFERENCES_KEY = "odatone.preferences.v1";
export const DEFAULT_PREFERENCES: Preferences = { appearance: "system", language: "system" };

/**
 * The scheme to draw in. React Native reports "unspecified" when the device
 * expresses no preference; that reads as light, the web's default.
 */
export function resolveScheme(pref: AppearancePref, system: string | null | undefined): Scheme {
  if (pref !== "system") return pref;
  return system === "dark" ? "dark" : "light";
}

export function resolveLocale(pref: LanguagePref, deviceLanguage: string | null | undefined): Locale {
  return pref === "system" ? localeFromLanguage(deviceLanguage) : pref;
}

const APPEARANCES: readonly unknown[] = ["system", "light", "dark"];
const LANGUAGES: readonly unknown[] = ["system", "da", "en"];

export function parsePreferences(raw: unknown): Preferences {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    appearance: APPEARANCES.includes(value.appearance)
      ? (value.appearance as AppearancePref)
      : DEFAULT_PREFERENCES.appearance,
    language: LANGUAGES.includes(value.language) ? (value.language as LanguagePref) : DEFAULT_PREFERENCES.language,
  };
}
```

Run: `npm test -- i18n links preferences`
Expected: all pass (i18n 8, links 2, preferences 7).

- [ ] **Step 6: Write the settings provider**

Create `mobile/src/settings/SettingsProvider.tsx`:

```tsx
import { useLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import type { L10n, Locale } from "@/i18n";
import { readJson, writeJson } from "@/storage";
import { palette, type Colors, type Scheme } from "@/theme";

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  parsePreferences,
  resolveLocale,
  resolveScheme,
  type AppearancePref,
  type LanguagePref,
  type Preferences,
} from "./preferences";

type SettingsContextValue = {
  /** False until stored preferences have been read. */
  ready: boolean;
  preferences: Preferences;
  scheme: Scheme;
  colors: Colors;
  locale: Locale;
  t: (text: L10n) => string;
  setAppearance: (pref: AppearancePref) => void;
  setLanguage: (pref: LanguagePref) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [device] = useLocales();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    readJson(PREFERENCES_KEY).then((raw) => {
      if (!live) return;
      setPreferences(parsePreferences(raw));
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  /* Written only after the stored value has been read, so a first render with
     the defaults can never overwrite what the user chose. */
  useEffect(() => {
    if (ready) void writeJson(PREFERENCES_KEY, preferences);
  }, [ready, preferences]);

  const setAppearance = useCallback((appearance: AppearancePref) => {
    setPreferences((current) => ({ ...current, appearance }));
  }, []);

  const setLanguage = useCallback((language: LanguagePref) => {
    setPreferences((current) => ({ ...current, language }));
  }, []);

  const value = useMemo<SettingsContextValue>(() => {
    const scheme = resolveScheme(preferences.appearance, system);
    const locale = resolveLocale(preferences.language, device?.languageCode);
    return {
      ready,
      preferences,
      scheme,
      colors: palette[scheme],
      locale,
      t: (text) => text[locale],
      setAppearance,
      setLanguage,
    };
  }, [ready, preferences, system, device?.languageCode, setAppearance, setLanguage]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck`
Expected: all suites pass; typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/i18n.ts mobile/src/i18n.test.ts mobile/src/copy.ts mobile/src/theme.ts mobile/src/links.ts mobile/src/links.test.ts mobile/src/settings
git commit -m "Add language, copy, theme and appearance preferences

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The 7-day trial

**Files:**
- Create: `mobile/src/player/trial.ts`, `mobile/src/player/trial.test.ts`

**Interfaces:**
- Consumes: `readJson`, `writeJson` (Task 4).
- Produces: `TRIAL_DAYS = 7`; `TRIAL_KEY = "odatone.trial.v1"`; `type TrialState = { started: boolean; daysLeft: number; expired: boolean }`; `trialState(startedAt: number | null, now: number): TrialState`; `readTrialStart(): Promise<number | null>`; `ensureTrialStarted(now: number): Promise<number>`.

- [ ] **Step 1: Write the failing test**

Create `mobile/src/player/trial.test.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

import { TRIAL_DAYS, TRIAL_KEY, ensureTrialStarted, readTrialStart, trialState } from "./trial";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 8, 1);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("trialState", () => {
  test("has not started before the first play", () => {
    expect(trialState(null, START)).toEqual({ started: false, daysLeft: TRIAL_DAYS, expired: false });
  });

  test("has the full week on the first day", () => {
    expect(trialState(START, START)).toEqual({ started: true, daysLeft: 7, expired: false });
  });

  test("counts part of a day as a day left", () => {
    expect(trialState(START, START + 2.5 * DAY).daysLeft).toBe(5);
  });

  test("has one day left during the last day", () => {
    expect(trialState(START, START + 6.2 * DAY)).toEqual({ started: true, daysLeft: 1, expired: false });
  });

  test("expires exactly seven days after the first play", () => {
    expect(trialState(START, START + 7 * DAY)).toEqual({ started: true, daysLeft: 0, expired: true });
  });

  test("a clock set backwards cannot show more than the trial length", () => {
    expect(trialState(START, START - 3 * DAY).daysLeft).toBe(TRIAL_DAYS);
  });
});

describe("storage", () => {
  test("starts the trial once and keeps the original date", async () => {
    expect(await ensureTrialStarted(START)).toBe(START);
    expect(await ensureTrialStarted(START + DAY)).toBe(START);
    expect(await readTrialStart()).toBe(START);
  });

  test("ignores a corrupt stored value", async () => {
    await AsyncStorage.setItem(TRIAL_KEY, JSON.stringify("yesterday"));
    expect(await readTrialStart()).toBeNull();
  });
});
```

Run: `npm test -- trial`
Expected: FAIL, cannot find module `./trial`.

- [ ] **Step 2: Write the trial**

Create `mobile/src/player/trial.ts`:

```ts
import { readJson, writeJson } from "@/storage";

export const TRIAL_DAYS = 7;
export const TRIAL_KEY = "odatone.trial.v1";

const DAY = 24 * 60 * 60 * 1000;

export type TrialState = { started: boolean; daysLeft: number; expired: boolean };

/**
 * The web's rule from lib/audio/trial.ts: seven days from the first press of
 * play. One addition: days left never exceeds the trial length, so a device
 * clock set backwards cannot display more time than the trial ever had.
 */
export function trialState(startedAt: number | null, now: number): TrialState {
  if (startedAt === null) return { started: false, daysLeft: TRIAL_DAYS, expired: false };
  const elapsed = now - startedAt;
  const daysLeft = Math.min(TRIAL_DAYS, Math.max(0, Math.ceil((TRIAL_DAYS * DAY - elapsed) / DAY)));
  return { started: true, daysLeft, expired: elapsed >= TRIAL_DAYS * DAY };
}

const isValidStart = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export async function readTrialStart(): Promise<number | null> {
  const stored = await readJson(TRIAL_KEY);
  return isValidStart(stored) ? stored : null;
}

/** Starts the trial if it has not started, and returns when it did. */
export async function ensureTrialStarted(now: number): Promise<number> {
  const existing = await readTrialStart();
  if (existing !== null) return existing;
  await writeJson(TRIAL_KEY, now);
  return now;
}
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck`
Expected: trial suite passes (8 tests); everything else still passes; typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/player/trial.ts mobile/src/player/trial.test.ts
git commit -m "Add the 7-day trial rule

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Queue navigation and the tempo range

**Files:**
- Create: `mobile/src/player/queue.ts`, `mobile/src/player/queue.test.ts`
- Create: `mobile/src/catalogue/range.ts`, `mobile/src/catalogue/range.test.ts`

**Interfaces:**
- Consumes: `Track`, `Filters`, `BpmRange` (Task 3); `defaultFilters` (Task 3); `parsedCatalogue` fixture (Task 4).
- Produces:
  - `type Random = () => number`; `RESTART_THRESHOLD_SECONDS = 3`; `MAX_CONSECUTIVE_FAILURES = 3`.
  - `randomOther(current: number, length: number, random: Random): number`.
  - `nextIndex(current: number, length: number, shuffle: boolean, random: Random): number` and `previousIndex(...)` — both `-1` for an empty queue.
  - `shouldRestart(positionSeconds: number): boolean`.
  - `afterFailure(consecutive: number): { consecutive: number; giveUp: boolean }`.
  - `indexOfTrack(queue: readonly Track[], id: string | null): number`.
  - `TEMPO_STEP = 5`; `stepTempo(range: [number, number], bound: "low" | "high", delta: number, limits: BpmRange): [number, number]`; `filtersAreDefault(filters: Filters, limits: BpmRange): boolean`.

- [ ] **Step 1: Write the failing queue test**

Create `mobile/src/player/queue.test.ts`:

```ts
import { parsedCatalogue } from "@/catalogue/__fixtures__/catalogue";

import {
  MAX_CONSECUTIVE_FAILURES,
  afterFailure,
  indexOfTrack,
  nextIndex,
  previousIndex,
  randomOther,
  shouldRestart,
} from "./queue";

const fixed = (value: number) => () => value;

describe("in order", () => {
  test("next moves on and wraps at the end", () => {
    expect(nextIndex(0, 3, false, Math.random)).toBe(1);
    expect(nextIndex(2, 3, false, Math.random)).toBe(0);
  });

  test("next starts at the top when nothing is playing", () => {
    expect(nextIndex(-1, 3, false, Math.random)).toBe(0);
  });

  test("previous moves back and wraps at the start", () => {
    expect(previousIndex(1, 3, false, Math.random)).toBe(0);
    expect(previousIndex(0, 3, false, Math.random)).toBe(2);
  });

  test("an empty queue has nowhere to go", () => {
    expect(nextIndex(0, 0, false, Math.random)).toBe(-1);
    expect(previousIndex(0, 0, true, Math.random)).toBe(-1);
  });
});

describe("shuffle", () => {
  test("never repeats the current track", () => {
    for (const value of [0, 0.2, 0.5, 0.99]) {
      for (let current = 0; current < 4; current++) {
        expect(randomOther(current, 4, fixed(value))).not.toBe(current);
      }
    }
  });

  test("can reach every other track", () => {
    const reached = new Set([0, 0.34, 0.67].map((v) => randomOther(1, 4, fixed(v))));
    expect(reached).toEqual(new Set([0, 2, 3]));
  });

  test("a single track has only itself", () => {
    expect(randomOther(0, 1, fixed(0.5))).toBe(0);
  });

  test("with nothing playing, any track can come first", () => {
    expect(randomOther(-1, 3, fixed(0))).toBe(0);
    expect(randomOther(-1, 3, fixed(0.99))).toBe(2);
  });

  test("next and previous both jump to a random other track", () => {
    expect(nextIndex(1, 4, true, fixed(0))).toBe(0);
    expect(previousIndex(1, 4, true, fixed(0.99))).toBe(3);
  });
});

test("previous restarts the track once it is more than three seconds in", () => {
  expect(shouldRestart(3.1)).toBe(true);
  expect(shouldRestart(3)).toBe(false);
});

test("gives up on the third failure in a row", () => {
  const first = afterFailure(0);
  const second = afterFailure(first.consecutive);
  const third = afterFailure(second.consecutive);
  expect([first.giveUp, second.giveUp]).toEqual([false, false]);
  expect(third).toEqual({ consecutive: MAX_CONSECUTIVE_FAILURES, giveUp: true });
});

test("finds a track's place in the queue", () => {
  const { tracks } = parsedCatalogue();
  expect(indexOfTrack(tracks, "counter-run")).toBe(1);
  expect(indexOfTrack(tracks, "missing")).toBe(-1);
  expect(indexOfTrack(tracks, null)).toBe(-1);
});
```

Run: `npm test -- queue`
Expected: FAIL, cannot find module `./queue`.

- [ ] **Step 2: Write the queue logic**

Create `mobile/src/player/queue.ts`:

```ts
import type { Track } from "@/catalogue/types";

/** A source of randomness in [0, 1), injected so shuffle can be tested. */
export type Random = () => number;

/** Previous restarts the current track once it is this far in, as on the web. */
export const RESTART_THRESHOLD_SECONDS = 3;

/** Tracks in a row that may fail before the player stops trying. */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * A different index, chosen uniformly. The web draws until it gets one; this
 * picks from the others directly, so it always finishes in one step.
 */
export function randomOther(current: number, length: number, random: Random): number {
  if (length <= 1) return 0;
  if (current < 0) return Math.floor(random() * length);
  const pick = Math.floor(random() * (length - 1));
  return pick >= current ? pick + 1 : pick;
}

/** Shuffle on the web does not reorder the queue; next jumps to a random other track. */
export function nextIndex(current: number, length: number, shuffle: boolean, random: Random): number {
  if (length === 0) return -1;
  if (shuffle) return randomOther(current, length, random);
  return (current + 1) % length;
}

export function previousIndex(current: number, length: number, shuffle: boolean, random: Random): number {
  if (length === 0) return -1;
  if (shuffle) return randomOther(current, length, random);
  return (current - 1 + length) % length;
}

export function shouldRestart(positionSeconds: number): boolean {
  return positionSeconds > RESTART_THRESHOLD_SECONDS;
}

export function afterFailure(consecutive: number): { consecutive: number; giveUp: boolean } {
  const next = consecutive + 1;
  return { consecutive: next, giveUp: next >= MAX_CONSECUTIVE_FAILURES };
}

export function indexOfTrack(queue: readonly Track[], id: string | null): number {
  return id === null ? -1 : queue.findIndex((t) => t.id === id);
}
```

Run: `npm test -- queue`
Expected: 12 tests pass.

- [ ] **Step 3: Write the failing tempo range test**

The web uses a two-thumb slider for tempo. React Native has no built-in range slider, so the app steps each bound by 5 BPM with buttons — no extra dependency, and easy to hit with a thumb.

Create `mobile/src/catalogue/range.test.ts`:

```ts
import { defaultFilters } from "./filter";
import { TEMPO_STEP, filtersAreDefault, stepTempo } from "./range";

const limits = { min: 55, max: 130 };

describe("stepTempo", () => {
  test("raises the lower bound by one step", () => {
    expect(stepTempo([55, 130], "low", TEMPO_STEP, limits)).toEqual([60, 130]);
  });

  test("never goes past the catalogue's limits", () => {
    expect(stepTempo([55, 130], "low", -TEMPO_STEP, limits)).toEqual([55, 130]);
    expect(stepTempo([55, 130], "high", TEMPO_STEP, limits)).toEqual([55, 130]);
  });

  test("never lets the bounds cross", () => {
    expect(stepTempo([90, 92], "low", TEMPO_STEP, limits)).toEqual([92, 92]);
    expect(stepTempo([90, 92], "high", -TEMPO_STEP, limits)).toEqual([90, 90]);
  });
});

describe("filtersAreDefault", () => {
  test("is true with nothing filtered", () => {
    expect(filtersAreDefault(defaultFilters(limits), limits)).toBe(true);
  });

  test.each([
    ["a genre", { genres: ["jazz" as const] }],
    ["a mood", { mood: "warm" as const }],
    ["vocals", { vox: false }],
    ["a narrower tempo", { bpm: [60, 130] as [number, number] }],
  ])("is false with %s", (_label, patch) => {
    expect(filtersAreDefault({ ...defaultFilters(limits), ...patch }, limits)).toBe(false);
  });
});
```

Run: `npm test -- range`
Expected: FAIL, cannot find module `./range`.

- [ ] **Step 4: Write the tempo range**

Create `mobile/src/catalogue/range.ts`:

```ts
import type { BpmRange, Filters } from "./types";

export const TEMPO_STEP = 5;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Moves one bound of a tempo range, kept inside the catalogue and never past the other bound. */
export function stepTempo(
  range: [number, number],
  bound: "low" | "high",
  delta: number,
  limits: BpmRange,
): [number, number] {
  const [low, high] = range;
  return bound === "low"
    ? [clamp(low + delta, limits.min, high), high]
    : [low, clamp(high + delta, low, limits.max)];
}

/** Whether anything is filtered at all — decides if "Reset filters" is offered. */
export function filtersAreDefault(filters: Filters, limits: BpmRange): boolean {
  return (
    filters.genres.length === 0 &&
    filters.mood === null &&
    filters.vox === null &&
    filters.bpm[0] === limits.min &&
    filters.bpm[1] === limits.max
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck`
Expected: queue (12) and range (8) suites pass with everything else; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/player/queue.ts mobile/src/player/queue.test.ts mobile/src/catalogue/range.ts mobile/src/catalogue/range.test.ts
git commit -m "Add queue navigation and the tempo range

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Resume where the app left off

**Files:**
- Create: `mobile/src/player/session.ts`, `mobile/src/player/session.test.ts`

**Interfaces:**
- Consumes: `defaultFilters` (Task 3); `Catalogue`, `Filters`, `Genre`, `Mood` (Task 3); `readJson`, `writeJson` (Task 4); `parsedCatalogue` fixture.
- Produces: `SESSION_KEY = "odatone.session.v1"`; `type Snapshot = { trackId: string | null; position: number; shuffle: boolean; filters: Filters }`; `parseSnapshot(raw: unknown, catalogue: Catalogue): Snapshot | null`; `loadSnapshot(catalogue: Catalogue): Promise<Snapshot | null>`; `saveSnapshot(snapshot: Snapshot): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `mobile/src/player/session.test.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

import { parsedCatalogue } from "@/catalogue/__fixtures__/catalogue";

import { loadSnapshot, parseSnapshot, saveSnapshot, type Snapshot } from "./session";

const catalogue = parsedCatalogue();

const saved: Snapshot = {
  trackId: "counter-run",
  position: 42,
  shuffle: true,
  filters: { genres: ["jazz"], mood: "warm", bpm: [80, 100], vox: false },
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("round-trips a session", async () => {
  await saveSnapshot(saved);
  expect(await loadSnapshot(catalogue)).toEqual(saved);
});

test("has nothing to resume on first launch", async () => {
  expect(await loadSnapshot(catalogue)).toBeNull();
});

test("forgets a track that has left the catalogue, and its position", () => {
  expect(parseSnapshot({ ...saved, trackId: "gone" }, catalogue)).toMatchObject({ trackId: null, position: 0 });
});

test("keeps the filters when the track has gone", () => {
  expect(parseSnapshot({ ...saved, trackId: "gone" }, catalogue)?.filters).toEqual(saved.filters);
});

test("drops genres and moods this catalogue does not have", () => {
  const result = parseSnapshot(
    { ...saved, filters: { ...saved.filters, genres: ["jazz", "polka", "pop"], mood: "energy" } },
    catalogue,
  );
  expect(result?.filters.genres).toEqual(["jazz"]);
  expect(result?.filters.mood).toBeNull();
});

test("clamps a tempo range to the catalogue's bounds", () => {
  const result = parseSnapshot({ ...saved, filters: { ...saved.filters, bpm: [10, 400] } }, catalogue);
  expect(result?.filters.bpm).toEqual([55, 130]);
});

test("treats anything that is not an object as no session", () => {
  expect(parseSnapshot("nope", catalogue)).toBeNull();
  expect(parseSnapshot(null, catalogue)).toBeNull();
});
```

Run: `npm test -- session`
Expected: FAIL, cannot find module `./session`.

- [ ] **Step 2: Write the session**

Create `mobile/src/player/session.ts`:

```ts
import { defaultFilters } from "@/catalogue/filter";
import type { Catalogue, Filters, Genre, Mood } from "@/catalogue/types";
import { readJson, writeJson } from "@/storage";

export const SESSION_KEY = "odatone.session.v1";

export type Snapshot = { trackId: string | null; position: number; shuffle: boolean; filters: Filters };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A saved session, checked against the catalogue it is about to be used with.
 * Catalogues change between launches, so anything that no longer exists — a
 * removed track, a retired genre — is dropped rather than trusted.
 */
export function parseSnapshot(raw: unknown, catalogue: Catalogue): Snapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const stored = (typeof value.filters === "object" && value.filters !== null ? value.filters : {}) as Record<
    string,
    unknown
  >;

  const trackIds = new Set(catalogue.tracks.map((t) => t.id));
  const genreIds = new Set<unknown>(catalogue.genres.map((g) => g.id));
  const moodIds = new Set<unknown>(catalogue.moods.map((m) => m.id));
  const fallback = defaultFilters(catalogue.bpm);

  const trackId = typeof value.trackId === "string" && trackIds.has(value.trackId) ? value.trackId : null;
  const genres = Array.isArray(stored.genres)
    ? stored.genres.filter((g): g is Genre => genreIds.has(g))
    : fallback.genres;
  const mood = moodIds.has(stored.mood) ? (stored.mood as Mood) : null;

  const range =
    Array.isArray(stored.bpm) && stored.bpm.length === 2 && stored.bpm.every(isFiniteNumber)
      ? (stored.bpm as [number, number])
      : fallback.bpm;
  const low = clamp(Math.min(range[0], range[1]), catalogue.bpm.min, catalogue.bpm.max);
  const high = clamp(Math.max(range[0], range[1]), catalogue.bpm.min, catalogue.bpm.max);

  const position =
    trackId !== null && isFiniteNumber(value.position) && value.position > 0 ? value.position : 0;

  return {
    trackId,
    position,
    shuffle: value.shuffle === true,
    filters: { genres, mood, bpm: [low, high], vox: typeof stored.vox === "boolean" ? stored.vox : null },
  };
}

export async function loadSnapshot(catalogue: Catalogue): Promise<Snapshot | null> {
  return parseSnapshot(await readJson(SESSION_KEY), catalogue);
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await writeJson(SESSION_KEY, snapshot);
}
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck`
Expected: session suite passes (7 tests) with everything else; typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/player/session.ts mobile/src/player/session.test.ts
git commit -m "Remember and restore the player session

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Text, covers, icons and the waveform

**Files:**
- Create: `mobile/src/ui/format.ts`, `mobile/src/ui/format.test.ts`
- Create: `mobile/src/ui/cover-spec.ts`, `mobile/src/ui/cover-spec.test.ts`
- Create: `mobile/src/ui/waveform-bars.ts`, `mobile/src/ui/waveform-bars.test.ts`
- Create: `mobile/src/ui/AppText.tsx`, `mobile/src/ui/Cover.tsx`, `mobile/src/ui/icons.tsx`, `mobile/src/ui/Waveform.tsx`

**Interfaces:**
- Consumes: `Track` (Task 3); `fonts`, `coverGradient`, `palette` (Task 5).
- Produces:
  - `clockTime(seconds: number): string`.
  - `hash(s: string): number`; `COVER_BOX = 44`; `type CoverSpec = { radius: number; gradient: { x1: number; y1: number; x2: number; y2: number }; bars: { x: number; y: number; height: number; opacity: number }[] }`; `coverSpec(id: string, peaks: readonly number[], size: number): CoverSpec`.
  - `barCount(width: number, peakCount: number): number`; `waveformBars(peaks: readonly number[], count: number): number[]`.
  - `<AppText weight? size? color style? ...TextProps>`; `<Cover track size emptyColor?>`; `PlayIcon`, `PauseIcon`, `NextIcon`, `PrevIcon`, `ShuffleIcon`, `LockIcon`, `CheckIcon` taking `{ size?: number; color: string }`; `<Waveform peaks progress onSeek height? playedColor restColor label>`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/ui/format.test.ts`:

```ts
import { clockTime } from "./format";

test.each([
  [0, "0:00"],
  [9.9, "0:09"],
  [61, "1:01"],
  [3600, "60:00"],
  [-4, "0:00"],
  [Number.NaN, "0:00"],
])("clockTime(%p) is %p", (seconds, expected) => {
  expect(clockTime(seconds)).toBe(expected);
});
```

Create `mobile/src/ui/cover-spec.test.ts`:

```ts
import { coverSpec, hash } from "./cover-spec";

/* Computed with the web's own hash in components/player/Cover.tsx over real
   track ids. If these change, the app's covers no longer match the site's. */
test.each([
  ["soft-open", 1342965232],
  ["counter-run", 2098228245],
  ["corner-table", 493102329],
  ["a", 468965076],
  ["", 2166136261],
])("hash(%p) matches the web", (id, expected) => {
  expect(hash(id)).toBe(expected);
});

test("the gradient is the web's rotation about the centre", () => {
  // soft-open hashes to 1342965232, which is 352°, the same as -8°.
  const { gradient: g } = coverSpec("soft-open", [], 44);
  expect(g.x1 + g.x2).toBeCloseTo(1);
  expect(g.y1 + g.y2).toBeCloseTo(1);
  expect(Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).toBeCloseTo(1);
  expect((Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180) / Math.PI).toBeCloseTo(-8);
});

test("draws nine bars, each sampled from its own slice of the peaks", () => {
  // peaks[k] = floor(k / 20) / 10, and the step is floor(180 / 9) = 20, so bar i reads i / 10.
  const peaks = Array.from({ length: 180 }, (_, k) => Math.floor(k / 20) / 10);
  const { bars } = coverSpec("soft-open", peaks, 44);
  expect(bars).toHaveLength(9);
  expect(bars[0]).toEqual({ x: 6, y: 31, height: 3, opacity: 0.42 });
  expect(bars[5].x).toBeCloseTo(24.5);
  expect(bars[5].height).toBeCloseTo(12);
  expect(bars[5].y).toBeCloseTo(22);
  expect(bars[5].opacity).toBeCloseTo(0.67);
});

test("falls back to a mid height when a track has no peaks", () => {
  expect(coverSpec("soft-open", [], 44).bars[0].height).toBeCloseTo(7.2);
});

test("rounds corners in proportion, but never below 5", () => {
  expect(coverSpec("x", [], 44).radius).toBe(10);
  expect(coverSpec("x", [], 10).radius).toBe(5);
});
```

Create `mobile/src/ui/waveform-bars.test.ts`:

```ts
import { barCount, waveformBars } from "./waveform-bars";

test("about one bar per four points", () => {
  expect(barCount(400, 180)).toBe(100);
});

test("at least 32 bars on a narrow screen", () => {
  expect(barCount(40, 180)).toBe(32);
});

test("never more bars than peaks", () => {
  expect(barCount(2000, 180)).toBe(180);
});

test("each bar is the loudest peak in its slice", () => {
  expect(waveformBars([0.1, 0.9, 0.2, 0.3], 2)).toEqual([0.9, 0.3]);
});

test("a track with no peaks still draws a quiet line", () => {
  const bars = waveformBars([], 45);
  expect(bars).toHaveLength(45);
  expect(new Set(bars)).toEqual(new Set([0.12]));
});
```

Run: `npm test -- format cover-spec waveform-bars`
Expected: FAIL, the three modules do not exist.

- [ ] **Step 2: Write the pure modules**

Create `mobile/src/ui/format.ts`:

```ts
/** m:ss, as clockTime in the web's lib/format.ts. Anything unusable reads as 0:00. */
export function clockTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

Create `mobile/src/ui/cover-spec.ts`:

```ts
/** FNV-1a, exactly as the web's Cover.tsx computes it, so covers match across the two. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type CoverSpec = {
  radius: number;
  /** Gradient endpoints within the 0–1 box. */
  gradient: { x1: number; y1: number; x2: number; y2: number };
  bars: { x: number; y: number; height: number; opacity: number }[];
};

/** The web draws covers in a 44-unit box; the numbers below are its numbers. */
export const COVER_BOX = 44;
const BARS = 9;

/**
 * Everything a cover draws. The web rotates a left-to-right gradient about its
 * centre by an angle taken from the track id; here the same rotation is given
 * as endpoints, which react-native-svg takes directly.
 */
export function coverSpec(id: string, peaks: readonly number[], size: number): CoverSpec {
  const radians = ((hash(id) % 360) * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  const step = Math.max(1, Math.floor(peaks.length / BARS));

  return {
    radius: Math.max(5, Math.round(size * 0.22)),
    gradient: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy },
    bars: Array.from({ length: BARS }, (_, i) => {
      const p = peaks[i * step] ?? 0.3;
      const height = Math.max(3, p * 24);
      return { x: 6 + i * 3.7, y: 34 - height, height, opacity: 0.42 + p * 0.5 };
    }),
  };
}
```

Create `mobile/src/ui/waveform-bars.ts`:

```ts
/** As on the web: about one bar per 4 points, at least 32, never more than there are peaks. */
export function barCount(width: number, peakCount: number): number {
  return Math.max(32, Math.min(peakCount || 90, Math.floor(width / 4)));
}

/** Each bar is the loudest peak in its slice, so short spikes stay visible. */
export function waveformBars(peaks: readonly number[], count: number): number[] {
  const source = peaks.length ? peaks : new Array<number>(90).fill(0.12);
  return Array.from({ length: count }, (_, i) => {
    const lo = Math.floor((i / count) * source.length);
    const hi = Math.max(lo + 1, Math.floor(((i + 1) / count) * source.length));
    let max = 0;
    for (let j = lo; j < hi; j++) max = Math.max(max, source[j]);
    return max;
  });
}
```

Run: `npm test -- format cover-spec waveform-bars`
Expected: format 6, cover-spec 9, waveform-bars 5 — all pass.

- [ ] **Step 3: Write the components**

Create `mobile/src/ui/AppText.tsx`:

```tsx
import { Text, type TextProps } from "react-native";

import { fonts } from "@/theme";

type Props = TextProps & { weight?: keyof typeof fonts; size?: number; color: string };

/** Text in Inter. Semibold headings are tightened as the web's display type is. */
export function AppText({ weight = "regular", size = 15, color, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          color,
          letterSpacing: weight === "semibold" ? -0.024 * size : 0,
        },
        style,
      ]}
    />
  );
}
```

Create `mobile/src/ui/Cover.tsx`:

```tsx
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import type { Track } from "@/catalogue/types";
import { coverGradient, palette } from "@/theme";

import { COVER_BOX, coverSpec } from "./cover-spec";

type Props = { track: Pick<Track, "id" | "peaks"> | null; size: number; emptyColor?: string };

/** A track's generated face: the gradient at an angle from its id, over bars from its own waveform. */
export function Cover({ track, size, emptyColor = palette.light.surface2 }: Props) {
  if (!track) {
    const radius = Math.max(5, Math.round(size * 0.22));
    return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: emptyColor }} />;
  }

  const spec = coverSpec(track.id, track.peaks, size);
  const gradientId = `cover-${track.id}`;

  return (
    <View style={{ width: size, height: size, borderRadius: spec.radius, overflow: "hidden" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${COVER_BOX} ${COVER_BOX}`}>
        <Defs>
          <LinearGradient
            id={gradientId}
            x1={spec.gradient.x1}
            y1={spec.gradient.y1}
            x2={spec.gradient.x2}
            y2={spec.gradient.y2}
          >
            <Stop offset="0" stopColor={coverGradient.from} />
            <Stop offset="1" stopColor={coverGradient.to} />
          </LinearGradient>
        </Defs>
        <Rect width={COVER_BOX} height={COVER_BOX} fill={`url(#${gradientId})`} />
        {spec.bars.map((bar, i) => (
          <Rect
            key={i}
            x={bar.x}
            y={bar.y}
            width={2}
            height={bar.height}
            rx={1}
            fill="#ffffff"
            opacity={bar.opacity * 0.9}
          />
        ))}
      </Svg>
    </View>
  );
}
```

Create `mobile/src/ui/icons.tsx`:

```tsx
import Svg, { Path, Rect } from "react-native-svg";

/* The web's icons from components/player/Icons.tsx, same paths. */

type IconProps = { size?: number; color: string };

const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24" });

export function PlayIcon({ size = 20, color }: IconProps) {
  return (
    <Svg {...box(size)}>
      <Path d="M8 5.2v13.6L19 12 8 5.2Z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 20, color }: IconProps) {
  return (
    <Svg {...box(size)}>
      <Path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill={color} />
    </Svg>
  );
}

export function NextIcon({ size = 20, color }: IconProps) {
  return (
    <Svg {...box(size)}>
      <Path d="M6 5.5 15 12l-9 6.5v-13ZM16.6 5H19v14h-2.4z" fill={color} />
    </Svg>
  );
}

export function PrevIcon({ size = 20, color }: IconProps) {
  return (
    <Svg {...box(size)}>
      <Path d="M18 5.5 9 12l9 6.5v-13ZM5 5h2.4v14H5z" fill={color} />
    </Svg>
  );
}

export function ShuffleIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...box(size)} fill="none">
      <Path
        d="M3 7h3.2c1.5 0 2.4.8 3.3 2l3.9 6c.9 1.2 1.8 2 3.3 2H21M3 17h3.2c1.5 0 2.4-.8 3.3-2M14.4 9c.9-1.2 1.8-2 3.3-2H21"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="m18.4 4 2.9 3-2.9 3M18.4 14l2.9 3-2.9 3"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LockIcon({ size = 18, color }: IconProps) {
  return (
    <Svg {...box(size)} fill="none">
      <Rect x={4.5} y={10} width={15} height={10} rx={1.4} stroke={color} strokeWidth={1.7} />
      <Path d="M8 10V7.6a4 4 0 0 1 8 0V10" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

export function CheckIcon({ size = 16, color }: IconProps) {
  return (
    <Svg {...box(size)} fill="none">
      <Path d="m4.5 12.5 4.6 4.6L19.5 6.7" stroke={color} strokeWidth={2.2} strokeLinecap="square" />
    </Svg>
  );
}
```

Create `mobile/src/ui/Waveform.tsx`:

```tsx
import { useState } from "react";
import { Pressable, View } from "react-native";

import { barCount, waveformBars } from "./waveform-bars";

type Props = {
  peaks: readonly number[];
  /** 0–1 */
  progress: number;
  onSeek: (fraction: number) => void;
  height?: number;
  playedColor: string;
  restColor: string;
  label: string;
};

/**
 * The peaks-based scrubber. Tap to seek. The web's arrow keys become the screen
 * reader's adjust gesture: swipe up or down to move 5% at a time.
 */
export function Waveform({ peaks, progress, onSeek, height = 56, playedColor, restColor, label }: Props) {
  const [width, setWidth] = useState(0);
  const bars = width > 0 ? waveformBars(peaks, barCount(width, peaks.length)) : [];
  const playedTo = progress * bars.length;

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onSeek(Math.min(1, progress + 0.05));
        if (event.nativeEvent.actionName === "decrement") onSeek(Math.max(0, progress - 0.05));
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={(event) => {
        if (width > 0) onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / width)));
      }}
      style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 1 }}
    >
      {bars.map((p, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(6, p * 100)}%`,
            borderRadius: 1,
            backgroundColor: i < playedTo ? playedColor : restColor,
          }}
        />
      ))}
    </Pressable>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck`
Expected: all suites pass; typecheck exits 0. These components are seen on screen from Task 11 onward.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/ui
git commit -m "Add text, covers, icons and the waveform

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Playback engine, catalogue gate and player state

**Files:**
- Create: `scripts/render-app-artwork.mjs`, `public/app-artwork.png` (web)
- Create: `mobile/src/player/engine.ts`
- Create: `mobile/src/catalogue/CatalogueGate.tsx`
- Create: `mobile/src/player/PlayerProvider.tsx`
- Modify: `mobile/src/app/_layout.tsx` (replace), `mobile/src/app/index.tsx` (replace with a temporary playback check)

**Interfaces:**
- Consumes: everything from Tasks 2–9.
- Produces:
  - `type LockScreenInfo = { title: string; artist: string; artworkUrl: string }`; `type Engine = { load(src, info): void; play(): void; pause(): void; seekTo(seconds): void; preload(src): void; release(): void }`; `configureAudioSession(): Promise<void>`; `requestMediaControlsPermission(): Promise<void>`; `createEngine(onStatus: (status: AudioStatus) => void): Engine`.
  - `CatalogueGate`; `useCatalogue(): { catalogue: Catalogue; stale: LoadFailure | null }`.
  - `type PlayerNotice = null | "gave-up" | "trial-expired"`; `PlayerProvider`; `usePlayer()` returning `{ queue, current, playing, buffering, position, duration, shuffle, filters, trial, notice, play(track?), toggle(), next(), previous(), seek(fraction), setFilters(partial), resetFilters(), playMood(mood), toggleShuffle(), dismissNotice() }`.

These pieces talk to native audio, so they have no unit tests (spec section 6). Their decisions live in the pure modules already tested; this task is verified by running the app.

- [ ] **Step 1: Render the lock-screen artwork**

Create `scripts/render-app-artwork.mjs`:

```js
#!/usr/bin/env node
/* Renders public/app-artwork.png, the one image the mobile app shows on the
   lock screen for every track. The logo's "tone." wordmark is black and drawn
   for a light ground, so it sits on the web's #f5f5f7; on a dark ground or the
   brand gradient, half of it disappears. Needs Google Chrome.
   Usage: node scripts/render-app-artwork.mjs */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const out = path.join(root, "public", "app-artwork.png");
const work = mkdtempSync(path.join(tmpdir(), "odatone-artwork-"));

try {
  copyFileSync(path.join(root, "public", "odatone-logo_colour.svg"), path.join(work, "logo.svg"));
  writeFileSync(
    path.join(work, "art.html"),
    '<!doctype html><html><body style="margin:0"><div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;background:#f5f5f7"><img src="logo.svg" style="width:820px"></div></body></html>',
  );
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1024,1024",
      `--screenshot=${out}`,
      `file://${path.join(work, "art.html")}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`Wrote ${path.relative(root, out)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
```

Run (repository root): `node scripts/render-app-artwork.mjs && sips -g pixelWidth -g pixelHeight public/app-artwork.png`
Expected: `Wrote public/app-artwork.png`, 1024 × 1024. Open the image and confirm the whole logo is visible — the magenta mark, "Oda" and the black "tone." — on a pale grey ground.

- [ ] **Step 2: Write the engine**

Create `mobile/src/player/engine.ts`:

```ts
import {
  createAudioPlayer,
  preload as preloadSource,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  type AudioStatus,
} from "expo-audio";
import { Platform } from "react-native";

export type LockScreenInfo = { title: string; artist: string; artworkUrl: string };

export type Engine = {
  /** Swaps in a track and shows it on the lock screen. Does not start playback. */
  load: (src: string, info: LockScreenInfo) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  /** Starts buffering a track so moving to it is quick. */
  preload: (src: string) => void;
  release: () => void;
};

/**
 * Runs once at startup: keep playing in silent mode and in the background, and
 * take exclusive audio focus. Without "doNotMix" the lock screen will not attach
 * to the player.
 */
export async function configureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix",
  });
}

/** Media controls in Android's notification shade need this on Android 13 and later. */
export async function requestMediaControlsPermission(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await requestNotificationPermissionsAsync();
  } catch {
    /* Declining is allowed. What that does to background playback is checked on
       a device — see the checklist in mobile/README.md. */
  }
}

/**
 * One AudioPlayer for the whole app, changing track with replace().
 *
 * Not AudioPlaylist: it has no lock-screen API, and on Android background audio
 * stops after about three minutes unless the player is active for the lock
 * screen. A playlist would cut the music mid-service.
 */
export function createEngine(onStatus: (status: AudioStatus) => void): Engine {
  const player = createAudioPlayer(null, { updateInterval: 250 });
  const subscription = player.addListener("playbackStatusUpdate", onStatus);
  let onLockScreen = false;

  return {
    load(src, info) {
      player.replace(src);
      if (onLockScreen) {
        player.updateLockScreenMetadata(info);
      } else {
        player.setActiveForLockScreen(true, info, { showSeekBackward: true, showSeekForward: true });
        onLockScreen = true;
      }
    },
    play: () => player.play(),
    pause: () => player.pause(),
    seekTo: (seconds) => {
      void player.seekTo(seconds);
    },
    preload: (src) => {
      /* Wrapped because expo-audio's web build returns nothing rather than a promise. */
      Promise.resolve(preloadSource(src)).catch(() => {});
    },
    release() {
      subscription.remove();
      player.clearLockScreenControls();
      player.remove();
    },
  };
}
```

- [ ] **Step 3: Write the catalogue gate**

Create `mobile/src/catalogue/CatalogueGate.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { SITE_URL } from "@/config";
import { copy } from "@/copy";
import { useSettings } from "@/settings/SettingsProvider";
import { radius } from "@/theme";
import { AppText } from "@/ui/AppText";

import { loadCatalogue, type LoadFailure, type LoadResult } from "./load";
import type { Catalogue } from "./types";

type CatalogueContextValue = {
  catalogue: Catalogue;
  /** Why the cached copy is showing instead of a fresh one; null when fresh. */
  stale: LoadFailure | null;
};

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

/** Renders its children only once a catalogue is in hand. Until then: loading, or a way to retry. */
export function CatalogueGate({ children }: { children: ReactNode }) {
  const { colors, t } = useSettings();
  const [result, setResult] = useState<LoadResult | null>(null);

  const load = useCallback(() => {
    setResult(null);
    void loadCatalogue(SITE_URL).then(setResult);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (result === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink2} />
      </View>
    );
  }

  if (result.status === "unavailable") {
    const outdated = result.reason === "unsupported-version";
    const body = outdated
      ? copy.updateBody
      : result.reason === "malformed"
        ? copy.malformedBody
        : copy.unreachableBody;
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 32,
          backgroundColor: colors.bg,
        }}
      >
        <AppText weight="semibold" size={22} color={colors.ink} style={{ textAlign: "center" }}>
          {t(outdated ? copy.updateTitle : copy.unreachableTitle)}
        </AppText>
        <AppText color={colors.ink2} style={{ textAlign: "center" }}>
          {t(body)}
        </AppText>
        <Pressable
          onPress={load}
          accessibilityRole="button"
          style={{
            marginTop: 8,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: radius.pill,
            backgroundColor: colors.ink,
          }}
        >
          <AppText weight="medium" color={colors.bg}>
            {t(copy.retry)}
          </AppText>
        </Pressable>
      </View>
    );
  }

  const value: CatalogueContextValue = {
    catalogue: result.catalogue,
    stale: result.status === "cached" ? result.reason : null,
  };
  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue(): CatalogueContextValue {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error("useCatalogue must be used inside CatalogueGate");
  return value;
}
```

- [ ] **Step 4: Write the player provider**

Create `mobile/src/player/PlayerProvider.tsx`:

```tsx
import type { AudioStatus } from "expo-audio";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import { defaultFilters, filterTracks } from "@/catalogue/filter";
import type { Filters, Mood, Track } from "@/catalogue/types";
import { ARTWORK_URL } from "@/config";
import { useSettings } from "@/settings/SettingsProvider";

import { configureAudioSession, createEngine, requestMediaControlsPermission, type Engine } from "./engine";
import { afterFailure, indexOfTrack, nextIndex, previousIndex, shouldRestart } from "./queue";
import { loadSnapshot, saveSnapshot } from "./session";
import { ensureTrialStarted, readTrialStart, trialState, type TrialState } from "./trial";

export type PlayerNotice = null | "gave-up" | "trial-expired";

type PlayerContextValue = {
  /** The catalogue under the current filters, in order. */
  queue: Track[];
  current: Track | null;
  playing: boolean;
  buffering: boolean;
  /** Seconds. */
  position: number;
  duration: number;
  shuffle: boolean;
  filters: Filters;
  trial: TrialState;
  notice: PlayerNotice;
  play: (track?: Track) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  /** 0–1 */
  seek: (fraction: number) => void;
  setFilters: (update: Partial<Filters>) => void;
  resetFilters: () => void;
  playMood: (mood: Mood) => void;
  toggleShuffle: () => void;
  dismissNotice: () => void;
};

type Playback = { playing: boolean; buffering: boolean; position: number; duration: number };

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { catalogue } = useCatalogue();
  const { locale } = useSettings();

  const [filters, setFiltersState] = useState<Filters>(() => defaultFilters(catalogue.bpm));
  const [shuffle, setShuffle] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback>({ playing: false, buffering: false, position: 0, duration: 0 });
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [notice, setNotice] = useState<PlayerNotice>(null);

  const queue = useMemo(() => filterTracks(filters, catalogue.tracks), [filters, catalogue.tracks]);
  const current = useMemo(
    () => catalogue.tracks.find((t) => t.id === currentId) ?? null,
    [catalogue.tracks, currentId],
  );

  /* Status events come from native code outside React's render cycle, so the
     handlers read the latest values from here rather than from stale closures. */
  const engine = useRef<Engine | null>(null);
  const live = useRef({ queue, currentId, shuffle, locale, playing: false, position: 0, duration: 0 });
  const failures = useRef(0);
  const trackFailed = useRef(false);
  const trackFinished = useRef(false);
  const resumeAt = useRef(0);
  const restored = useRef(false);

  useEffect(() => {
    live.current = { ...live.current, queue, currentId, shuffle, locale };
  }, [queue, currentId, shuffle, locale]);

  const load = useCallback((track: Track, autoplay: boolean) => {
    const player = engine.current;
    if (!player) return;
    trackFailed.current = false;
    trackFinished.current = false;
    live.current.currentId = track.id;
    setCurrentId(track.id);
    player.load(track.src, { title: track.title[live.current.locale], artist: track.artist, artworkUrl: ARTWORK_URL });
    if (autoplay) player.play();

    /* Shuffle picks at random, so only an in-order queue knows what comes next. */
    const { queue: q, shuffle: shuffled } = live.current;
    if (!shuffled && q.length > 1) {
      const after = q[nextIndex(indexOfTrack(q, track.id), q.length, false, Math.random)];
      if (after && after.id !== track.id) player.preload(after.src);
    }
  }, []);

  /** Whether playback may start. Starts the trial on the first play; blocks once it has run out. */
  const admit = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    const started = await readTrialStart();
    if (started !== null && trialState(started, now).expired) {
      setTrialStart(started);
      setNotice("trial-expired");
      return false;
    }
    if (started === null) await requestMediaControlsPermission();
    setTrialStart(await ensureTrialStarted(now));
    return true;
  }, []);

  const step = useCallback(
    (direction: 1 | -1, autoplay: boolean) => {
      const { queue: q, currentId: id, shuffle: shuffled } = live.current;
      const from = indexOfTrack(q, id);
      const to =
        direction === 1
          ? nextIndex(from, q.length, shuffled, Math.random)
          : previousIndex(from, q.length, shuffled, Math.random);
      if (to >= 0) load(q[to], autoplay);
    },
    [load],
  );

  const play = useCallback(
    (track?: Track) => {
      void (async () => {
        const target = track ?? current ?? live.current.queue[0];
        if (!target || !(await admit())) return;
        failures.current = 0;
        setNotice(null);
        /* A track that failed has nothing to resume, so it is loaded again. */
        if (target.id === live.current.currentId && !trackFailed.current) engine.current?.play();
        else load(target, true);
      })();
    },
    [current, admit, load],
  );

  const toggle = useCallback(() => {
    if (live.current.playing) engine.current?.pause();
    else play();
  }, [play]);

  const move = useCallback(
    (direction: 1 | -1) => {
      void (async () => {
        const autoplay = live.current.playing;
        if (autoplay && !(await admit())) return;
        step(direction, autoplay);
      })();
    },
    [admit, step],
  );

  const next = useCallback(() => move(1), [move]);

  const previous = useCallback(() => {
    if (shouldRestart(live.current.position)) engine.current?.seekTo(0);
    else move(-1);
  }, [move]);

  const seek = useCallback((fraction: number) => {
    if (live.current.duration > 0) engine.current?.seekTo(fraction * live.current.duration);
  }, []);

  const onStatus = useCallback(
    (status: AudioStatus) => {
      live.current.playing = status.playing;
      live.current.position = status.currentTime;
      live.current.duration = status.duration;
      setPlayback({
        playing: status.playing,
        buffering: status.isBuffering,
        position: status.currentTime,
        duration: status.duration,
      });

      if (status.isLoaded && resumeAt.current > 0) {
        engine.current?.seekTo(resumeAt.current);
        resumeAt.current = 0;
      }

      /* The error stays on every status until another track loads, so it is
         counted once per track rather than once per update. */
      if (status.error && !trackFailed.current) {
        trackFailed.current = true;
        const { consecutive, giveUp } = afterFailure(failures.current);
        failures.current = consecutive;
        if (giveUp) {
          engine.current?.pause();
          setNotice("gave-up");
        } else {
          step(1, true);
        }
        return;
      }

      if (status.playing && !status.isBuffering) failures.current = 0;

      if (status.didJustFinish && !trackFinished.current) {
        trackFinished.current = true;
        void (async () => {
          /* The current track always finishes; an expired trial blocks the next one. */
          const started = await readTrialStart();
          if (started !== null && trialState(started, Date.now()).expired) {
            setTrialStart(started);
            setNotice("trial-expired");
            return;
          }
          step(1, true);
        })();
      }
    },
    [step],
  );

  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    void configureAudioSession();
    const created = createEngine((status) => onStatusRef.current(status));
    engine.current = created;
    return () => {
      created.release();
      engine.current = null;
    };
  }, []);

  /* Restores the last session, paused: the app never starts playing on its own. */
  useEffect(() => {
    let active = true;
    void (async () => {
      const [snapshot, started] = await Promise.all([loadSnapshot(catalogue), readTrialStart()]);
      if (!active) return;
      setTrialStart(started);
      if (snapshot) {
        setFiltersState(snapshot.filters);
        setShuffle(snapshot.shuffle);
        live.current.shuffle = snapshot.shuffle;
        const track = catalogue.tracks.find((t) => t.id === snapshot.trackId);
        if (track) {
          resumeAt.current = snapshot.position;
          load(track, false);
        }
      }
      restored.current = true;
    })();
    return () => {
      active = false;
    };
  }, [catalogue, load]);

  /* Never saved before the stored session is restored, or the defaults would overwrite it. */
  const persist = useCallback(() => {
    if (!restored.current) return;
    const { currentId: id, position } = live.current;
    void saveSnapshot({ trackId: id, position: id ? position : 0, shuffle, filters });
  }, [shuffle, filters]);

  useEffect(() => {
    persist();
  }, [persist, currentId, playback.playing]);

  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") persistRef.current();
    });
    return () => subscription.remove();
  }, []);

  const setFilters = useCallback((update: Partial<Filters>) => {
    setFiltersState((existing) => ({ ...existing, ...update }));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(defaultFilters(catalogue.bpm)), [catalogue.bpm]);

  /** One tap from the Moods tab: show only that mood and start playing it. */
  const playMood = useCallback(
    (mood: Mood) => {
      const moodFilters: Filters = { ...defaultFilters(catalogue.bpm), mood };
      setFiltersState(moodFilters);
      live.current.queue = filterTracks(moodFilters, catalogue.tracks);
      const first = live.current.queue[0];
      if (first) play(first);
    },
    [catalogue, play],
  );

  const toggleShuffle = useCallback(() => setShuffle((on) => !on), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  /* Recomputed when the track changes as well, so days left stays current in a long session. */
  const trial = useMemo(() => trialState(trialStart, Date.now()), [trialStart, currentId]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      current,
      playing: playback.playing,
      buffering: playback.buffering,
      position: playback.position,
      duration: playback.duration,
      shuffle,
      filters,
      trial,
      notice,
      play,
      toggle,
      next,
      previous,
      seek,
      setFilters,
      resetFilters,
      playMood,
      toggleShuffle,
      dismissNotice,
    }),
    [queue, current, playback, shuffle, filters, trial, notice, play, toggle, next, previous, seek, setFilters, resetFilters, playMood, toggleShuffle, dismissNotice],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used inside PlayerProvider");
  return value;
}
```

- [ ] **Step 5: Wire the providers into the root layout**

Replace `mobile/src/app/_layout.tsx`:

```tsx
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CatalogueGate } from "@/catalogue/CatalogueGate";
import { PlayerProvider } from "@/player/PlayerProvider";
import { SettingsProvider } from "@/settings/SettingsProvider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  /* A font that fails to load falls back to the system face rather than
     leaving the splash screen up forever. */
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <CatalogueGate>
          <PlayerProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </PlayerProvider>
        </CatalogueGate>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
```

Replace `mobile/src/app/index.tsx` with a temporary playback check:

```tsx
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import { usePlayer } from "@/player/PlayerProvider";
import { useSettings } from "@/settings/SettingsProvider";
import { AppText } from "@/ui/AppText";

/* TEMPORARY playback check: lists the catalogue and plays what you tap.
   Task 11 deletes this file in favour of the tabs. */
export default function PlaybackCheck() {
  const insets = useSafeAreaInsets();
  const { colors, locale } = useSettings();
  const { catalogue, stale } = useCatalogue();
  const player = usePlayer();

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <AppText weight="semibold" size={20} color={colors.ink} style={{ padding: 16 }}>
        {player.current
          ? `${player.playing ? "Playing" : "Paused"}: ${player.current.title[locale]}${player.buffering ? " (buffering)" : ""}`
          : "Nothing playing"}
      </AppText>
      <AppText color={colors.ink2} style={{ paddingHorizontal: 16 }}>
        {`${Math.round(player.position)}s of ${Math.round(player.duration)}s · ${player.trial.daysLeft} trial days · notice ${player.notice ?? "none"} · stale ${stale ?? "no"}`}
      </AppText>
      <View style={{ flexDirection: "row", gap: 20, padding: 16 }}>
        <Pressable onPress={player.previous}>
          <AppText color={colors.accent}>Previous</AppText>
        </Pressable>
        <Pressable onPress={player.toggle}>
          <AppText color={colors.accent}>Play / pause</AppText>
        </Pressable>
        <Pressable onPress={player.next}>
          <AppText color={colors.accent}>Next</AppText>
        </Pressable>
      </View>
      <FlatList
        data={catalogue.tracks}
        keyExtractor={(track) => track.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => player.play(item)}
            style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.line }}
          >
            <AppText color={colors.ink}>{item.title[locale]}</AppText>
          </Pressable>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 6: Typecheck and test**

In `mobile/`: `npm test && npm run typecheck`
Expected: every suite still passes; typecheck exits 0.

- [ ] **Step 7: Run it**

The catalogue must be reachable. If Task 1 was deployed, use the default. Otherwise serve the web locally from the repository root with `npx next build && npx next start -H 0.0.0.0 -p 3000`, and start the app with the matching URL: `http://localhost:3000` for the iOS Simulator, `http://10.0.2.2:3000` for the Android emulator, or `http://<this computer's LAN IP>:3000` for a phone.

In `mobile/`: `npx expo start` (or `EXPO_PUBLIC_SITE_URL=http://localhost:3000 npx expo start`), then press `i` for the iOS Simulator or scan the QR code with Expo Go.

Check, in order:
1. The list shows the catalogue — 29 tracks while the audio is placeholder.
2. Tapping a track plays audio; the heading reads `Playing: <title>` and the seconds count up.
3. Next and Previous change track. Previous more than 3 seconds into a track restarts it.
4. Let a track finish: the next one starts by itself.
5. Stop the web server and reload the app (`r` in the terminal): the list still appears, reading `stale unreachable`.
6. Clear the app's data (uninstall Expo Go's copy, or delete and reinstall) with the server still stopped: the "Can't reach Odatone" screen appears with Try again, and Try again recovers once the server is back.

Background playback and the lock screen do not work in Expo Go — they are checked in a development build in Task 13.

- [ ] **Step 8: Commit**

```bash
git add scripts/render-app-artwork.mjs public/app-artwork.png mobile/src/player/engine.ts mobile/src/player/PlayerProvider.tsx mobile/src/catalogue/CatalogueGate.tsx mobile/src/app
git commit -m "Play the catalogue through one background-capable audio player

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Navigation shell — tabs, mini player, now playing, tablet split

**Files:**
- Delete: `mobile/src/app/index.tsx` (the temporary playback check)
- Create: `mobile/src/ui/layout.ts`, `mobile/src/ui/IconButton.tsx`, `mobile/src/ui/MiniPlayer.tsx`, `mobile/src/ui/NowPlaying.tsx`
- Modify: `mobile/src/app/_layout.tsx` (replace)
- Create: `mobile/src/app/(tabs)/_layout.tsx`, `mobile/src/app/(tabs)/index.tsx`, `mobile/src/app/(tabs)/library.tsx`, `mobile/src/app/(tabs)/settings.tsx` (placeholders until Task 12), `mobile/src/app/now-playing.tsx`

**Interfaces:**
- Consumes: `usePlayer` (Task 10), `useCatalogue` (Task 10), `useSettings`, `copy`, `playerColors`, `radius`, `fonts`, `WIDE_BREAKPOINT` (Task 5), `AppText`, `Cover`, `Waveform`, icons, `clockTime` (Task 9).
- Produces: `useIsWide(): boolean`; `<IconButton label onPress size? selected? children>`; `<MiniPlayer />`; `<NowPlaying onClose? />`; a root `Shell` that later tasks mount notices into (Task 12 adds `<PlayerNotices />`).

- [ ] **Step 1: Remove the playback check and add the layout helpers**

Run (in `mobile/`): `rm src/app/index.tsx`

Create `mobile/src/ui/layout.ts`:

```ts
import { useWindowDimensions } from "react-native";

import { WIDE_BREAKPOINT } from "@/theme";

/** Library and player side by side. Decided by the window's width, not the
    device type, so a tablet in portrait or in split-screen gets what fits. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
```

Create `mobile/src/ui/IconButton.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pressable } from "react-native";

type Props = { label: string; onPress: () => void; children: ReactNode; size?: number; selected?: boolean };

/** A generous round touch target around an icon, labelled for screen readers. */
export function IconButton({ label, onPress, children, size = 48, selected }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
```

- [ ] **Step 2: Write the mini player**

Create `mobile/src/ui/MiniPlayer.tsx`:

```tsx
import { router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";

import { copy } from "@/copy";
import { usePlayer } from "@/player/PlayerProvider";
import { useSettings } from "@/settings/SettingsProvider";
import { playerColors as c, radius } from "@/theme";

import { AppText } from "./AppText";
import { Cover } from "./Cover";
import { PauseIcon, PlayIcon } from "./icons";

/**
 * Pinned above the tab bar on phones. Tapping it opens the full player; the
 * round button only plays or pauses. A Bluetooth speaker disconnecting pauses
 * playback, and the play icon here is how staff notice.
 */
export function MiniPlayer() {
  const { t, locale } = useSettings();
  const player = usePlayer();
  const track = player.current;

  return (
    <Pressable
      onPress={() => router.push("/now-playing")}
      accessibilityRole="button"
      accessibilityLabel={t(copy.nowPlaying)}
      style={{
        marginHorizontal: 8,
        marginBottom: 8,
        padding: 8,
        gap: 10,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radius.lg,
        backgroundColor: c.bg,
      }}
    >
      <Cover track={track} size={40} emptyColor={c.surface2} />
      <View style={{ flex: 1 }}>
        <AppText weight="semibold" size={14} color={c.ink} numberOfLines={1}>
          {track ? track.title[locale] : t(copy.idleTitle)}
        </AppText>
        {track ? (
          <AppText size={12} color={c.ink2} numberOfLines={1}>
            {player.buffering ? t(copy.buffering) : `${track.bpm} ${t(track.vox ? copy.bpmVox : copy.bpmInst)}`}
          </AppText>
        ) : null}
      </View>
      {player.buffering ? <ActivityIndicator color={c.ink2} /> : null}
      <Pressable
        onPress={player.toggle}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t(player.playing ? copy.pause : copy.play)}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          backgroundColor: c.ink,
        }}
      >
        {player.playing ? <PauseIcon size={18} color={c.bg} /> : <PlayIcon size={18} color={c.bg} />}
      </Pressable>
    </Pressable>
  );
}
```

- [ ] **Step 3: Write the Now Playing panel**

Create `mobile/src/ui/NowPlaying.tsx`:

```tsx
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import { copy } from "@/copy";
import { usePlayer } from "@/player/PlayerProvider";
import { useSettings } from "@/settings/SettingsProvider";
import { playerColors as c, radius } from "@/theme";

import { AppText } from "./AppText";
import { Cover } from "./Cover";
import { clockTime } from "./format";
import { IconButton } from "./IconButton";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, ShuffleIcon } from "./icons";
import { Waveform } from "./Waveform";

type Props = {
  /** Present when shown as a phone's full-screen player; absent in the tablet's side panel. */
  onClose?: () => void;
};

/** The dark player moment. The same panel fills a phone screen or sits beside the tablet library. */
export function NowPlaying({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useSettings();
  const { catalogue } = useCatalogue();
  const player = usePlayer();
  const [width, setWidth] = useState(0);

  const track = player.current;
  const mood = track ? catalogue.moods.find((m) => m.id === track.mood) : undefined;
  const genre = track ? catalogue.genres.find((g) => g.id === track.genre) : undefined;
  const progress = player.duration > 0 ? player.position / player.duration : 0;
  const coverSize = Math.max(120, Math.min(280, width - 48));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      {onClose ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t(copy.close)}
          hitSlop={16}
          style={{ alignSelf: "center", paddingBottom: 8 }}
        >
          <View style={{ width: 36, height: 5, borderRadius: radius.pill, backgroundColor: c.surface3 }} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, justifyContent: "center", gap: 22 }}>
        <View style={{ alignItems: "center" }}>
          {width > 0 ? <Cover track={track} size={coverSize} emptyColor={c.surface2} /> : null}
        </View>

        <View style={{ gap: 4 }}>
          <AppText weight="semibold" size={22} color={c.ink} numberOfLines={2}>
            {track ? track.title[locale] : t(copy.idleTitle)}
          </AppText>
          {track ? (
            <AppText size={14} color={c.ink2} numberOfLines={1}>
              {[mood?.label[locale], genre?.label[locale], `${track.bpm} BPM`].filter(Boolean).join(" · ")}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <Waveform
            peaks={track?.peaks ?? []}
            progress={progress}
            onSeek={player.seek}
            playedColor={c.accent}
            restColor={c.lineStrong}
            label={t(copy.nowPlaying)}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText size={12} color={c.ink3}>
              {clockTime(player.position)}
            </AppText>
            <AppText size={12} color={c.ink3}>
              {player.buffering ? t(copy.buffering) : clockTime(player.duration)}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <IconButton label={t(copy.shuffle)} onPress={player.toggleShuffle} selected={player.shuffle}>
            <ShuffleIcon size={22} color={player.shuffle ? c.accent : c.ink2} />
          </IconButton>
          <IconButton label={t(copy.previous)} onPress={player.previous}>
            <PrevIcon size={30} color={c.ink} />
          </IconButton>
          <Pressable
            onPress={player.toggle}
            accessibilityRole="button"
            accessibilityLabel={t(player.playing ? copy.pause : copy.play)}
            style={({ pressed }) => ({
              width: 68,
              height: 68,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius.pill,
              backgroundColor: c.ink,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {player.playing ? <PauseIcon size={28} color={c.bg} /> : <PlayIcon size={28} color={c.bg} />}
          </Pressable>
          <IconButton label={t(copy.next)} onPress={player.next}>
            <NextIcon size={30} color={c.ink} />
          </IconButton>
          {/* Balances the shuffle button so play stays centred. */}
          <View style={{ width: 48 }} />
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Write the routes**

Replace `mobile/src/app/_layout.tsx`:

```tsx
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CatalogueGate } from "@/catalogue/CatalogueGate";
import { PlayerProvider } from "@/player/PlayerProvider";
import { SettingsProvider, useSettings } from "@/settings/SettingsProvider";
import { useIsWide } from "@/ui/layout";
import { NowPlaying } from "@/ui/NowPlaying";

SplashScreen.preventAutoHideAsync();

/** Phones: the tabs fill the screen and Now Playing opens over them.
    Wide windows: the tabs on the left, the player always on the right. */
function Shell() {
  const wide = useIsWide();
  const { scheme, colors } = useSettings();

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bg }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1.25 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="now-playing" options={{ presentation: "modal" }} />
        </Stack>
      </View>
      {wide ? (
        <View style={{ flex: 1 }}>
          <NowPlaying />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <CatalogueGate>
          <PlayerProvider>
            <Shell />
          </PlayerProvider>
        </CatalogueGate>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
```

Create `mobile/src/app/(tabs)/_layout.tsx`:

```tsx
import { BottomTabBar, Tabs } from "expo-router/tabs";
import { View } from "react-native";

import { copy } from "@/copy";
import { useSettings } from "@/settings/SettingsProvider";
import { fonts } from "@/theme";
import { useIsWide } from "@/ui/layout";
import { MiniPlayer } from "@/ui/MiniPlayer";

/* The JS Tabs, not NativeTabs: a native tab bar can neither carry the mini
   player above it nor live in the left pane of the tablet layout. */
export default function TabsLayout() {
  const { colors, t } = useSettings();
  const wide = useIsWide();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink3,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 13 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
      tabBar={(props) => (
        <View>
          {/* On a wide window the player is already on screen beside the tabs. */}
          {wide ? null : <MiniPlayer />}
          <BottomTabBar {...props} />
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: t(copy.tabMoods) }} />
      <Tabs.Screen name="library" options={{ title: t(copy.tabLibrary) }} />
      <Tabs.Screen name="settings" options={{ title: t(copy.tabSettings) }} />
    </Tabs>
  );
}
```

Create `mobile/src/app/now-playing.tsx`:

```tsx
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { useIsWide } from "@/ui/layout";
import { NowPlaying } from "@/ui/NowPlaying";

export default function NowPlayingScreen() {
  const wide = useIsWide();

  /* Rotating into the wide layout puts the player beside the tabs, where a
     modal copy of it would only duplicate it. */
  useEffect(() => {
    if (wide && router.canGoBack()) router.back();
  }, [wide]);

  return (
    <>
      <StatusBar style="light" />
      <NowPlaying onClose={() => router.back()} />
    </>
  );
}
```

Create three placeholders, each replaced in Task 12. `mobile/src/app/(tabs)/index.tsx`:

```tsx
import { View } from "react-native";

import { useSettings } from "@/settings/SettingsProvider";
import { AppText } from "@/ui/AppText";

/* Placeholder: Task 12 writes the Moods screen. */
export default function MoodsScreen() {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <AppText color={colors.ink}>Moods</AppText>
    </View>
  );
}
```

`mobile/src/app/(tabs)/library.tsx`:

```tsx
import { View } from "react-native";

import { useSettings } from "@/settings/SettingsProvider";
import { AppText } from "@/ui/AppText";

/* Placeholder: Task 12 writes the Library screen. */
export default function LibraryScreen() {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <AppText color={colors.ink}>Library</AppText>
    </View>
  );
}
```

`mobile/src/app/(tabs)/settings.tsx`:

```tsx
import { View } from "react-native";

import { useSettings } from "@/settings/SettingsProvider";
import { AppText } from "@/ui/AppText";

/* Placeholder: Task 12 writes the Settings screen. */
export default function SettingsScreen() {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <AppText color={colors.ink}>Settings</AppText>
    </View>
  );
}
```

- [ ] **Step 5: Typecheck and test**

In `mobile/`: `npm test && npm run typecheck`
Expected: all suites pass; typecheck exits 0.

- [ ] **Step 6: Run it on a phone and a tablet**

Start as in Task 10, Step 7. Check:
1. **Phone, portrait:** three text tabs; above them the dark mini player reads "Hear how your business is going to sound".
2. The mini player's play button starts the first track; the title, tempo and a pause icon appear.
3. Tapping the mini player slides up Now Playing: cover, title, "mood · genre · BPM", the waveform filling as it plays, times, and the transport. Tapping the waveform seeks. The grab handle closes it.
4. Shuffle turns violet when on.
5. **iPad Simulator in landscape** (or any window 768 points or wider): tabs on the left, Now Playing permanently on the right, no mini player. Rotate to portrait on an iPad mini: the phone layout returns. With Now Playing open on a phone-width window, rotate to wide: it closes itself.
6. **Appearance:** toggle the simulator's dark mode (iOS Simulator: ⌘⇧A). The tabs and screens switch; Now Playing stays dark either way.

- [ ] **Step 7: Commit**

```bash
git add -A mobile/src
git commit -m "Add tabs, the mini player, Now Playing and the tablet split

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: The screens — Moods, Library, Settings, and the notices

**Files:**
- Create: `mobile/src/player/trial-line.ts`, `mobile/src/player/trial-line.test.ts`
- Create: `mobile/src/ui/Chip.tsx`, `mobile/src/ui/TrackRow.tsx`, `mobile/src/ui/PlayerNotices.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`, `mobile/src/app/(tabs)/library.tsx`, `mobile/src/app/(tabs)/settings.tsx` (replace the placeholders)
- Modify: `mobile/src/app/_layout.tsx` (mount `PlayerNotices` in `Shell`)

**Interfaces:**
- Consumes: everything above; `TRIAL_DAYS`, `TrialState` (Task 6); `stepTempo`, `TEMPO_STEP`, `filtersAreDefault` (Task 7); `webUrl` (Task 5).
- Produces: `trialLine(trial: TrialState, locale: Locale): string`; `<Chip label selected onPress>`; `<TrackRow track active onPress>`; `<PlayerNotices />`.

- [ ] **Step 1: Write the failing trial-line test**

Create `mobile/src/player/trial-line.test.ts`:

```ts
import { trialLine } from "./trial-line";

test("before the first play", () => {
  expect(trialLine({ started: false, daysLeft: 7, expired: false }, "en")).toBe(
    "Free demo — starts when you press play",
  );
});

test("counts the days left", () => {
  expect(trialLine({ started: true, daysLeft: 4, expired: false }, "en")).toBe("Free demo — 4 days left");
});

test("says so on the last day", () => {
  expect(trialLine({ started: true, daysLeft: 1, expired: false }, "en")).toBe("Free demo — last day");
});

test("once it has run out", () => {
  expect(trialLine({ started: true, daysLeft: 0, expired: true }, "en")).toBe("The demo is over.");
});

test("in Danish", () => {
  expect(trialLine({ started: true, daysLeft: 3, expired: false }, "da")).toBe("Gratis demo — 3 dage tilbage");
});
```

Run: `npm test -- trial-line`
Expected: FAIL, cannot find module `./trial-line`.

- [ ] **Step 2: Write the trial line**

Create `mobile/src/player/trial-line.ts`:

```ts
import { copy } from "@/copy";
import { format, type Locale } from "@/i18n";

import type { TrialState } from "./trial";

/** The trial's one-line status, worded as the web player words it. */
export function trialLine(trial: TrialState, locale: Locale): string {
  if (!trial.started) return copy.trialNotStarted[locale];
  if (trial.expired) return copy.expiredTitle[locale];
  if (trial.daysLeft <= 1) return copy.trialLastDay[locale];
  return format(copy.trialRunning[locale], { n: trial.daysLeft });
}
```

Run: `npm test -- trial-line`
Expected: 5 tests pass.

- [ ] **Step 3: Write the shared pieces**

Create `mobile/src/ui/Chip.tsx`:

```tsx
import { Pressable } from "react-native";

import { useSettings } from "@/settings/SettingsProvider";
import { radius } from "@/theme";

import { AppText } from "./AppText";

type Props = { label: string; selected: boolean; onPress: () => void };

/** A pill that toggles a filter, like the web's filter rail. */
export function Chip({ label, selected, onPress }: Props) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.line,
        backgroundColor: selected ? colors.ink : colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <AppText weight="medium" size={13} color={selected ? colors.bg : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}
```

Create `mobile/src/ui/TrackRow.tsx`:

```tsx
import { Pressable, View } from "react-native";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import type { Track } from "@/catalogue/types";
import { copy } from "@/copy";
import { useSettings } from "@/settings/SettingsProvider";

import { AppText } from "./AppText";
import { Cover } from "./Cover";
import { clockTime } from "./format";

type Props = { track: Track; active: boolean; onPress: () => void };

export function TrackRow({ track, active, onPress }: Props) {
  const { colors, t, locale } = useSettings();
  const { catalogue } = useCatalogue();
  const genre = catalogue.genres.find((g) => g.id === track.genre);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: active ? colors.surface : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Cover track={track} size={44} />
      <View style={{ flex: 1 }}>
        <AppText weight={active ? "semibold" : "medium"} color={colors.ink} numberOfLines={1}>
          {track.title[locale]}
        </AppText>
        <AppText size={13} color={colors.ink2} numberOfLines={1}>
          {`${genre?.label[locale] ?? track.genre} · ${track.bpm} ${t(track.vox ? copy.bpmVox : copy.bpmInst)}`}
        </AppText>
      </View>
      <AppText size={13} color={colors.ink3}>
        {clockTime(track.duration)}
      </AppText>
    </Pressable>
  );
}
```

Create `mobile/src/ui/PlayerNotices.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, View } from "react-native";

import { copy } from "@/copy";
import { format } from "@/i18n";
import { webUrl } from "@/links";
import { usePlayer, type PlayerNotice } from "@/player/PlayerProvider";
import { TRIAL_DAYS } from "@/player/trial";
import { useSettings } from "@/settings/SettingsProvider";
import { radius } from "@/theme";

import { AppText } from "./AppText";
import { LockIcon } from "./icons";

/** The two things the player has to tell you: the demo has ended, or it stopped after repeated failures. */
export function PlayerNotices() {
  const { colors, t, locale } = useSettings();
  const player = usePlayer();

  /* Keeps the last notice on screen while the dialog fades out, instead of
     flicking to the other message as the notice clears. */
  const [shown, setShown] = useState<Exclude<PlayerNotice, null>>("gave-up");
  useEffect(() => {
    if (player.notice) setShown(player.notice);
  }, [player.notice]);

  const expired = shown === "trial-expired";

  return (
    <Modal visible={player.notice !== null} transparent animationType="fade" onRequestClose={player.dismissNotice}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            gap: 12,
            padding: 24,
            borderRadius: radius.xl,
            backgroundColor: colors.surface,
          }}
        >
          {expired ? <LockIcon size={22} color={colors.ink} /> : null}
          <AppText weight="semibold" size={22} color={colors.ink}>
            {t(expired ? copy.expiredTitle : copy.gaveUpTitle)}
          </AppText>
          <AppText color={colors.ink2}>
            {expired ? format(t(copy.expiredBody), { days: TRIAL_DAYS }) : t(copy.gaveUpBody)}
          </AppText>
          {expired ? (
            <Pressable
              onPress={() => void Linking.openURL(webUrl("signup", locale))}
              accessibilityRole="link"
              style={{ marginTop: 8, paddingVertical: 14, alignItems: "center", borderRadius: radius.pill, backgroundColor: colors.accent }}
            >
              <AppText weight="semibold" color={colors.accentInk}>
                {t(copy.lockedCta)}
              </AppText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={player.dismissNotice}
            accessibilityRole="button"
            style={{ paddingVertical: 12, alignItems: "center" }}
          >
            <AppText weight="medium" color={colors.ink2}>
              {t(copy.dismiss)}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

In `mobile/src/app/_layout.tsx`, add the import `import { PlayerNotices } from "@/ui/PlayerNotices";` and render `<PlayerNotices />` as the last child of the outer `View` in `Shell`, after the wide-layout block:

```tsx
      {wide ? (
        <View style={{ flex: 1 }}>
          <NowPlaying />
        </View>
      ) : null}
      <PlayerNotices />
    </View>
```

- [ ] **Step 4: Write the Moods screen**

Replace `mobile/src/app/(tabs)/index.tsx`:

```tsx
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import { copy } from "@/copy";
import { usePlayer } from "@/player/PlayerProvider";
import { trialLine } from "@/player/trial-line";
import { useSettings } from "@/settings/SettingsProvider";
import { radius } from "@/theme";
import { AppText } from "@/ui/AppText";

/** The one-tap way in: pick the kind of room, and that mood starts playing. */
export default function MoodsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, t, locale } = useSettings();
  const { catalogue, stale } = useCatalogue();
  const player = usePlayer();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
    >
      <AppText weight="semibold" size={32} color={colors.ink}>
        {t(copy.tabMoods)}
      </AppText>
      <AppText color={colors.ink2}>{t(copy.moodsLede)}</AppText>
      <AppText size={13} color={colors.ink3}>
        {trialLine(player.trial, locale)}
      </AppText>
      {/* A catalogue newer than this app falls back to the cache and says to update; any other
          failure just notes that the library on screen is the last one that loaded. */}
      {stale ? (
        <AppText size={13} color={colors.ink3}>
          {t(stale === "unsupported-version" ? copy.updateBody : copy.staleNotice)}
        </AppText>
      ) : null}

      <View style={{ gap: 8, marginTop: 12 }}>
        {catalogue.moods.map((mood) => {
          const active = player.filters.mood === mood.id && player.playing;
          return (
            <Pressable
              key={mood.id}
              onPress={() => player.playMood(mood.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                padding: 18,
                gap: 2,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.line,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <AppText weight="semibold" size={18} color={colors.ink}>
                {mood.label[locale]}
              </AppText>
              <AppText size={14} color={colors.ink2}>
                {mood.blurb[locale]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {catalogue.placeholder ? (
        <AppText size={12} color={colors.ink3} style={{ marginTop: 16 }}>
          {t(copy.placeholderNote)}
        </AppText>
      ) : null}
    </ScrollView>
  );
}
```

- [ ] **Step 5: Write the Library screen**

Replace `mobile/src/app/(tabs)/library.tsx`:

```tsx
import type { ReactNode } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import { TEMPO_STEP, filtersAreDefault, stepTempo } from "@/catalogue/range";
import type { Genre } from "@/catalogue/types";
import { copy } from "@/copy";
import { format } from "@/i18n";
import { usePlayer } from "@/player/PlayerProvider";
import { useSettings } from "@/settings/SettingsProvider";
import { radius } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Chip } from "@/ui/Chip";
import { TrackRow } from "@/ui/TrackRow";

function Section({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useSettings();
  return (
    <View style={{ gap: 8 }}>
      <AppText weight="medium" size={13} color={colors.ink2}>
        {label}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>{children}</View>
    </View>
  );
}

function Stepper({ label, onPress, glyph }: { label: string; onPress: () => void; glyph: string }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <AppText weight="semibold" size={18} color={colors.ink}>
        {glyph}
      </AppText>
    </Pressable>
  );
}

/** The whole catalogue, narrowed by the web's filters: mood, genre, tempo and vocals. */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors, t, locale } = useSettings();
  const { catalogue } = useCatalogue();
  const player = usePlayer();
  const { filters } = player;
  const [low, high] = filters.bpm;

  const toggleGenre = (id: Genre) =>
    player.setFilters({
      genres: filters.genres.includes(id) ? filters.genres.filter((g) => g !== id) : [...filters.genres, id],
    });
  const moveTempo = (bound: "low" | "high", delta: number) =>
    player.setFilters({ bpm: stepTempo(filters.bpm, bound, delta, catalogue.bpm) });

  const count = player.queue.length;

  const header = (
    <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 12, gap: 16 }}>
      <AppText weight="semibold" size={32} color={colors.ink}>
        {t(copy.tabLibrary)}
      </AppText>

      <Section label={t(copy.mood)}>
        <Chip label={t(copy.anyMood)} selected={filters.mood === null} onPress={() => player.setFilters({ mood: null })} />
        {catalogue.moods.map((m) => (
          <Chip
            key={m.id}
            label={m.label[locale]}
            selected={filters.mood === m.id}
            onPress={() => player.setFilters({ mood: filters.mood === m.id ? null : m.id })}
          />
        ))}
      </Section>

      <Section label={t(copy.genre)}>
        <Chip label={t(copy.allGenres)} selected={filters.genres.length === 0} onPress={() => player.setFilters({ genres: [] })} />
        {catalogue.genres.map((g) => (
          <Chip key={g.id} label={g.label[locale]} selected={filters.genres.includes(g.id)} onPress={() => toggleGenre(g.id)} />
        ))}
      </Section>

      <Section label={t(copy.vocals)}>
        <Chip label={t(copy.voxAny)} selected={filters.vox === null} onPress={() => player.setFilters({ vox: null })} />
        <Chip label={t(copy.voxOn)} selected={filters.vox === true} onPress={() => player.setFilters({ vox: true })} />
        <Chip label={t(copy.voxOff)} selected={filters.vox === false} onPress={() => player.setFilters({ vox: false })} />
      </Section>

      <Section label={t(copy.tempo)}>
        <Stepper glyph="−" label={`${t(copy.tempo)} ${low}: ${t(copy.slower)}`} onPress={() => moveTempo("low", -TEMPO_STEP)} />
        <AppText weight="medium" color={colors.ink} style={{ minWidth: 34, textAlign: "center" }}>
          {low}
        </AppText>
        <Stepper glyph="+" label={`${t(copy.tempo)} ${low}: ${t(copy.faster)}`} onPress={() => moveTempo("low", TEMPO_STEP)} />
        <AppText color={colors.ink3}>–</AppText>
        <Stepper glyph="−" label={`${t(copy.tempo)} ${high}: ${t(copy.slower)}`} onPress={() => moveTempo("high", -TEMPO_STEP)} />
        <AppText weight="medium" color={colors.ink} style={{ minWidth: 34, textAlign: "center" }}>
          {high}
        </AppText>
        <Stepper glyph="+" label={`${t(copy.tempo)} ${high}: ${t(copy.faster)}`} onPress={() => moveTempo("high", TEMPO_STEP)} />
        <AppText color={colors.ink3}>BPM</AppText>
      </Section>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText size={13} color={colors.ink2}>
          {format(t(count === 1 ? copy.trackInQueue : copy.tracksInQueue), { n: count })}
        </AppText>
        {filtersAreDefault(filters, catalogue.bpm) ? null : (
          <Pressable onPress={player.resetFilters} accessibilityRole="button" hitSlop={8}>
            <AppText weight="medium" size={13} color={colors.accent}>
              {t(copy.reset)}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      data={player.queue}
      keyExtractor={(track) => track.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={{ alignItems: "center", gap: 12, padding: 32 }}>
          <AppText color={colors.ink2} style={{ textAlign: "center" }}>
            {t(copy.nothingMatches)}
          </AppText>
          <Pressable onPress={player.resetFilters} accessibilityRole="button">
            <AppText weight="medium" color={colors.accent}>
              {t(copy.reset)}
            </AppText>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <TrackRow track={item} active={item.id === player.current?.id} onPress={() => player.play(item)} />
      )}
    />
  );
}
```

- [ ] **Step 6: Write the Settings screen**

Replace `mobile/src/app/(tabs)/settings.tsx`:

```tsx
import type { ReactNode } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCatalogue } from "@/catalogue/CatalogueGate";
import { copy } from "@/copy";
import { webUrl } from "@/links";
import { usePlayer } from "@/player/PlayerProvider";
import { trialLine } from "@/player/trial-line";
import { useSettings } from "@/settings/SettingsProvider";
import { radius } from "@/theme";
import { AppText } from "@/ui/AppText";
import { CheckIcon } from "@/ui/icons";

function Group({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useSettings();
  return (
    <View style={{ gap: 8 }}>
      <AppText weight="medium" size={13} color={colors.ink2} style={{ paddingHorizontal: 4 }}>
        {label}
      </AppText>
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <AppText color={colors.ink}>{label}</AppText>
      {selected ? <CheckIcon size={16} color={colors.accent} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, t, locale, preferences, setAppearance, setLanguage } = useSettings();
  const { catalogue } = useCatalogue();
  const player = usePlayer();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 32, gap: 24 }}
    >
      <AppText weight="semibold" size={32} color={colors.ink}>
        {t(copy.tabSettings)}
      </AppText>

      <Group label={t(copy.appearance)}>
        <Option label={t(copy.matchDevice)} selected={preferences.appearance === "system"} onPress={() => setAppearance("system")} />
        <Option label={t(copy.appearanceLight)} selected={preferences.appearance === "light"} onPress={() => setAppearance("light")} />
        <Option label={t(copy.appearanceDark)} selected={preferences.appearance === "dark"} onPress={() => setAppearance("dark")} />
      </Group>

      <Group label={t(copy.language)}>
        <Option label={t(copy.matchDevice)} selected={preferences.language === "system"} onPress={() => setLanguage("system")} />
        <Option label={t(copy.languageDa)} selected={preferences.language === "da"} onPress={() => setLanguage("da")} />
        <Option label={t(copy.languageEn)} selected={preferences.language === "en"} onPress={() => setLanguage("en")} />
      </Group>

      <View style={{ gap: 12 }}>
        <AppText weight="medium" size={13} color={colors.ink2} style={{ paddingHorizontal: 4 }}>
          {t(copy.demo)}
        </AppText>
        <AppText color={colors.ink}>{trialLine(player.trial, locale)}</AppText>
        <Pressable
          onPress={() => void Linking.openURL(webUrl("signup", locale))}
          accessibilityRole="link"
          style={{ paddingVertical: 14, alignItems: "center", borderRadius: radius.pill, backgroundColor: colors.accent }}
        >
          <AppText weight="semibold" color={colors.accentInk}>
            {t(copy.lockedCta)}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(webUrl("pricing", locale))}
          accessibilityRole="link"
          style={{ paddingVertical: 14, alignItems: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong }}
        >
          <AppText weight="medium" color={colors.ink}>
            {t(copy.pricing)}
          </AppText>
        </Pressable>
        {catalogue.placeholder ? (
          <AppText size={12} color={colors.ink3}>
            {t(copy.placeholderNote)}
          </AppText>
        ) : null}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 7: Verify**

In `mobile/`: `npm test && npm run typecheck`
Expected: all suites pass (including trial-line); typecheck exits 0.

Run the app (Task 10, Step 7) and check:
1. **Moods:** five mood cards with their venue blurbs; the trial line reads "Free demo — starts when you press play" until the first play. Tapping *Warm* plays a warm track and outlines the card.
2. **Library:** the Mood row shows *Warm* selected after step 1, and the count matches the list. Genre chips combine; *All genres* clears them. Vocals chips are mutually exclusive. The tempo steppers move by 5, stop at 55 and 130, and never cross. A combination with no results shows "Nothing matches" with Reset. *Reset filters* appears only while something is filtered.
3. **Settings:** choosing *Dark* switches the app at once and survives a restart; *Match device* follows the simulator again. Choosing *Dansk* switches every string; *Match device* restores the device language. *Get 14 days free* and *See pricing* open the website's signup and pricing pages in the current language.
4. **Trial expiry:** temporarily add this to the top of `src/app/_layout.tsx`, below the imports, and reload:

   ```tsx
   import AsyncStorage from "@react-native-async-storage/async-storage";
   void AsyncStorage.setItem("odatone.trial.v1", String(Date.now() - 8 * 24 * 60 * 60 * 1000)); // TEMPORARY
   ```

   Pressing play shows "The demo is over." with *Get 14 days free*, and nothing plays. Then change the line to `void AsyncStorage.removeItem("odatone.trial.v1"); // TEMPORARY`, reload once, and **delete both lines** before committing — `git diff src/app/_layout.tsx` must not show them.
5. **Gave up:** point `EXPO_PUBLIC_SITE_URL` at the local server, open the library, then stop the server and press play. After three tracks fail, playback stops with "The music stopped".

- [ ] **Step 8: Commit**

```bash
git add -A mobile/src
git commit -m "Build the Moods, Library and Settings screens and the player notices

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Prove it on real devices, and document it

**Files:**
- Create: `mobile/README.md`
- Modify: `README.md` (repository root — add a short "Mobile app" section)

**Interfaces:**
- Consumes: the finished app and web changes.
- Produces: a device checklist with recorded results; documentation for running, testing and releasing.

- [ ] **Step 1: Run every automated check**

In `mobile/`:
- `npm test` → every suite passes
- `npm run typecheck` → exit 0
- `npx expo-doctor` → `No issues detected!`

Repository root:
- `pnpm test` → every web test passes, including `filter-golden` (proves the app's golden file is current)
- `npx tsc --noEmit` → exit 0
- `npx next build 2>&1 | grep -E "catalogue.json|● /da$|ƒ /\[locale\]"` → shows `○ /catalogue.json` and `● /da`, and **no** `ƒ /[locale]` line: the pages are still prerendered.

Stop at the first failure and fix it; do not continue to devices with a red check.

- [ ] **Step 2: Build development builds**

Background playback and lock-screen controls come from the `expo-audio` config plugin, which Expo Go cannot load. In `mobile/`:

- iPhone: `npx expo run:ios --device` (needs Xcode and the phone connected)
- Android phone: `npx expo run:android --device` (needs Android Studio and USB debugging)

The app must reach the catalogue: the deployed site (Task 1, Step 9) or `EXPO_PUBLIC_SITE_URL=http://<LAN IP>:3000` with `npx next start -H 0.0.0.0` running.

- [ ] **Step 3: Work through the device checklist**

Do each on the device named, and note the result. These are the behaviours no simulator proves.

| # | Device | Do | Expected |
| --- | --- | --- | --- |
| 1 | Android | Play, lock the screen, wait **6 minutes** | Still playing after 6 minutes; the media notification shows title and artist |
| 2 | Android | Clear app data, relaunch, **decline** notification permission at first play, lock the screen, wait **6 minutes** | Record what happens. If playback stops near 3 minutes, this is the spec's open risk: report it to the owner rather than working around it |
| 3 | iPhone | Play, lock the screen, wait 6 minutes | Still playing; lock screen shows title, artist and the Odatone artwork |
| 4 | Both | From the lock screen: pause, play, seek forward and back | Each works. There is no skip-track control — expected, `expo-audio` offers none |
| 5 | Both | Call the phone while playing, then hang up | Playback pauses for the call |
| 6 | Both | Play through a Bluetooth speaker, then switch the speaker off | Playback stops; reopening the app shows the play icon in the mini player |
| 7 | Both | Put the phone in silent mode while playing | Music keeps playing |
| 8 | iPad or Android tablet | Rotate between portrait and landscape | Split layout in landscape, phone layout in portrait on a small tablet |
| 9 | Both | Play a track 1 minute in, force-quit, reopen | Same track and position, **paused** |
| 10 | Both | Airplane mode, reopen the app | Library shows from the cache; pressing play fails three tracks then shows "The music stopped" |

- [ ] **Step 4: Write the mobile README**

Create `mobile/README.md`, filling the Result column of the device table with what Step 3 found:

````markdown
# Odatone — mobile app

The Odatone music player for iOS and Android phones and tablets, built with
Expo SDK 57. It streams the catalogue published by the website at
`/catalogue.json`; the design is in
`docs/superpowers/specs/2026-09-15-odatone-mobile-app-design.md`.

## Running it

```bash
npm install
npx expo start          # Expo Go — enough for building screens
```

The app reads the catalogue from `https://odatone.vercel.app` by default. To
use a local copy of the site, run `npx next build && npx next start -H 0.0.0.0`
in the repository root and start the app with `EXPO_PUBLIC_SITE_URL`:

| Where the app runs | `EXPO_PUBLIC_SITE_URL` |
| --- | --- |
| iOS Simulator | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| A phone on the same network | `http://<computer's LAN IP>:3000` |

**Background playback and lock-screen controls do not work in Expo Go.** Use a
development build: `npx expo run:ios --device` or `npx expo run:android --device`.

## Tests

```bash
npm test
npm run typecheck
```

Tests cover the logic: filtering, the trial, queue navigation, resuming,
catalogue parsing and caching, covers and the waveform. Screens and audio are
checked on devices (below).

The filter must behave exactly as the web's. After changing `filterTracks` or
the catalogue, run `node scripts/filter-golden.mjs` from the repository root;
the web's test suite fails until you do.

## Checked on devices

| # | Check | Result |
| --- | --- | --- |
| 1 | Android keeps playing 6 minutes with the screen locked | |
| 2 | Android, notification permission declined, 6 minutes locked | |
| 3 | iPhone keeps playing 6 minutes locked, artwork shows | |
| 4 | Lock-screen pause, play and seek | |
| 5 | Phone call pauses playback | |
| 6 | Bluetooth speaker off stops playback; mini player shows it | |
| 7 | Silent mode keeps playing | |
| 8 | Tablet rotation switches layouts | |
| 9 | Resumes the same track and position, paused | |
| 10 | Offline: cached library; stops after three failed tracks | |

## Known limitations

- **The lock screen cannot skip tracks.** `expo-audio` exposes play, pause and seek only.
- **Disconnecting a Bluetooth speaker stops the music.** Operating-system behaviour.
- **Online only.** Nothing is cached for offline playback.
- **The trial is on the device.** Reinstalling resets it; there are no accounts.

## Before a store release

- **Confirm the bundle identifier.** `com.odatone.player` in `app.json` is a placeholder choice.
- **Replace the icon and splash images.** They are still Expo's.
- **Review the Danish strings marked `NEW` in `src/copy.ts`.** They exist only in the app and were not written by a native speaker.
- **Change the site URL** when the redesign moves to `odatone.com`; `odatone.com` does not serve the catalogue today.
- **Move waveform peaks out of the catalogue** before the real catalogue ships: 180 peaks for each of 4,000+ tracks makes a multi-megabyte launch download.
- **The trial ends by linking to signup on the website.** App Store review scrutinises flows that send people elsewhere to pay; the owner has chosen to keep it.
- Lock-screen artwork is `public/app-artwork.png` on the website, rendered by `node scripts/render-app-artwork.mjs`.
````

- [ ] **Step 5: Point to it from the root README**

In the repository root `README.md`, add this section directly before `## Installing`:

```markdown
## Mobile app

`mobile/` holds the Odatone player for iOS and Android, built with Expo. It reads
the catalogue this site publishes at `/catalogue.json` — generated from
`lib/tracks.ts`, so the app picks up catalogue changes without a release — and
streams audio from `public/audio`. It has its own dependencies and is excluded
from this site's TypeScript build and Vercel upload. See `mobile/README.md`.
```

- [ ] **Step 6: Commit**

```bash
git add mobile/README.md README.md
git commit -m "Document the mobile app and record the device checks

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Push (ask the user first)**

Pushing `main` deploys the website, which now serves `/catalogue.json` and `/app-artwork.png`. Ask the user; only on a yes, `git push origin main`, then confirm once the deployment is Ready:

Run: `curl -s -o /dev/null -w '%{http_code}\n' https://odatone.vercel.app/app-artwork.png`
Expected: `200`.
