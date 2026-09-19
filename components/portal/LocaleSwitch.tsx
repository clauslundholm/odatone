import { LOCALES, LOCALE_SHORT, type Locale } from "@/lib/i18n";
import { setPortalLocale } from "@/app/my-odatone/portal-actions";

/**
 * DA / EN toggle for the customer portal. Unlike the marketing site's
 * language switcher (a plain Link swapping /da for /en, since each page
 * lives at both URLs), /my-odatone has no locale in its URL at all —
 * lib/portal-locale.ts explains why — so the switch is two form buttons
 * bound to the same server action with a different locale each, rather
 * than a link.
 *
 * No client JS is required for this to work: submitting either button
 * posts to setPortalLocale, which writes the cookie and, since this is a
 * plain form submission (not wrapped in useActionState), lets Next's own
 * post-action route refresh re-render the page with it applied.
 */
export function LocaleSwitch({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <form className={`flex items-center gap-1 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="submit"
          formAction={setPortalLocale.bind(null, l)}
          aria-current={l === locale ? "true" : undefined}
          className={`u-label rounded-full px-2.5 py-1 transition-colors ${
            l === locale ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </form>
  );
}
