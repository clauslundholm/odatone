# Live copy editing on the deployed site

**Date:** 2026-09-08
**Status:** Approved design, not yet implemented

## Problem

The site body is `contentEditable`, so text can be typed over in the browser.
Locally that works: `EditCapture` posts the change to `/api/edits`, which
rewrites the matching string literal in `lib/content/*.ts`, and a reload shows
the new wording because it is now the source.

On `odatone.studio74.io` nothing is saved and a reload restores the original.
Two reasons:

1. `EditCapture` and `/api/edits` are gated to `NODE_ENV === "development"`.
2. The save writes to `lib/content/*.ts` on disk. Vercel's filesystem is
   read-only and discarded between requests, so the mechanism could not work
   there even ungated.

Worse, the deployed page still *looks* editable, which invites edits that are
silently thrown away.

## Goals

- Edit marketing copy on the deployed site and have it stay changed, for every
  visitor, without a deploy.
- Editing is gated. A visitor without the password sees a normal, uneditable
  page.
- Local development keeps writing to source files, so copy changes made while
  developing still arrive as reviewable git diffs.

## Non-goals

- Per-user accounts or an edit audit trail per person. One shared password.
- A draft/preview step. Edits go live when the caret leaves the element.
- Editing player UI strings (`components/player/*` — the dock, queue, mood
  grid and filters), or SEO titles and descriptions in `lib/content/meta.ts`.
  Those stay source-only for now. The prose on the player *page*
  (`components/pages/PlayerPage.tsx`) is in scope like any other page.
- Rich text. Text content only: no formatting, links, or structure.

## Architecture

### Storage: Upstash Redis (Vercel Marketplace)

One hash holds every override:

```
HSET copy:overrides "<locale>:<original text>" "<new text>"
```

Keyed by the original string because that is all the editor can know from the
DOM. A capped list keeps the previous value so an edit can be undone:

```
LPUSH copy:history {ts, locale, from, to}   # LTRIM to 200
```

Reads happen when a page is regenerated, not per visitor, so read latency is
not on the critical path. Edge Config reads faster but writes go through the
Vercel API with propagation delay and tight size limits; Redis's cheap writes
matter more here.

Provisioned with `vercel integration add upstash`. The repo is not linked
(`.vercel/` absent) and linking requires the account owner, so `vercel link`
is a manual step before implementation starts.

### Reading: an accessor plus a client provider

`lib/content/*.ts` is unchanged and remains the defaults — still where new copy
is written. On top of it:

- `lib/copy.ts` — `getOverrides(locale)` reads the hash and returns a
  `Record<string, string>`. Called during static generation.
- `lib/copy.ts` — `applyCopy(obj, overrides)` walks a content object and
  returns a structurally identical copy with every string replaced by its
  override when one exists.
- `components/CopyProvider.tsx` — a client context seeded once in the layout
  with the locale's override map. 15 of the 27 content consumers are client
  components (header, footer, the marketing widgets), so they read through
  `useCopy(defaults)` rather than importing content directly.

Pages stay statically generated. After a save the route calls
`revalidatePath("/", "layout")`, which rebuilds all 25 pages — cheap at this
size and simpler than tracking which string appears where.

### Writing: the save route

`POST /api/edits` keeps its shape (`{ path, edits }`) and branches on
environment:

- **Development** — current behaviour, unchanged: rewrite the string literal
  in `lib/content/*.ts`, park unplaceable edits in `content-edits.json`.
- **Production** — require a valid edit cookie, write to Redis, push the
  previous value onto the history list, then `revalidatePath`.

### Mounting the editor

`EditCapture` is currently mounted only when `NODE_ENV === "development"`. It
becomes: mounted in development, or in production when the request carries a
valid edit cookie. The layout reads the cookie once and passes a single
`editable` boolean to both the `<body>` attributes and the component, so the
page cannot end up editable with nothing listening, or listening while
uneditable.

### Unlocking

`/<locale>?edit` renders a small password form — a client component shown only
when the query flag is present and the cookie is absent. It posts to
`/api/edit-session` and reloads on success. No visible affordance otherwise:
without the query flag the site gives no sign that editing exists.

### Access control

- `EDIT_PASSWORD` is set in Vercel project env.
- `POST /api/edit-session` compares against it and, on success, sets a signed
  httpOnly `odatone_edit` cookie for 30 days. Rate-limited to 5 attempts per
  IP per 10 minutes to make guessing impractical.
- The layout renders `contentEditable` only when that cookie is valid, so the
  deployed page is inert for everyone else. This also fixes today's
  misleading behaviour.
- `/api/edits` rejects any production write without the cookie.

### Telling the two modes apart

When editing is active, a small fixed badge names the destination — "editing
source" locally, "editing live site" in production — so it is never ambiguous
whether a change is heading for a git diff or for every visitor.

### Data flow

```
edit on the deployed site (cookie present)
  EditCapture: caret leaves element  →  POST /api/edits
    verify cookie
    HSET copy:overrides "<locale>:<original>" "<new>"
    LPUSH copy:history
    revalidatePath("/", "layout")
  next request → page regenerates → getOverrides → applyCopy → new text
```

## Decisions worth stating

**An override applies to every occurrence of that string in that locale.**
Editing a button label that appears on four pages changes all four. This is
predictable and matches how the string key works, but it differs from the dev
mode, which refuses ambiguous strings rather than guessing. Keying by content
path instead would allow per-instance overrides; it needs the renderer to stamp
identity onto the DOM and is deliberately left for later.

**Live copy drifts from `lib/content/*.ts`.** After the first production edit,
source files no longer say what the site says. That is inherent to any store
backed CMS and is the main long-term cost of this design. Mitigation: an
`/api/edits/export` endpoint returning the current overrides as a patch to
paste back into source, run whenever the drift gets uncomfortable.

## Error handling

- Redis unreachable on read → serve the defaults from `lib/content/*.ts`. The
  site never fails because the override store is down.
- Redis unreachable on write → return 503, and `EditCapture` keeps the edit
  pending so the next flush retries it.
- Missing `EDIT_PASSWORD` in production → `/api/edit-session` returns 500 and
  editing stays off. It never falls open.
- Invalid or expired cookie → the page renders uneditable and writes 401.

## Testing

No test framework is installed. Verification is by script, extending the CDP
harness already used to diagnose this bug (headless Chrome over the DevTools
protocol, no new dependencies):

1. `applyCopy` unit checks via `node --test`: nested objects, arrays, strings
   with newlines, absent overrides.
2. Against `next dev`: editing still rewrites `lib/content/*.ts` and does not
   touch Redis.
3. Against `next build && next start` with Redis pointed at a scratch database:
   without the cookie the body is not editable and `/api/edits` returns 401;
   with the cookie an edit is written, the page regenerates, and a fresh
   request contains the new text.
4. Redis credentials removed → pages still render the defaults.

## Risks

- **Public site, one password.** A leaked password means anyone can rewrite the
  copy. History plus `revalidatePath` makes recovery quick, but the blast
  radius is the whole site.
- **`revalidatePath("/", "layout")` on every save** rebuilds all 25 pages. Fine
  at this size; revisit if the site grows or edits become frequent.
- **Scope creep into a CMS.** Structure, images and ordering are not editable
  and should not be bolted on here.

## Rollout

1. `vercel link`, then `vercel integration add upstash` (account owner).
2. Set `EDIT_PASSWORD` in Vercel project env.
3. Implement, verify per the plan above, deploy.
4. First production edit is a throwaway string, checked and reverted through
   the history list before real copy is touched.
