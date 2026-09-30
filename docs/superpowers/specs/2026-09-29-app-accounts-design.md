# App accounts: signup, login, logout, gated playback

Date: 2026-09-29
Status: approved design, awaiting spec review

## Goal

People can create an Odatone account from inside the app, log in, reset a
forgotten password and log out. Being logged in with a live subscription is
what unlocks playback. The app uses the same Supabase backend as the website
(`../odatone`), so an account made in either place works in both.

## Decisions

| Topic | Decision |
|---|---|
| What logging in does | Unlocks playback. Logged-out people can browse everything; pressing play asks them to log in or sign up. |
| Who can play | Signed in, with a latest subscription whose status is `pending`, `trialing`, `active` or `past_due`. Staff roles (`staff_admin`, `staff_support`) can always play. `cancelled` or no subscription cannot. |
| Signup scope | The website's full 4-step order, rebuilt natively: venue, plan, account details, payment. |
| Payment | Invoice only: optional EAN and PO, plus accepting the terms. No card fields in the app. |
| First login | The invite email carries a 6-digit code. The customer types it in the app, chooses a password and is signed in. The web invite link keeps working. |
| Forgot password | Also by emailed code, entered in the app. |
| Backend | Approach A: a new API route on the website that reuses the existing signup action. |

## Backend changes (`../odatone`)

### `POST /api/app/signup`

A new route handler, `app/api/app/signup/route.ts`.

- It accepts JSON with these fields: `name, company, email, cvr, phone,
  address, postcode, city, planId, billing, locations, venueType, m2,
  paymentMethod, ean, po, locale`.
- It sets `paymentMethod` to `"invoice"` whatever the client sent.
- It converts the body to `FormData` with the same field names
  `SignupFlow.tsx` sends, then calls `submitSignup` from `app/actions.ts`
  unchanged.
- It returns the `ActionResult` as JSON with status 200: `{ ok: true }` or
  `{ ok: false, errors: { [field]: code } }`.
  - `errors.email === "exists"` means the email already has an owner account.
  - `errors.form === "server"` means a server failure.
- A body that isn't valid JSON returns 400 with `{ ok: false, errors: { form: "invalid" } }`.
- Only POST is allowed; other methods get Next.js's default 405.

Because the action is reused unchanged, validation (`buildSignup`),
deduplication (`decideSignupDedupe`), creating the customer, locations and
pending subscription (`apply_signup_order`), the invite
(`inviteUserByEmail`), the `profiles` row and the cleanup on failure behave
exactly as on the web.

The JSON-to-`FormData` conversion is a pure function in
`lib/app-signup.ts`, so it can be tested without Next.js.

### Email templates

- `supabase/templates/invite.html` and `supabase/templates/recovery.html`
  gain a clearly set-off block with the code, in Danish and English:
  "Using the app? Enter this code: `{{ .Token }}`". It sits above the
  existing link. `otp_length` is already 6 and `otp_expiry` is already
  3600 seconds (`config.toml`).
- **The hosted project has to be updated by hand:** paste the same template
  bodies into Supabase Dashboard → Authentication → Email Templates (Invite
  user, Reset password). The implementation hands over these steps; nothing
  can reach the dashboard automatically.

Nothing else on the website changes. Row-level security in
`0003_tenancy.sql` already lets a signed-in user read their own `profiles`,
`customers` and `subscriptions`, and anyone can read `plans`.

Not in scope: rate limiting on the new route (the web form has none; GoTrue
limits invite emails to about 2 per hour), captcha, and card payment.

## App changes (`odatone-app`)

### Configuration

- `.env`, with `.env.example` committed:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_API_URL`, which is `https://odatone.studio74.io`
- `.env` is added to `.gitignore`.
- New dependency: `@supabase/supabase-js`. AsyncStorage is already installed.

### Shared pricing logic

`tools/import-pricing.mjs` copies the website's `lib/pricing.ts` and
`lib/rates.ts` into `src/shared/`. It rewrites their imports (the `L10n`
type) and adds a GENERATED header, the same pattern as
`tools/import-tracks.mjs`. The npm script is `import-pricing`.

Plan prices are fetched from the Supabase `plans` table. If the fetch fails,
the copied `PLANS` defaults are used. Before implementing, check how the web
merges `plans` rows (`lib/plans-server.ts`) and mirror that merge.

### Auth module: `src/auth/`

- `supabase.ts` creates the client:
  - AsyncStorage for storage, `autoRefreshToken`, `persistSession`,
    `detectSessionInUrl: false`.
  - `startAutoRefresh` / `stopAutoRefresh` follow `AppState`.
