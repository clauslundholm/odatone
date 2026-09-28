import type { L10n } from "@/lib/i18n";

/** All bilingual copy for /my-odatone (the customer portal's front door —
    Task 14). Kept in one file, matching lib/content/signup.ts's own
    convention, rather than scattered across the pages that read it. */
export const portal = {
  meta: {
    title: { da: "Mit Odatone", en: "My Odatone" } as L10n,
    description: {
      da: "Kundeportal for Odatone.",
      en: "Customer portal for Odatone.",
    } as L10n,
  },

  login: {
    heading: { da: "Log ind", en: "Sign in" } as L10n,
    subtitle: { da: "Mit Odatone", en: "My Odatone" } as L10n,
    emailLabel: { da: "E-mail", en: "Email" } as L10n,
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
       redirectTo: /my-odatone/login) rather than typing a URL directly. */
    setPassword: {
      heading: { da: "Vælg en adgangskode", en: "Choose a password" } as L10n,
      body: {
        da: "Du er blevet inviteret til Odatone. Vælg en adgangskode for at komme i gang.",
        en: "You've been invited to Odatone. Choose a password to get started.",
      } as L10n,
      passwordLabel: { da: "Ny adgangskode", en: "New password" } as L10n,
      submit: { da: "Gem og fortsæt", en: "Save and continue" } as L10n,
      submitPending: { da: "Gemmer…", en: "Saving…" } as L10n,
      tooShort: {
        da: "Adgangskoden skal være mindst 8 tegn.",
        en: "The password must be at least 8 characters.",
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
  shell: {
    /* AppShell/SideNav/TopBar/UserCard are shared with /admin (English
       only), which is why each of these has an English default at the
       component level — /my-odatone is their first consumer outside
       /admin, and without these a customer's screen reader would
       announce their own portal's nav as "Admin" in English on a
       lang="da-DK" page. */
    ariaNav: { da: "Mit Odatone", en: "My Odatone" } as L10n,
    ariaOpenMenu: { da: "Åbn menu", en: "Open menu" } as L10n,
    ariaMenu: { da: "Menu", en: "Menu" } as L10n,
    ariaBreadcrumb: { da: "Brødkrumme", en: "Breadcrumb" } as L10n,
    signOut: { da: "Log ud", en: "Sign out" } as L10n,
    /** PortalShell's own account-card fallback, for a profile with
        neither a saved full name nor a claimed email — the same
        defensive fallback components/admin/AdminSideNav.tsx hard-codes
        as "Signed in", just localised. Should not be reachable in
        practice: every portal login has an email. */
    signedIn: { da: "Logget ind", en: "Signed in" } as L10n,

    ariaUserMenu: { da: "Kontomenu", en: "Account menu" } as L10n,
    /* The customer-facing halves of the `user_role` enum (0001_core.sql)
       — a customer only ever sees 'owner' or 'manager', never the two
       staff roles. Shared by every page's WorkspaceCard subtitle, so it
       lives here rather than under any one page. */
    roleOwner: { da: "Ejer", en: "Owner" } as L10n,
    roleManager: { da: "Administrator", en: "Manager" } as L10n,
    languageGroup: { da: "Sprog", en: "Language" } as L10n,
    themeGroup: { da: "Tema", en: "Theme" } as L10n,
    themeLight: { da: "Lyst", en: "Light" } as L10n,
    themeSystem: { da: "System", en: "System" } as L10n,
    themeDark: { da: "Mørkt", en: "Dark" } as L10n,
  },

  summary: {
    /* Doubles as this page's sidebar nav label (PortalShell builds the
       nav list from both pages' own crumb, rather than a third, separate
       "nav label" string) and as its TopBar breadcrumb. */
    crumb: { da: "Oversigt", en: "Summary" } as L10n,
    greeting: { da: "Velkommen,", en: "Welcome," } as L10n,

    companyPanel: { da: "Virksomhed", en: "Company" } as L10n,
    companyLabel: { da: "Firma", en: "Company" } as L10n,
    statusLabel: { da: "Status", en: "Status" } as L10n,
    customerSinceLabel: { da: "Kunde siden", en: "Customer since" } as L10n,

    planPanel: { da: "Abonnement", en: "Subscription" } as L10n,
    planLabel: { da: "Plan", en: "Plan" } as L10n,
    billingLabel: { da: "Fakturering", en: "Billing" } as L10n,
    billingMonthly: { da: "Månedlig", en: "Monthly" } as L10n,
    billingAnnual: { da: "Årlig", en: "Annual" } as L10n,
    priceLabel: { da: "Pris pr. måned, ekskl. moms", en: "Price per month, ex. VAT" } as L10n,
    includesLabel: { da: "Inkluderer", en: "Includes" } as L10n,
    noSubscription: { da: "Intet abonnement endnu.", en: "No subscription yet." } as L10n,

    locationsPanel: { da: "Lokationer", en: "Locations" } as L10n,
    locationName: { da: "Navn", en: "Name" } as L10n,
    locationType: { da: "Type", en: "Type" } as L10n,
    locationCity: { da: "By", en: "City" } as L10n,
    locationFit: { da: "Areal", en: "Fit" } as L10n,
    locationOver: { da: "Over grænsen", en: "Over limit" } as L10n,
    /* Meter's own defaults ("no limit" / "no limit on this plan") are
       English, since /admin (its only other caller until this task) never
       localises. A customer on the unbounded Main Stage plan, or with no
       subscription at all (locationFit's maxM2 is then also null), must
       not see that hard-coded English word on a lang="da-DK" page. */
    meterNoLimitCaption: { da: "ingen grænse", en: "no limit" } as L10n,
    meterNoLimitAria: { da: "ingen grænse på denne plan", en: "no limit on this plan" } as L10n,
    noLocationsTitle: { da: "Ingen lokationer endnu", en: "No locations yet" } as L10n,
    noLocationsBody: {
      da: "Lokationer, du tilføjer, vises her sammen med deres forbrug.",
      en: "Locations you add will show up here, alongside their usage.",
    } as L10n,

    /* Billing shipped in Task 10 — this must not go on claiming it's still
       coming, right next to a sidebar link that now works. */
    comingSoon: {
      da: "Indstillinger og statistik er på vej.",
      en: "Settings and statistics are coming.",
    } as L10n,
  },

  /** Task 10: the customer's own invoices, and the subscription they
      belong to. This page's second RLS-scoped reader — after `summary` —
      of `subscriptions` and `plans`, so its money/date labels are kept
      separate from `summary`'s own rather than shared, even where the
      wording is close: a future edit to one panel's copy (say, summary's
      plan panel) should not have to remember it also owns half of this
      page's strings. */
  billing: {
    /* Doubles as the sidebar nav label and this page's own breadcrumb,
       the same dual role `summary.crumb` plays above. */
    crumb: { da: "Fakturering", en: "Billing" } as L10n,

    subscriptionPanel: { da: "Abonnement", en: "Subscription" } as L10n,
    planLabel: { da: "Plan", en: "Plan" } as L10n,
    termLabel: { da: "Aftaleperiode", en: "Term" } as L10n,
    termMonthly: { da: "Månedlig", en: "Monthly" } as L10n,
    termAnnual: { da: "Årlig", en: "Annual" } as L10n,
    /* Unlike summary.priceLabel (always the monthly-equivalent rate, for
       comparing plans), this is what the subscription's *next invoice*
       actually charges — lib/pricing.ts's quote().chargeExVat, which is
       the yearly sum on an annual term, not a monthly figure divided
       twelve ways. */
    priceLabel: { da: "Pris pr. periode, ekskl. moms", en: "Price per period, ex. VAT" } as L10n,
    renewalLabel: { da: "Fornyes", en: "Renews" } as L10n,
    noSubscription: { da: "Intet abonnement endnu.", en: "No subscription yet." } as L10n,

    invoicesPanel: { da: "Fakturaer", en: "Invoices" } as L10n,
    numberHeader: { da: "Nummer", en: "Number" } as L10n,
    periodHeader: { da: "Periode", en: "Period" } as L10n,
    dueHeader: { da: "Forfald", en: "Due" } as L10n,
    totalHeader: { da: "Total", en: "Total" } as L10n,
    statusHeader: { da: "Status", en: "Status" } as L10n,
    /* "Download" is an ordinary Danish loanword in this register (as
       common as "e-mail" or "login"), and "PDF" has no Danish form at
       all — this is not the English-only text the bilingual rule exists
       to catch. */
    downloadPdf: { da: "Download PDF", en: "Download PDF" } as L10n,

    noInvoicesTitle: { da: "Ingen fakturaer endnu", en: "No invoices yet" } as L10n,
    noInvoicesBody: {
      da: "Fakturaer, der udstedes til dig, vises her.",
      en: "Invoices issued to you will show up here.",
    } as L10n,
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

/** The WorkspaceCard subtitle for a customer profile's role — shared by
    every /my-odatone page that resolves its own `profiles.role` (summary,
    billing), so the mapping from the `user_role` enum's two customer-side
    values to portal.shell's localised labels exists exactly once. An
    unrecognised role is a bug, not a customer (proxy.ts's mayEnter already
    filters to a customer role before either page runs) — shown as
    `undefined` rather than guessed at, the same as each page did inline
    before this was extracted. */
export function portalRoleLabel(role: string | null | undefined, locale: "da" | "en"): string | undefined {
  if (role === "owner") return portal.shell.roleOwner[locale];
  if (role === "manager") return portal.shell.roleManager[locale];
  return undefined;
}

export function localizeStatus(
  map: Record<string, L10n>,
  status: string,
  locale: "da" | "en",
): string {
  return map[status]?.[locale] ?? status;
}
