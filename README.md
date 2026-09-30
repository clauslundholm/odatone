# Odatone — redesign

A full rebuild of odatone.com in Next.js and Tailwind, in Danish and English,
with a free interactive web player, a savings calculator and a SaaS signup
flow that is not a shopping cart.

```bash
npm install      # run this on your own machine — see "Installing" below
npm run dev      # http://localhost:3000 → redirects to /da
npm run build
```

---

## What's here

| Route (da / en) | What it is |
| --- | --- |
| `/da` · `/en` | Landing page: hero, worked example, calculator, player, how it works, the legal argument, artists, proof, pricing, FAQ |
| `/afspiller` · `/player` | The library — filters and the full track table |
| `/besparelse` · `/savings` | The savings calculator with its own FAQ |
| `/priser` · `/pricing` | Plans, comparison table |
| `/artister` · `/artists` | The deal offered to musicians, roster |
| `/om-odatone` · `/about` | Story, people, values |
| `/kontakt` · `/contact` | Sales lead form |
| `/kom-i-gang` · `/get-started` | The four-step signup flow |
| `/privatliv` · `/privacy`, `/betingelser` · `/terms` | Legal |

25 statically generated routes including `sitemap.xml` and `robots.txt`.

## The mobile app

`mobile/` is the Expo / React Native app — its own `package.json`, its own
`node_modules`, no shared workspace. See `mobile/README.md`. The website's
TypeScript project excludes it, and `vercel.json` skips a deploy when a
commit touches nothing outside `mobile/`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · next-themes.
No other runtime dependencies. One self-hosted variable typeface: Inter.

## Design

Light-first and near-monochrome: graphite on off-white, generous whitespace,
one idea per section, rounded surfaces, and colour used once per screen at
most. Tokens live in the `@theme inline` block and the `:root` /
`:root[data-theme="dark"]` blocks of `app/globals.css`.

- Ground `#f5f5f7`, cards `#ffffff`, ink `#1c1c1e`, secondary `#6e6e73`
- Dark theme: ground `#0b0b0c`, ink `#f5f5f7`
- **Accent comes from the logo.** `public/odatone-logo_colour.svg` is a
  magenta→blue gradient lockup, and `--g-brand` reproduces it. Solid accent
  is `#7a3aff` (4.97:1 as text on the light ground, 5.42:1 for white text on
  it); the gradient itself is reserved for one figure per screen — the
  savings number, the "2" on the artists page, a plan discount.
- Radii run 6 → 36px. Buttons are pills. Nothing has a hard corner.
- `.on-dark` turns any section black whatever the theme — the player
  moment, the artists moment, the expanded dock panel.

> The `inline` keyword on `@theme` is load-bearing. Without it Tailwind
> resolves `var(--c-*)` once at `:root`, and every `.on-dark` island renders
> light-theme colours inside a dark section. Don't remove it.

### Typography

Inter, self-hosted as one variable woff2 (`app/fonts/inter-latin.woff2`),
carrying the whole site. Four utilities in `globals.css` do the work:

| Utility | Job |
| --- | --- |
| `.u-display` | headlines — 600, `-0.032em`, `line-height 1.05` |
| `.u-title` | card and section titles — 600, `-0.024em` |
| `.u-lede` | subheads — fluid, `--c-ink-2` |
| `.u-label` | small structural labels — 500, sentence case |

Nothing is set in capitals and there is no second typeface; figures use
Inter's tabular set (`.u-tabular`) rather than a mono face.

### Layout

`components/ui/Section.tsx` holds the primitives. `Container` gives three
measures (760 / 1040 / 1320px), `Section` the vertical rhythm, `SectionHead`
a centred label + headline + lede + actions, and `Tile` the rounded card
that every grid is built from. `PageHero` opens each page the same way, over
an `Aurora` — a soft wash of the brand gradient.

## The hero