- `entitlement.ts` holds the pure rule, which is unit tested:
  - `entitled(account, now, cache)` is true when the role is staff, or when
    the latest subscription's status is one of `pending | trialing |
    active | past_due`.
  - "Latest subscription" is picked the same way as the website's
    `latestSubscription` (`lib/admin/customers.ts:96`). It is copied into
    `entitlement.ts`: prefer the newest subscription with an earning status,
    otherwise the newest overall.
  - Offline fallback: if the account couldn't be fetched, the last known
    entitlement saved in AsyncStorage (`odatone.entitlement.v1`, holding
    `{ entitled, at }`) counts for 7 days after `at`.
- `AuthProvider.tsx` exposes:
  - State: `session`, `account` (`{ profile, customer, subscription } |
    null`), `entitled`, `loading`.
  - Actions:
    - `signIn(email, password)`
    - `signOut()`
    - `signup(payload)`, which calls the API
    - `verifyInvite(email, code, password)`: `verifyOtp` with `type:
      "invite"`, then `updateUser({ password })`
    - `resendCode(email)`
    - `requestReset(email)`: `resetPasswordForEmail`
    - `resetPassword(email, code, password)`: `verifyOtp` with `type:
      "recovery"`, then `updateUser`
    - `refresh()`
  - The account is re-read on sign-in, when the app returns to the
    foreground, and on `refresh()`.
- `resendCode(email)` calls `signInWithOtp({ email, options: {
  shouldCreateUser: false } })`.
  - That sends the existing sign-in-code email (`magic_link.html`, which
    already prints `{{ .Token }}`).
  - The code it sends is then confirmed with `verifyOtp({ email, token,
    type: "email" })`, followed by `updateUser({ password })`.
  - The verify screen remembers whether the code came from the invite or
    from a resend, and passes the matching `type`.

### Gating

- `PlayerProvider` takes the entitlement from `useAuth()`.
  - The existing call sites (`playTrack`, `playList`, `toggle` when
    starting playback, `next`, `previous`) consult a `guard()` that
    returns `entitled`.
  - When the guard refuses, it sets `gate: "login" | "ended"`, and playback
    does not start.
  - Pausing is never gated.
- A root-level sheet in `app/_layout.tsx` renders the gate:
  - `login` shows "Log in to play", with the buttons "Log in" and "Create
    account".
  - `ended` shows "Your subscription has ended" and a button that opens
    `/my-odatone` in the browser.
- On sign-out, the provider pauses playback, clears the queue and track,
  and clears the cached entitlement.

### Screens

All the new screens are modal routes under `app/auth/`, presented over the
tabs.

- **`login`**: email, password, "Forgot password?", "Create account".
  Errors are shown generically ("Wrong email or password").
- **`signup`**: 4 steps in one screen with a progress indicator, "Back" and
  "Next", and a step counter.
  - The steps are Venue, Plan, Account and Payment. Their fields and
    validation match `SignupFlow.tsx`.
  - Client-side checks mirror `buildSignup`, including the length caps,
    required fields and email format.
  - Server field errors are mapped back to the step that owns the field.
  - When the order succeeds, the app goes to `verify` with the email.
- **`verify`**: shows the email the code was sent to, a 6-digit code field,
  a password field (at least 8 characters) and "Resend code". Success
  closes the auth modals and returns the customer to where they were.
- **`forgot`**: first the email, then the code and a new password.
- **Account tab**:
  - Signed out, the top card has "Log in" and "Create account".
  - Signed in, it shows the name, company, email, plan name, subscription
    status, "Manage subscription" (which opens
    `${EXPO_PUBLIC_API_URL}/my-odatone`) and "Log out". Pulling down calls
    `refresh()`.

All the new text goes in `src/i18n/strings.ts` in Danish and English. Where
it exists, reuse the website's wording from `lib/content/signup.ts` and
`lib/content/portal.ts`.

## Errors

| Case | Behaviour |
|---|---|
| Wrong credentials | One generic message; the app never reveals whether the account exists |
| Signup field errors | Shown under each field; the app jumps to the step that owns the field |
| `email: "exists"` | "You already have an account", with "Log in" and "Reset password" |
| Wrong or expired code | "The code is wrong or has expired", with "Resend code" |
| Network or 5xx, or a missing endpoint (404) | "Couldn't reach Odatone, try again"; nothing typed is lost |
| Account fetch fails | Offline fallback (7 days), otherwise the app treats the person as not entitled |

## Testing

- **Website:** `test/app-signup.test.ts` covers the JSON-to-`FormData`
  mapping: every field, the forced `paymentMethod`, and missing and extra
  keys. It runs in the existing test runner.
- **App:** unit tests with `node --test` (TypeScript via the same approach
  the website's tests use) for:
  - `entitlement.ts`: every status × role, and the offline window
    boundaries.
  - The copied pricing: `quote()` and `recommendPlan()` must give the same
    results as the website's for a fixed set of inputs.
- **Build:** `npm run typecheck`, and an iOS bundle build on Metro.
- **Manual end to end,** after the website is deployed and the templates
  are updated: sign up → receive the code → verify → play → background and
  foreground → log out → log in → forgot password. Use an email address the
  user nominates.

## Out of scope

Card payment or in-app purchase, editing billing details in the app,
invoices in the app, a staff/admin UI in the app, social login,
biometric unlock, and push notifications.

## Risks

- **App Store review:** selling a subscription in the app without Apple's
  in-app purchase may be rejected. A business-to-business invoice order
  gives some room, but it isn't guaranteed. This is accepted for now.
- **Hosted templates:** the invite and recovery templates must be updated in
  the Supabase dashboard. Until they are, the code never arrives, and the
  verify screen can't complete.
- **Website deploy:** the endpoint has to be deployed before app signup
  works. Login works without it.
