# v4 web replacement — implementation plan

Replace the public site with the "17 Web — v4 (produkt først)" design from
Figma (`eGYnPRF7Wo6D3GY1GB8Dh6`, page `235:1583`).

**Decisions taken 2026-10-26, which this plan executes:**

1. **v4 governs the signup**, even where it contradicts what shipped: 8-day
   trial, no card at signup, password set inline, CVR off step 1, presented
   as a modal over the landing page.
2. **Full replacement** of the public site. The nine content pages and the
   marketing components go.

Both reverse decisions made earlier this month. That is deliberate; this
document records what each reversal costs so nothing is discovered late.

---

## Consequences being accepted

| Change | What it undoes | Handling |
|---|---|---|
| Trial 14 → 8 days | 37 occurrences, incl. `lib/content/legal.ts` — a **contractual term in the terms document** | Centralise on `PROOF.trialDays`; legal copy reviewed by a human before deploy |
| No card at signup | Two weeks ago the card was made required and six "intet betalingskort" promises were rewritten to "ingen binding" | Revert those six — the original promise becomes true again, so this one is a net gain |
| CVR off signup | CVR was made required **because invoices need it** (`lib/invoice-issuer.ts` prints it) | Move to the payment step, not delete. `issue_invoice` refuses without one |
| Password set inline | Removes the customer invite flow (`use-invite-fragment.ts`, GoTrue invite) | **Staff invites must keep working** — `lib/staff-invite.ts` and `/admin/users` are a separate path and stay |
| Full replacement | Deletes the savings calculator, price comparison, pricing table, FAQ and `/priser` | `/priser` is likely the SEO entry point. Redirects required, not just deletion |

**Open, not yet decided:** the mobile app creates accounts through
`POST /api/app/signup` with a 6-digit email code. If web signup sets a
password inline, there are two account-creation paths with different rules.
Resolve before slice 2 ships.

**Hard dependency:** the v4 Forside is ~80% catalogue UI, and
`TRACKS_ARE_PLACEHOLDER = true` — 24 synthesised files. The real catalogue is
1000trax, which has no API (`docs/1000trax-api-requirements.md`). Slices 4+
can be built against placeholders but cannot launch without it.

---

## Slices

Each ends green: `npm test`, `npm run test:db`, `tsc`, `next build`, and
driven in a browser.

### 1. Trial length — 8 days, centralised
`PROOF.trialDays` is used twice; 35 other places hardcode "14 dage"/"14 days".
Route every one through the constant so it can never drift again, then set it
to 8. Includes `legal.ts`, flagged for human review.

### 2. Signup rules
- `buildSignup`: drop CVR, drop card fields, add password.
- Password at signup replaces the customer invite; keep `inviteCreatedNewUser`
  and the dedupe logic, which are about duplicate accounts, not invites.
- Staff invites untouched.
- CVR moves to the payment step; `issue_invoice` already refuses without the
  data it needs — verify it refuses on a null CVR too.
- Tests: the CVR rule moves rather than disappears.

### 3. Signup UI — modal, three steps
Profil · Betaling · Spil i butikken, over the landing page. Replaces
`components/signup/SignupFlow.tsx`'s one-page form. `/kom-i-gang` keeps
working as a deep link that opens the modal.

### 4. The landing page
Sidebar shell, search, mood tiles, curated lists, artists row, genre grid,
player dock. Reuses `LibraryBrowser`, `FilterRail`, `Queue`, `MoodGrid`,
`PlayerDock`, which already exist. New: list building ("Byg din liste"),
catalogue search.

### 5. Retire the old site
Delete `components/pages/*` (8 files) and `components/marketing/*` (6), and
the `[locale]/[page]` route. **Add redirects** from `/priser`, `/besparelse`,
`/afspiller`, `/artister`, `/om-odatone`, `/kontakt` and both legal paths —
deleting them outright drops whatever ranks today. Update the sitemap.

### 6. Dark mode on the public site
v4 ships light and dark. `globals.css` already defines both; the public pages
have never used the dark set.

### 7. Mobile
v4 has 402-wide frames for light and dark.

### 8. Auth and portal to v4
`Log ind`, `Nulstil adgangskode`, `Vælg adgangskode`, and the three
`Mit Odatone` screens — all already designed in Figma (light and dark).

---

## Order and risk

1 is mechanical. 2 is the risky one — it changes how accounts are created, and
it is the slice that can lock people out. 5 is irreversible in the sense that
deleted pages lose their search ranking whether or not the code comes back, so
the redirects ship in the same commit as the deletions.

Do not start 4 before the 1000trax API question has an answer, or the landing
page will be designed around a catalogue shape that then changes.
