import Wordmark from "@/components/ui/Wordmark";
import ResetForm from "@/app/my-odatone/nulstil/ResetForm";

/* /admin is English-only (lib/content has no Danish for the backend), so
   the locale is fixed rather than read from a cookie the way the customer
   portal does it.

   Public, and lib/tenancy.ts's RESET_PATH says so — without that entry the
   proxy would bounce a signed-out staff member to the sign-in form they
   came here precisely because they cannot use. */
export default function AdminResetPasswordPage() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center p-6"
      style={{
        backgroundImage: "radial-gradient(var(--c-line-strong) 1px, transparent 0)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-line bg-surface p-8 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex justify-center">
          <Wordmark height={22} />
        </div>
        <ResetForm locale="en" portalName="admin" />
      </div>
    </div>
  );
}
