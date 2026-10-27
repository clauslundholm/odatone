import type { L10n } from "@/lib/i18n";

/** All bilingual copy for /my-odatone (the customer portal's front door —
    Task 14). Kept in one file, matching lib/content/signup.ts's own
    convention, rather than scattered across the pages that read it. */
/* The copy for the screens that are still at /my-odatone: the sign-in
   card, the password-reset card, and the labels the account's own
   settings form shares with them.
   The summary/billing/shell groups that used to sit here went with
   components/portal/PortalShell.tsx when the customer portal moved into
   the product shell — that copy is now lib/content/v4.ts's `account`
   section, written for cards in the player rather than rows in a
   console. The status tables at the foot of this file stay shared: a
   status word does not change with its surroundings. */
export const portal = {
  meta: {
    title: { da: "Mit Odatone", en: "My Odatone" } as L10n,
    description: {
      da: "Kundeportal for Odatone.",
      en: "Customer portal for Odatone.",
    } as L10n,
  },

  reset: {
    heading: { da: "Nulstil adgangskode", en: "Reset password" } as L10n,
    subtitle: { da: "Mit Odatone", en: "My Odatone" } as L10n,
    lede: {
      da: "Skriv din e-mail, så sender vi et link til at vælge en ny.",
      en: "Enter your email and we will send a link to choose a new one.",
    } as L10n,
    submit: { da: "Send link", en: "Send link" } as L10n,
    submitPending: { da: "Sender…", en: "Sending…" } as L10n,
    back: { da: "Tilbage til log ind", en: "Back to sign in" } as L10n,
    forgot: { da: "Glemt din adgangskode?", en: "Forgot your password?" } as L10n,
    /* Said up front, not only in the confirmation: somebody who asks for
       a link and then waits is the person who needs to know it is going
       to go stale. The same two facts the `sent` message repeats. */
    linkNote: {
      da: "Linket gælder i én time og kan kun bruges én gang.",
      en: "The link is valid for one hour and can only be used once.",
    } as L10n,
    /* Said whether or not the address has an account, and worded so that
       it stays true either way. Confirming that an email IS registered is
       the enumeration hole login/actions.ts already closes by refusing to
       distinguish a wrong password from an unknown address; a reset page
       that answers "no such user" would reopen it on an unauthenticated
       endpoint anyone can poll. */
    sent: {
      da: "Hvis der findes en konto med {email}, er linket på vej. Linket gælder i én time. Kig også i spam.",
      en: "If an account exists for {email}, the link is on its way. It is valid for one hour. Check your spam folder too.",
    } as L10n,
    errors: {
      email: { da: "Ugyldig e-mail", en: "Invalid email" } as L10n,
      service: {
        da: "Der opstod en fejl. Prøv igen om lidt.",
        en: "Something went wrong. Please try again in a moment.",
      } as L10n,
    } as Record<string, L10n>,
  },

  login: {
    heading: { da: "Log ind", en: "Sign in" } as L10n,
    subtitle: { da: "Mit Odatone", en: "My Odatone" } as L10n,
    lede: {
      da: "Til din Odatone-konto. Musikken kører videre imens.",
      en: "To your Odatone account. The music keeps playing meanwhile.",
    } as L10n,
    /* "Arbejds-e-mail", not "E-mail": every account here belongs to a
       business, and the address people reach for first is their private
       one. Naming it is cheaper than a failed sign-in. */
    emailLabel: { da: "Arbejds-e-mail", en: "Work email" } as L10n,
    emailPlaceholder: { da: "navn@virksomhed.dk", en: "name@company.com" } as L10n,
    /* The way back out for somebody who has no account yet and landed
       here from a link. "{n}" is PROOF.trialDays, never written out. */
    noAccount: {
      da: "Har du ikke en konto? Prøv {n} dage gratis.",
      en: "No account yet? Try {n} days free.",
    } as L10n,
    passwordLabel: { da: "Adgangskode", en: "Password" } as L10n,
    submit: { da: "Log ind", en: "Sign in" } as L10n,
    submitPending: { da: "Logger ind…", en: "Signing in…" } as L10n,
    loading: { da: "Henter…", en: "Loading…" } as L10n,

    /* "invalid" deliberately covers both a wrong password and an unknown
       address — see actions.ts. Naming that reasoning again here since a
       future translator adding a Swedish string, say, could otherwise
       "helpfully" split it into two more specific messages and reopen the
       enumeration hole this exists to close. */
    errors: {
      invalid: {
        da: "Den e-mail og adgangskode passer ikke sammen.",
        en: "That email and password don't match.",
      } as L10n,
      "no-access": {
        da: "Din konto er ikke sat op til kundeportalen. Kontakt os.",
        en: "Your account isn't set up for the customer portal. Contact us.",
      } as L10n,
      service: {
        da: "Der opstod en fejl. Prøv igen om lidt.",
        en: "Something went wrong on our end. Please try again in a moment.",
      } as L10n,
    } as Record<string, L10n>,

    /* Shown instead of the sign-in form when the visitor arrived via an
       invite or password-reset link (Task 13's inviteUserByEmail,
       redirectTo: /my-odatone) rather than typing a URL directly. */
    setPassword: {
      heading: { da: "Vælg en adgangskode", en: "Choose a password" } as L10n,
      body: {
        da: "Sidste trin. Så er kontoen din.",
        en: "Last step. Then the account is yours.",
      } as L10n,
      passwordLabel: { da: "Ny adgangskode", en: "New password" } as L10n,
      passwordHint: { da: "Mindst 8 tegn", en: "At least 8 characters" } as L10n,
      repeatLabel: { da: "Gentag adgangskode", en: "Repeat password" } as L10n,
      submit: { da: "Opret konto", en: "Create account" } as L10n,
      submitPending: { da: "Gemmer…", en: "Saving…" } as L10n,
      /* Named rather than linked, because this card is served outside the
         localised marketing routes and the two documents live under
         /da and /en. The visitor has already met both in signup. */
      consent: {
        da: "Ved at fortsætte accepterer du handelsbetingelserne og privatlivspolitikken.",
        en: "By continuing you accept the terms of business and the privacy policy.",
      } as L10n,
      tooShort: {
        da: "Adgangskoden skal være mindst 8 tegn.",
        en: "The password must be at least 8 characters.",
      } as L10n,
      mismatch: {
        da: "De to adgangskoder er ikke ens.",
        en: "The two passwords do not match.",
      } as L10n,
      generic: {
        da: "Kunne ikke gemme adgangskoden. Prøv igen.",
        en: "Couldn't save the password. Try again.",
      } as L10n,
    },

    /* GoTrue's /verify redirects here with #error=access_denied&error_code=...
       whenever the link itself is the problem (expired — invites expire in
       24h — or already used, e.g. by a corporate link scanner that follows
       it before the person does). This is the ordinary failure mode of an
       invite link, not an edge case: without this, the visitor lands on a
       plain sign-in form with no password to type and no explanation. */
    expired: {
      heading: { da: "Linket er udløbet", en: "This link has expired" } as L10n,
      body: {
        da: "Dette link er udløbet eller allerede brugt. Kontakt os for at få tilsendt en ny invitation.",
        en: "This link has expired or has already been used. Contact us for a new invitation.",
      } as L10n,
    },
  },

  /** The chrome every /my-odatone page shares, rendered once by
      components/portal/PortalShell.tsx (Task 10 pulled it out of the
      summary page, which used to be the only page and so built it
      inline). Kept as its own block, separate from `summary`, now that a
      second page (`billing`) mounts the same shell and needs these same
      strings without importing a page that isn't itself. */


  /** Task 10: the customer's own invoices, and the subscription they
      belong to. This page's second RLS-scoped reader — after `summary` —
      of `subscriptions` and `plans`, so its money/date labels are kept
      separate from `summary`'s own rather than shared, even where the
      wording is close: a future edit to one panel's copy (say, summary's
      plan panel) should not have to remember it also owns half of this
      page's strings. */

  /** Task 11: the customer's own billing details — `updateBillingDetails`
      (app/my-odatone/settings/actions.ts) writes six of the seven fields
      this page shows. The seventh, the company name, is read-only here on
      purpose: it is what already-issued invoices say, and the RLS policy
      that actually enforces the write (`customers_owner_update`,
      supabase/migrations/0003_tenancy.sql) restricts even the six writable
      columns to the `owner` role — a `manager` sees every field disabled,
      with `managerNotice` explaining why, but that is courtesy dressing
      around the real control: the action refuses the write regardless of
      what the form renders. */
  settings: {
    /* Doubles as the sidebar nav label and this page's own breadcrumb, the
       same dual role `summary.crumb`/`billing.crumb` play above. */
    crumb: { da: "Indstillinger", en: "Settings" } as L10n,

    companyPanel: { da: "Virksomhed", en: "Company" } as L10n,
    companyLabel: { da: "Firma", en: "Company" } as L10n,
    companyNote: {
      da: "Firmanavnet er, hvad allerede udstedte fakturaer viser. Kontakt Odatone for at få det ændret.",
      en: "The company name is what already-issued invoices show. Contact Odatone to have it changed.",
    } as L10n,

    billingPanel: { da: "Faktureringsoplysninger", en: "Billing details" } as L10n,
    /* Shown instead of a save button, and every field below rendered
       disabled, for a `manager` — courtesy only. `updateBillingDetails`
       refuses the write outright (see this block's own doc comment). */
    managerNotice: {
      da: "Kun en ejer kan ændre faktureringsoplysninger. Kontakt virksomhedens ejer for at få dem ændret.",
      en: "Only an owner can change billing details. Contact your company's owner to have them changed.",
    } as L10n,

    billingEmailLabel: { da: "Faktura-e-mail", en: "Billing email" } as L10n,
    cvrLabel: { da: "CVR-nummer", en: "CVR number" } as L10n,
    cvrHint: { da: "8 cifre", en: "8 digits" } as L10n,
    addressLabel: { da: "Adresse", en: "Address" } as L10n,
    postcodeLabel: { da: "Postnummer", en: "Postcode" } as L10n,
    cityLabel: { da: "By", en: "City" } as L10n,
    phoneLabel: { da: "Telefon", en: "Phone" } as L10n,

    submit: { da: "Gem ændringer", en: "Save changes" } as L10n,
    submitPending: { da: "Gemmer…", en: "Saving…" } as L10n,
    saved: { da: "Ændringerne er gemt.", en: "Changes saved." } as L10n,

    /* Keyed by the field-error code updateBillingDetails returns (mirroring
       app/admin/products/actions.ts's updatePlan/`PLAN_ERRORS` shape) — the
       same `long`/`forbidden` codes apply to any of the six fields, so this
       is one shared table rather than one per field. */
    errors: {
      email: {
        da: "Indtast en gyldig e-mailadresse.",
        en: "Enter a valid email address.",
      } as L10n,
      cvr: {
        da: "CVR-nummeret skal være præcis 8 cifre, eller stå tomt.",
        en: "The CVR number must be exactly 8 digits, or left blank.",
      } as L10n,
      long: {
        da: "Det er for langt (maks. 200 tegn).",
        en: "That's too long (200 characters max).",
      } as L10n,
      /* The one actually reachable when a manager submits the form anyway
         (re-enabled fields, or a direct POST) — see this block's own doc
         comment. */
      forbidden: {
        da: "Kun en ejer kan gemme dette. Kontakt virksomhedens ejer.",
        en: "Only an owner can save this. Contact your company's owner.",
      } as L10n,
      save: {
        da: "Der opstod en fejl. Prøv igen om lidt.",
        en: "Something went wrong. Please try again in a moment.",
      } as L10n,
    } as Record<string, L10n>,
  },
};

