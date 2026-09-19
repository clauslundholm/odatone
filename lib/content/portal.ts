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
  },

  summary: {
    crumb: { da: "Oversigt", en: "Summary" } as L10n,
    greeting: { da: "Velkommen,", en: "Welcome," } as L10n,
    signOut: { da: "Log ud", en: "Sign out" } as L10n,

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
    noLocationsTitle: { da: "Ingen lokationer endnu", en: "No locations yet" } as L10n,
    noLocationsBody: {
      da: "Lokationer, du tilføjer, vises her sammen med deres forbrug.",
      en: "Locations you add will show up here, alongside their usage.",
    } as L10n,

    comingSoon: {
      da: "Fakturering, indstillinger og statistik er på vej.",
      en: "Billing, settings and statistics are coming.",
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

export function localizeStatus(
  map: Record<string, L10n>,
  status: string,
  locale: "da" | "en",
): string {
  return map[status]?.[locale] ?? status;
}
