import Wordmark from "@/components/ui/Wordmark";
import { LocaleSwitch } from "@/components/portal/LocaleSwitch";
import { getPortalLocale } from "@/lib/portal-locale";
import LoginForm from "./LoginForm";

/**
 * The one door into /my-odatone — mirrors app/admin/login/page.tsx's own
 * plain centred card (no AppShell here either: that's for screens behind
 * the gate, not the gate itself), but bilingual, and doubling as the
 * landing page for Task 13's invite link
 * (`redirectTo: /my-odatone/login`) — see LoginForm.tsx for how it tells
 * the two visits apart.
 *
 * Customers are invited, not self-registered from here: like the admin
 * login, there is no sign-up link on this page — that lives at
 * /[locale]/kom-i-gang.
 */
export default async function PortalLoginPage() {
  const locale = await getPortalLocale();

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        backgroundImage: "radial-gradient(var(--c-line-strong) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-4">
        <LocaleSwitch locale={locale} className="justify-center" />
        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
          <div className="mb-6 flex justify-center">
            <Wordmark height={22} />
          </div>

          {/* The heading below the wordmark depends on how the visitor
              arrived (ordinary sign-in vs. an invite/recovery link vs. an
              expired one) — a decision LoginForm.tsx can only make
              client-side, from the URL fragment. It owns its own heading
              for exactly that reason; a static one here would be wrong for
              two of its three modes. */}
          <LoginForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
