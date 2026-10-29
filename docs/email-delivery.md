# Email delivery

Every email Odatone sends is a Supabase Auth email. The application sends
none of its own — there is no mail library in `package.json` and nothing
imports one — so this document is about one thing: getting GoTrue's six
messages out through Resend instead of Supabase's built-in sender, wearing
the templates in `supabase/templates/`.

Supabase's own sender exists for development. It rate-limits to a couple
of messages an hour and sends from a Supabase address, neither of which
survives contact with a paying customer: a café that signs up during a
busy morning and does not get its invite has no way in, and no way to tell
whether the email is coming.

## What is already done

**The templates.** Six files in `supabase/templates/`, Danish first with an
English half below, the gradient wordmark, the brand palette hand-copied
out of `app/globals.css`, table-based with inline styles so Outlook — which
renders through Word, not a browser — gets the same thing everyone else
does. The invite also carries `{{ .Token }}`, because the mobile app cannot
follow a web link and takes the six-digit code instead.

**The domain.** `odatone.com` is a verified Resend sending domain. Checked
in DNS on 2026-10-29:

| Record | Value |
|---|---|
| `resend._domainkey.odatone.com` TXT | DKIM public key |
| `send.odatone.com` CNAME | `send.forge.rmta.net` |
| `send.odatone.com` TXT | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` |
| `send.odatone.com` MX | `feedback.forge.rmta.net` |
| `_dmarc.odatone.com` TXT | `v=DMARC1; p=none; adkim=r; aspf=r` |

The apex SPF is `include:_spf.google.com`, for Google Workspace receiving.
It is not involved in sending and does not need amending: Resend signs with
DKIM and returns bounces through the `send.` subdomain, which carries its
own SPF. DMARC passes on the DKIM half with relaxed alignment.

## What is left

One form, in the hosted dashboard. **Authentication → Emails → SMTP
Settings**, enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | a Resend API key with **Sending access** |
| Sender email | `info@odatone.com` |
| Sender name | `Odatone` |

Port 587 is STARTTLS. 465 works too if something in the path objects to
STARTTLS; 2587 and 2465 are Resend's alternates for hosts that block the
usual ports.

The sender address must be on the verified domain. `info@odatone.com`
matches `SITE.email` in `lib/site.ts`, which is the address the signup
screen tells people to look for in their spam filter — if the sender here
changes, that copy changes with it.

Then paste each file under **Authentication → Emails → Templates**. The
subject lines are in `supabase/config.toml` beside each `content_path`,
and they are bilingual in the same way the bodies are.

## While you are in that dashboard

**Authentication → URL Configuration → Redirect URLs** needs these, or the
links inside these emails go to the wrong place:

```
https://<domain>/my-odatone
https://<domain>/admin
```

The allowlist is exact, and a `redirectTo` that is not on it is not
refused — it is silently replaced with the Site URL. An invited customer
then lands on the front page with their token still in the fragment and no
password form anywhere. This is the same correction made to
`supabase/config.toml` for local; the hosted project keeps its own copy.

## Why local stays on Mailpit

`[auth.email.smtp]` in `supabase/config.toml` is deliberately left
commented. It configures the local stack, and local should keep delivering
to Mailpit at <http://127.0.0.1:54324>.

Switch it on and every test signup sends a real message to whatever
address the test invented. Those addresses — `tredje@example.dk` and
friends — hard-bounce, and a hard bounce is charged against the domain's
reputation. Resend suppresses the address afterwards, which is the right
behaviour and no help at all when the address was fiction.

If you ever do need a real send from a local run, put a key in
`RESEND_API_KEY`, uncomment the block, and send only to Resend's own test
addresses: `delivered@resend.dev`, `bounced@resend.dev`,
`complained@resend.dev`.

## Checking it works

After the dashboard is saved, trigger one of each through the product
rather than the dashboard's test button — the test button proves SMTP, not
the template:

1. **Invite** — sign up at `/da/kom-i-gang` with a real address you can
   read. The signup no longer asks for a password, so this is the one
   every customer gets.
2. **Recovery** — "Glemt din adgangskode?" on `/my-odatone`.

Then **Resend → Emails** shows each one with its delivery status, and the
rendered HTML as the recipient received it. That view is also where a
bounce or a spam complaint will show up, which is the thing Supabase's
built-in sender could never tell you.

## If more than auth email is ever sent

An invoice by email, a receipt, a "your week changed" notice — none of
which exist today — should go through the Resend SDK from a server action
or route handler, not through this SMTP connection, which belongs to
GoTrue. That means `npm install resend`, the same `RESEND_API_KEY`, and an
idempotency key per send so a retry cannot post the same invoice twice.
