import Wordmark from "@/components/ui/Wordmark";
import { LocaleSwitch } from "@/components/portal/LocaleSwitch";
import { getPortalLocale } from "@/lib/portal-locale";
import { portal } from "@/lib/content/portal";
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
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Wordmark height={22} />
            <div>
              <h1 className="u-title text-[1.25rem] text-ink">{portal.login.heading[locale]}</h1>
              <p className="mt-1 text-[0.875rem] text-ink-2">{portal.login.subtitle[locale]}</p>
            </div>
          </div>

          <LoginForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
