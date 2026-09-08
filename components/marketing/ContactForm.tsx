"use client";

import { useState } from "react";

import { submitSalesLead } from "@/app/actions";
import { Field, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/player/Icons";
import { contact as contactDefaults } from "@/lib/content/contact";
import { useCopy } from "@/components/CopyProvider";
import { EMAIL_RE, type FieldErrors } from "@/lib/forms";
import { SITE } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

export default function ContactForm({ locale: l }: { locale: Locale }) {
  const contact = useCopy(contactDefaults);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex max-w-[52ch] flex-col items-start gap-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-ink">
          <CheckIcon size={17} />
        </span>
        <h2 className="u-display text-[clamp(1.6rem,4vw,2.4rem)]">{contact.successTitle[l]}</h2>
        <p className="u-lede">
          {contact.successBody[l].split("{email}")[0]}
          <a href={`mailto:${SITE.email}`} className="u-link">
            {SITE.email}
          </a>
          {contact.successBody[l].split("{email}")[1]}
        </p>
      </div>
    );
  }

  async function action(formData: FormData) {
    const local: FieldErrors = {};
    const get = (k: string) => String(formData.get(k) ?? "").trim();
    if (!get("name")) local.name = contact.errorRequired[l];
    if (!get("company")) local.company = contact.errorRequired[l];
    if (!EMAIL_RE.test(get("email"))) local.email = contact.errorEmail[l];
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    const res = await submitSalesLead(formData);
    setBusy(false);
    if (res.ok) setSent(true);
    else
      setErrors(
        Object.fromEntries(
          Object.entries(res.errors).map(([k, v]) => [
            k,
            v === "email" ? contact.errorEmail[l] : contact.errorRequired[l],
          ]),
        ),
      );
  }

  return (
    <form action={action} className="flex flex-col gap-7" noValidate>
      <h2 className="u-display text-[clamp(1.5rem,3.4vw,2.1rem)]">{contact.formHeading[l]}</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={contact.fields.name[l]} name="name" error={errors.name} autoComplete="name" />
        <Field label={contact.fields.company[l]} name="company" error={errors.company} autoComplete="organization" />
        <Field label={contact.fields.email[l]} name="email" type="email" error={errors.email} autoComplete="email" />
        <Field label={contact.fields.phone[l]} name="phone" type="tel" hint={contact.optional[l]} autoComplete="tel" />
        <Field
          label={contact.fields.locations[l]}
          name="locations"
          type="number"
          min={1}
          defaultValue={1}
          className="sm:col-span-2 sm:max-w-[220px]"
        />
      </div>

      <TextField label={contact.fields.message[l]} name="message" hint={contact.optional[l]} />

      <div className="flex flex-wrap items-center gap-5">
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? contact.sending[l] : contact.submit[l]}
        </Button>
        <p className="u-label max-w-[38ch] text-[0.75rem]">{contact.demoNote[l]}</p>
      </div>
    </form>
  );
}
