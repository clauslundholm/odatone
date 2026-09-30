# Updating the hosted Supabase email templates

`supabase/templates/*.html` only configure the **local** Supabase stack
(`supabase/config.toml`). The hosted project keeps its own copies, and
nothing deploys these files to it. After changing a template here, paste
it into the dashboard by hand.

The mobile app depends on four of them printing `{{ .Token }}`. Until they
do, a customer who signs up in the app never receives the code the app
asks for.

1. Open the Supabase dashboard for the Odatone project.
2. Go to **Authentication → Emails → Templates** (older dashboards:
   Authentication → Email Templates).
3. **Invite user**: replace the message body with the whole of
   `supabase/templates/invite.html`. Leave the subject as it is. Save.
4. **Reset password**: replace the body with the whole of
   `supabase/templates/recovery.html`. Save.
5. **Confirm signup**: replace the body with the whole of
   `supabase/templates/confirmation.html`. Supabase may send this
   instead of the magic-link email when "Resend code" is used before the
   invite is confirmed. Save.
6. **Magic link**: confirm the body already contains `{{ .Token }}`
   (`supabase/templates/magic_link.html` does). The app's "Resend code"
   button sends this email.
7. Under **Authentication → Sign In / Providers → Email**, confirm the
   email OTP length is **6** and the expiry is **3600** seconds, matching
   `otp_length` and `otp_expiry` in `supabase/config.toml`.

To check it worked: sign up in the app with an address you own. The
invite email should show a 6-digit code above the "valid for 24 hours"
line.
