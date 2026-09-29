import { redirect } from "next/navigation";

/**
 * Sign-in moved to /my-odatone itself, so this route only forwards. See
 * app/admin/login/page.tsx for why it is kept rather than deleted: invite
 * links already sent point here, and the token rides in the URL fragment,
 * which survives a redirect to a target that has none.
 */
export default function LegacyPortalLoginPage() {
  redirect("/my-odatone");
}
