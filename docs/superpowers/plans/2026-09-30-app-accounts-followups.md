# App accounts — follow-ups

2026-09-30: brought up to date with `main` (signup rebuilt as one page, CVR required, Faktura/EAN dropped, plans validated against the database); the app's signup was aligned — two steps, CVR required, no payment details collected in the app.

Known small issues left open when the accounts work (plan: `2026-09-30-app-accounts.md`) was merged into `mobile-monorepo`. Each was found in review, judged not to block the merge, and recorded here so it is not lost. None lets a non-customer play or stops a paying customer's music.

The end-to-end run in the plan's Task 9 Step 5 has not been done. It needs the website deployed (with the rebuilt one-page signup), the hosted Supabase email templates updated (`docs/supabase-email-templates.md`) and a test mailbox.

## Open items

- **Task 1:** route buffers the whole body with request.text() before the 10 000-char cap applies (cap limits parsing, not memory)
- **Task 1:** no test for the route handler itself; 400/500/passthrough covered only by manual curl
- **Task 2:** {{ .Token }} in the HTML header comment is rendered into every sent email's source (the recipient's own code; magic_link.html's comment already does the same).
- **Task 3:** @supabase packages declare engines node >=22 — check the EAS/CI Node version
- **Task 4:** clock bound blocks only large rollbacks (an 8-day-old yes with the clock set back 2 days still plays); comment could say so
- **Task 4:** a cache stamped while the device clock was far ahead is rejected offline once the clock is corrected (fails closed; shop loses music until online)
- **Task 4:** latestSubscription has no guard for an unparseable created_at; test gaps at the exact -CLOCK_DRIFT_MS boundary and staff+unavailable
- **Task 5:** offline with an expired token, signOut() can take ~30 s while auth-js retries the refresh (pre-existing behaviour of the library call)
- **Task 5:** switching identity A→B with no signed-out step gives one commit with B's id and A's loaded account (pre-existing; effect corrects it)
- **Task 5:** signIn can resolve before a fresh answer if a refresh/foreground/recheck supersedes the joined read while it waits (checking stays true; no stuck state)
- **Task 5:** the join rule, the 8 s settle bound and the three-state session logic in AuthProvider have no unit test (no React harness); verified by code reading and the pure-function tests only
- **Task 7:** signup `errors` and the unreachable notice are not cleared on Back or when a field is edited; a stale notice can reappear until the next Next/Submit
- **Task 7:** a server `billing` error has no display slot on step 0 (cannot occur with the app's own values)
- **Task 8:** gate "Check again" closes the sheet whatever the answer, gives no feedback if still not entitled, and is a no-op when identity comes from the cache only
- **Task 8:** sign-out reset leaves `repeat` and the loaded source; `previous` is guarded on its seek-to-start branch
- **Task 8:** after entitlement is lost and regained with a track still loaded, lock-screen controls stay disarmed until the next track load
- **Task 8:** on Android a remote play is audible for a moment before the listener's re-pause lands; none of the lock-screen behaviour has been exercised on a dev build
- **Task 9:** README's "last known answer for 7 days" does not say only a cached yes for the same user counts
- **Final:** "I have a code" lands on a verify screen whose body says a code was just sent, also for long-standing accounts — Ruling: cosmetic; "Resend code" covers it.
- **Final:** a logged-in customer with no cache and an unreadable session is shown the login sheet once getSession() settles; after a failed periodic re-read the Account card drops the plan block until a read succeeds.
- **Post-final:** the same silent wait exists behind `ready` — stored session, no stored entitlement at all (no account read ever succeeded after login), relaunch over an hour later on a dead network: dead button ~25–30 s, then the login sheet. Small follow-up: treat the session as settled after 8 s.
- **Post-final:** "Check again" rarely reaches the server on a dead network because auth-js caches a refresh failure for 60 s and its 30 s ticker keeps re-arming it; README says so.
- **Post-final:** stale guard comment at PlayerProvider.tsx:103-105; "Check again" during an in-flight read discards it and starts another (up to 15 s); README.md:59 unwrapped line; README "waits at most 8 seconds" is untrue in the `ready` case.

## Decisions that are the owner's to make

- A customer whose `customers.status` is `suspended` can still play; entitlement looks at the subscription's status only.
- Acceptance of the terms is not recorded on the server (the website's form has the same gap).
- The emails print the code below the link; the design spec said above.
- The home screen's "Hit play — 7 days free" predates this work; signup says 14 days.
- EAS builds need the three `EXPO_PUBLIC_*` values set in EAS, because `mobile/.env` is git-ignored.
- Supabase's built-in SMTP allows about 2 emails per hour for the whole project.
- The fields the app may send are pinned to the fields `buildSignup` reads by a test in `test/app-signup.test.ts`; if the website starts requiring a new field, that test fails and the app's form needs it too.