The landing page leads with the saving, not the product. The headline is the
qualified claim (`op til 90 %`), the subhead names what Odatone actually is,
and `components/marketing/HeroSavings.tsx` makes the number specific in one
tap: a row of venue pills over a live annual figure.

Picking a venue writes to the shared venue profile (`lib/profile.ts`,
`sessionStorage`), so the calculator further down the page and step one of the
signup flow both open already filled in. Re-picking the same venue keeps
whatever floor area the visitor set themselves; switching venue resets it to
that type's sensible default.

## Content and i18n

Every string lives in `lib/content/*.ts` as a `{ da, en }` object. Components
contain no copy. Adding a language means adding a key to `LOCALES` in
`lib/i18n.ts` and filling in the content objects.

Slugs are localised. One dynamic route (`app/[locale]/[page]/page.tsx`) serves
every content page and resolves a slug to a stable page key, so the language
switcher only has to map `key → slug in the other language`. Nothing hard-codes
a path — always use `href(locale, key)`.

The root layout lives at `app/[locale]/layout.tsx` and there is deliberately no
`app/layout.tsx`; that is what allows `<html lang>` to vary per language.
`/` redirects to `/da` (see `next.config.ts`).

## The player

The player is site-wide. `PlayerProvider` is mounted once in
`app/[locale]/layout.tsx`, and `PlayerDock` renders a full-width bar pinned
to the bottom of every route — so audio keeps running as you move from the
landing page to pricing to the signup flow, and the bar is the transport for
the whole site. Everything that must clear it reads `--dock-h` (64px on
phones, 80px above `md`); `DockSpacer` at the end of the layout keeps the
footer above it.

