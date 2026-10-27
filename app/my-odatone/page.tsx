import { redirect } from "next/navigation";

import { AuthCard } from "@/components/portal/AuthCard";
import LoginForm from "./login/LoginForm";
import { getPortalLocale } from "@/lib/portal-locale";
import { createClient } from "@/lib/supabase/server";
import { accountHref } from "@/lib/v4/account";

/**
 * The customer portal's front door, and now only that.
 *
 * Signed out this is the sign-in form, exactly as before — proxy.ts
 * serves this route without a session on purpose, and every invite,
 * recovery and "Mit Odatone" link already in people's inboxes and in the
 * signup flow points here.
 *
 * Signed in it forwards to the account inside the product shell
 * (/da/konto). The summary, billing and settings screens that used to
 * live under this prefix are gone: they were a second application in the
 * same colours, with their own sidebar, their own breadcrumbs and their
 * own copy of every panel. The account is four tabs of the product now,
 * under the same search bar and above the same player, which is what the
 * design asks for and what keeps the two from drifting apart again.
 *
 * The redirect stays rather than the pages moving wholesale, because the
 * link in a Task 13 invite email cannot be edited after it is sent.
 */
export default async function PortalEntryPage() {
  const locale = await getPortalLocale();
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();

  if (typeof claims?.claims?.sub === "string") redirect(accountHref(locale));

  return (
    <AuthCard locale={locale}>
      {/* LoginForm owns its own heading: which of its four modes it is
          in depends on the URL fragment, which only the browser sees. */}
      <LoginForm locale={locale} />
    </AuthCard>
  );
}
