import { redirect } from "next/navigation";

/**
 * Sign-in moved to /admin itself, so this route only forwards.
 *
 * It is kept rather than deleted because invite and recovery links already
 * in people's inboxes point here, and GoTrue delivers its token in the URL
 * *fragment*. A fragment never reaches the server, but the browser carries
 * it across a redirect whose target has none — verified in Chromium before
 * this was written, because if that did not hold every unaccepted invite
 * would die silently at this line.
 */
export default function LegacyAdminLoginPage() {
  redirect("/admin");
}
