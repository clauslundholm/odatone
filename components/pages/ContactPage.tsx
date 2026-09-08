import { Container, Section, Tile } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import ContactForm from "@/components/marketing/ContactForm";
import { contact as contactDefaults } from "@/lib/content/contact";
import { serverCopy } from "@/lib/copy-server";
import { SITE } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

export default async function ContactPage({ locale: l }: { locale: Locale }) {
  const contact = await serverCopy(contactDefaults, l);
  return (
    <>
      <PageHero label={contact.eyebrow[l]} title={contact.title[l]} lede={contact.lede[l]} />

      <Section tight className="pt-0">
        <Container wide>
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <Tile className="p-8 sm:p-11">
              <ContactForm locale={l} />
            </Tile>
            <Tile flat className="h-full">
              <h2 className="u-label mb-6">{contact.asideHeading[l]}</h2>
              <a href={`mailto:${SITE.email}`} className="u-link text-[1.0625rem]">
                {SITE.email}
              </a>
              <p className="mt-3">
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                  className="text-[0.9375rem] text-ink-2 transition-colors hover:text-ink"
                >
                  {SITE.phone}
                </a>
              </p>
              <p className="u-label mt-1 text-[0.6875rem]">
                {l === "da" ? "Telefonnummer = pladsholder" : "Phone number = placeholder"}
              </p>

              <dl className="mt-9 flex flex-col gap-4 border-t border-line pt-7">
                {contact.quickFacts[l].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <dt className="text-[0.875rem] text-ink-3">{k}</dt>
                    <dd className="text-right text-[0.875rem] text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Tile>
          </div>
        </Container>
      </Section>
    </>
  );
}
