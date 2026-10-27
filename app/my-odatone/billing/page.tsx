import { redirect } from "next/navigation";

import { getPortalLocale } from "@/lib/portal-locale";
import { accountHref } from "@/lib/v4/account";

/**
 * Kept as a redirect, not deleted: invoices are linked to from emails and
 * from the signup flow's last step, and a URL that has been sent out is a
 * URL that has to keep working. The page itself is now the Fakturering
 * tab of the account inside the product shell.
 *
 * Reachable only with a session — proxy.ts gates everything under
 * /my-odatone below the root — so there is no signed-out branch here.
 */
export default async function PortalBillingRedirect() {
  redirect(accountHref(await getPortalLocale(), "billing"));
}
