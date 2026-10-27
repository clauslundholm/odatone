import { redirect } from "next/navigation";

import { getPortalLocale } from "@/lib/portal-locale";
import { accountHref } from "@/lib/v4/account";

/**
 * Kept as a redirect for the same reason as ./billing: the signup flow's
 * last step links here by name ("det rettes under Indstillinger"), and so
 * does the CVR note on an invoice that could not be issued. The form
 * itself is now the Indstillinger tab of the account inside the product
 * shell, and `updateBillingDetails` moved with it to
 * app/[locale]/_account-actions.ts.
 */
export default async function PortalSettingsRedirect() {
  redirect(accountHref(await getPortalLocale(), "settings"));
}