/** customers.status (customer_status) and subscriptions.status
    (subscription_status) are Postgres enum values — machine words, not
    copy. An unrecognised value (a future enum member this file hasn't
    caught up with yet) falls back to the raw string rather than throwing,
    the same "don't crash the render" doctrine lib/admin/plans.ts's
    resolvePlan applies to an unknown plan id. */
export const CUSTOMER_STATUS_LABEL: Record<string, L10n> = {
  pending: { da: "Afventer", en: "Pending" },
  active: { da: "Aktiv", en: "Active" },
  suspended: { da: "Suspenderet", en: "Suspended" },
  cancelled: { da: "Opsagt", en: "Cancelled" },
};

export const SUBSCRIPTION_STATUS_LABEL: Record<string, L10n> = {
  pending: { da: "Afventer", en: "Pending" },
  trialing: { da: "Prøveperiode", en: "Trialing" },
  active: { da: "Aktiv", en: "Active" },
  past_due: { da: "Forfalden", en: "Past due" },
  cancelled: { da: "Opsagt", en: "Cancelled" },
};

/* invoice_status (0002_commerce.sql) also has 'draft' — never reachable
   here, since a row only exists once issue_invoice has numbered it (see
   app/admin/billing/page.tsx's own comment on the same enum) — and
   'overdue', which is likewise never *stored*: it is computed for display
   from `due_at`, the same reasoning app/admin/billing/page.tsx's own
   displayStatus applies, just re-expressed for the portal's one-customer
   view rather than duplicated by reference across page boundaries. */
export const INVOICE_STATUS_LABEL: Record<string, L10n> = {
  open: { da: "Åben", en: "Open" },
  overdue: { da: "Forfalden", en: "Overdue" },
  paid: { da: "Betalt", en: "Paid" },
  void: { da: "Annulleret", en: "Void" },
};

/** The two customer-side values of the `user_role` enum, in words. Staff
    roles are deliberately absent: this names the person reading their own
    account, and staff never are. */
const ROLE_LABEL: Record<string, L10n> = {
  owner: { da: "Ejer", en: "Owner" },
  manager: { da: "Administrator", en: "Manager" },
};

/** How a customer's own role is named beside their name — on the account's
    Oversigt tab, and anywhere else that resolves `profiles.role`. An
    unrecognised role is a bug, not a customer (proxy.ts's mayEnter already
    filters to a customer role before any of this runs), so it is shown as
    `undefined` rather than guessed at. */
export function portalRoleLabel(role: string | null | undefined, locale: "da" | "en"): string | undefined {
  return role ? ROLE_LABEL[role]?.[locale] : undefined;
}

export function localizeStatus(
  map: Record<string, L10n>,
  status: string,
  locale: "da" | "en",
): string {
  return map[status]?.[locale] ?? status;
}