The bar is always present, including before anyone has pressed play: it opens
with an invitation ("Hør hvordan din forretning kommer til at lyde — gratis i
7 dage") and three mood chips. Once playing it shows the generated cover
tile, title and artist, transport, a scrub rail with times, volume, days left
in the demo, and a chevron that raises the panel.

- **The panel** (chevron, or click the track name) slides up over the page:
  live spectrum, the full waveform scrubber, and a Queue / Library tab pair.
  Escape closes it.
- **`/afspiller`** is the library rather than a second player — a filter rail
  and the full sortable table. Clicking a row plays it in the dock.
- **The landing page** offers two ways in: the hero's `MoodCard` and the
  `MoodGrid` section, both of which set a filter and hand playback to the
  dock.

`lib/tracks.ts` is the single source of truth: 24 tracks with title, artist,
genre, mood, BPM, vocals, energy, duration, `src` and 180 waveform peaks.
There is no artwork — `Cover` draws each track a deterministic tile from a
hash of its id over its own peaks, so covers need no assets and never change.

Other details worth knowing:

- The Web Audio `AnalyserNode` is created lazily on the first play (a user
  gesture, as browsers require). If the graph is refused the player keeps
  working and only the spectrum falls back to a synthetic bounce.
- Space plays and pauses, Shift + ← / → skips, and Media Session metadata is
  published so the OS media keys show the track.
- `wantsPlay` in the provider exists because picking a mood filters the queue
  and swaps the track in the same tick as the play request; without it the
  new track loads paused.
- **Switching language remounts everything.** The locale is the root layout
  segment (that is what gives each language its own `<html lang>`), so a
  language switch tears down the provider and the audio element with it.
  `lib/audio/session.ts` parks the track, position, play state, volume and
  filters in `sessionStorage` on unmount and restores them on the other side;
  the same snapshot covers a hard reload.
- The dock is translucent rather than solid, and follows the page theme
  rather than staying black.
- The free demo window is **7 days**, kept in `localStorage`
  (`odatone.player.trial.v1`). When it runs out the dock turns into a locked
  state with the trial CTA and the library page is covered by a gate. There is
  a visible "reset demo" control so the state can be reviewed — remove it
  before launch if you don't want it.

### ⚠️ The audio is placeholder material

`public/audio/*.mp3` was synthesised by `tools/generate-placeholder-audio.py`
(numpy + ffmpeg, ~5 MB in total) so that the player is demonstrable before the
real catalogue is connected. **None of it is Odatone music, and every artist
name in `lib/tracks.ts` is invented.**

To go live: drop the real files into `public/audio` (or point `src` at a CDN),
replace the metadata, regenerate `peaks` with any waveform extractor, and set
`TRACKS_ARE_PLACEHOLDER = false` — that flag hides the disclaimer strips.

## The savings calculator

`lib/rates.ts` holds **every** number the calculator shows, and nothing else in
the codebase carries a tariff.

> **⚠️ The rates are not verified.** Koda and Gramex publish tiered rate cards
> at kunde.koda.dk, but those pages block automated retrieval, so the model is
> *calibrated* rather than copied: the per-m² coefficients are chosen so a
> typical venue lands inside the guideline annual totals Danish
> background-music resellers publish (café 3,000–6,000 kr./yr, restaurant
> 10,000+, salon 1,800–2,500, hotel 8,000–20,000 — sources:
> baggrundsmusik.dk, musiklicens.dk, both labelling their figures
> "vejledende"). Pull the real tariffs, set `base` and `perM2` per venue type,
> and flip `RATES_VERIFIED` to `true`.

Until that flag is true, `/besparelse` shows a warning banner, and every screen
that displays a figure carries a "vejledende tal" line.

The 54/46 Koda/Gramex split and the 199 kr./mo streaming-service line are also
assumptions, marked as such in the file.

## Pricing

`lib/pricing.ts`. 149 / 199 / 249 kr. per location per month, matching the
current site.

- `ANNUAL_DISCOUNT_PCT = 45` because the current pricing page advertises
  "Spar 45 %". That is unusually deep for an annual term — **confirm it is not
  a launch offer.** The billing toggle defaults to monthly so the list prices
  match the "fra 149 kr." claim used elsewhere.
- `VOLUME_TIERS` (−10 / −15 / −20 % from 2, 5 and 10 locations) is a proposal
  for this redesign; the current site has no multi-location pricing.

## Admin

`/admin` (staff-only, English) is a Supabase-backed backend layered on top of
the marketing site and the pricing above. `staff_admin` and `staff_support`
accounts (see `profiles.role`) can both sign in and view every screen;
`plans_admin_write`/`addons_admin_write` (`supabase/migrations/0003_tenancy.sql`)
restrict *writes* to `staff_admin`, and every server action relies on that RLS
policy rather than re-checking the role itself — a `staff_support` account's
save is refused by the database, not the UI.

`/admin/products` (`app/admin/products/`) lets `staff_admin` edit a plan's
price, m² bound, tagline, features and active flag without a deploy. Every
*computed* price on the marketing site reads the same `plans` table via
`lib/plans-server.ts`'s `activePlans()` — `PricingTable`, `Calculator`,
`HeroSavings`, `PriceCompare`'s worked example, and the signup flow's plan
cards and order summary — so a saved change is live everywhere on the next
request. **This does not cover hand-written marketing copy that happens to
quote a price**: `lib/content/home.ts` (the hero body and a headline tile)
and `lib/content/meta.ts` (the page description) each hard-code "149 kr." as
prose, not a computed value, and won't move when a plan's price is edited —
update those by hand alongside a real price change. Every insert/update/
delete on `plans` *and* `addons` is recorded in `audit_log` by a
`security definer` trigger (`supabase/migrations/0004_audit_triggers.sql`),
with the acting user, the full before and after row, and a timestamp; a
save that changes nothing (an operator re-submitting a form untouched)
does not add a row.

**`supabase db reset` silently reverts a live price.** The migration and seed
files are the bootstrap for a *fresh* database, not a mirror of what's
currently live — `supabase/seed.sql` is generated from the compiled `PLANS`
constant in `lib/pricing.ts` (`scripts/plans-seed.mjs`) and always inserts the
149/199/249 kr. launch prices. If you reset your local database after editing
a price in `/admin/products`, the reset re-runs that seed and your edit is
gone with no error or warning. Re-apply it through `/admin/products` (or a
one-off `update plans set ...`) after every reset, and don't mistake a reset
database for a bug in the admin editor.

## The signup flow

`components/signup/SignupFlow.tsx`. Four steps — business, plan, account,
payment — with a live order summary pinned alongside, `?step=` in the URL, and
`?plan=`/`?billing=` honoured from pricing links. The calculator writes its
answers to `sessionStorage`, so a visitor arriving from `/besparelse` finds
step one already filled in and the plan pre-selected for their floor area.

Card and EAN/invoice are both offered, but **no payment provider is wired
up** — `app/actions.ts`'s `submitSignup` validates the payment step's own
fields (card number, expiry, CVC, or the EAN/PO pair) and logs them; no card
is stored or charged. Everything *before* that step is real: `submitSignup`
creates a `customers` row, one `locations` row per claimed location and a
`pending` `subscriptions` row (see `lib/signup.ts`'s `buildSignup` for the
validation — no price is ever read from the form; a plan's price always
comes from the `plans` table, live, at read time), then invites the signer
to `/my-odatone` by email rather than asking them to set a password. A
signup from an email that already has an account is refused rather than
duplicated; a signup that never receives its invite (a flaky mail send) is
still kept as a real, pending customer — `/admin/customers/[id]` shows "No
users yet" for exactly that case, which is how staff notice one needs a
manual re-invite (there is no button for that yet). `submitSalesLead` is
still the original prototype: validates and logs, nothing persisted.

The mobile app places the same order through `POST /api/app/signup`
(`app/api/app/signup/route.ts`), which turns the app's JSON into the
`FormData` `submitSignup` takes and calls it unchanged. The app cannot
follow the invite link, so the invite and recovery emails also print a
6-digit code; see `docs/supabase-email-templates.md`.

## Environment variables

See `.env.example`. `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` come from `supabase start`'s own output
locally, or the project's API settings against a hosted Supabase project.
`NEXT_PUBLIC_SITE_URL` is this site's own public origin — it must match
`supabase/config.toml`'s `[auth].site_url` — and is used to build the
signup invite email's link; left unset, that link degrades to a relative
path (a warning is logged every time `submitSignup` runs without it, rather
than failing the signup over a cosmetic link problem).

## Known placeholders — check before launch

- **The logo has no dark-surface variant.** `odatone-logo_colour.svg` is used
  as supplied; its blue end sits at 3.9:1 on the near-black ground, so the
  right half of the wordmark reads dimmer in dark mode. A white or
  single-weight version for dark surfaces would fix it.
- `lib/site.ts`: phone number, CVR, address and social URLs are invented. The
  current site publishes none of them.
- Customer names on the landing page are the four that appear on the current
  odatone.com. **Don't add a business without a signed reference**, and replace
  the text wordmarks with real logo files.
- The behavioural statistics (32 % / 92 % / 90 %) are quoted from the current
  site with no source. Cite them or drop them.
- Founder biographies are written from the current About page — get them
  approved.
- Privacy policy and terms are prototype text and need a lawyer.
- The login link points at `odatone.1000trax.com/app`, the current app URL.

## Installing

`npm install` must run **on your own machine**. The project was built in a
Linux container; installing there and copying `node_modules` across writes
linux-arm64 binaries for `@tailwindcss/oxide`, `lightningcss` and `@next/swc`,
and `npm run dev` then dies with `Cannot find native binding`. The lockfile
carries every platform's entries, so it can stay as it is.

## Verified

`next build` produces 25 routes with no errors. Every route was walked in both
languages, both themes, at 360 / 390 / 768 / 1024 / 1440 / 1920 px: no console
errors, no page with horizontal scroll. The player (play, skip, seek, filters,
volume, trial expiry and reset), the calculator, the four-step signup including
validation, the sales form, the theme toggle and the language switcher were all
clicked through in Playwright.
# odatone
