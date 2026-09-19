import { Container, Section } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import { legal as legalDefaults } from "@/lib/content/legal";
import type { Locale } from "@/lib/i18n";

export default function LegalPage({
  locale: l,
  kind,
}: {
  locale: Locale;
  kind: "privacy" | "terms";
}) {
  const legal = legalDefaults;
  const doc = legal[kind];

  return (
    <>
      <PageHero label={doc.updated[l]} title={doc.title[l]} />

      <Section className="pt-0">
        <Container narrow>
          <p className="mb-14 rounded-[var(--radius-lg)] bg-surface-2 px-6 py-4 text-[0.8125rem] leading-relaxed text-warn">
            {legal.note[l]}
          </p>
          <ol className="flex flex-col gap-12">
            {doc.sections[l].map(([heading, body], i) => (
              <li key={heading}>
                <p className="u-tabular mb-2 text-[0.75rem] text-ink-3">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="u-title mb-4 text-[1.375rem]">{heading}</h2>
                <p className="text-[1.0625rem] leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
    </>
  );
}
