import { AuthCard } from "@/components/portal/AuthCard";
import { getPortalLocale } from "@/lib/portal-locale";
import ResetForm from "./ResetForm";

/* Public, and lib/tenancy.ts's isPublicPath has to agree — the person who
   needs this page is by definition the one who cannot sign in, so a gate
   here would be a door locked from the inside. RESET_PATH is where that
   is declared; the proxy and this route must not drift apart. */
export default async function ResetPasswordPage() {
  const locale = await getPortalLocale();
  return (
    <AuthCard locale={locale}>
      <ResetForm locale={locale} />
    </AuthCard>
  );
}
