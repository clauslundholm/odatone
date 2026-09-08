import { Container, Section, SectionHead, Tile } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import Calculator from "@/components/marketing/Calculator";
import PriceCompare from "@/components/marketing/PriceCompare";
import Accordion from "@/components/marketing/Accordion";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { savings as savingsDefaults } from "@/lib/content/savings";
import { ui as uiDefaults } from "@/lib/content/common";
import { serverCopy } from "@/lib/copy-server";
import { RATES_UPDATED, RATES_VERIFIED } from "@/lib/rates";
import { href, type Locale } from "@/lib/i18n";

export default async function SavingsPage({ locale: l }: { locale: Locale }) {
  const savings = await serverCopy(savingsDefaults, l);
  const ui = await serverCopy(uiDefaults, l);
  return (
    <>
      <PageHero
        label={savings.eyebrow[l]}
        title={savings.title[l]}
        lede={savings.lede[l]}
        size="lg"
      />

      <Section tight className="pt-0">
        <Container wide>
          <Calculator locale={l} id="calculator" />
          <Tile flat className="mt-5">
            <p className="u-label mb-3">{savings.disclaimerTitle[l]}</p>
            <p className="max-w-[76ch] text-[0.9375rem] leading-relaxed text-ink-2">
              {savings.disclaimer[l]}
            </p>
            {!RATES_VERIFIED && (
              <p className="mt-5 inline-flex rounded-full bg-surface-2 px-3.5 py-1.5 text-[0.75rem] text-warn">
                {l === "da"
                  ? `Satser ikke verificeret · sidst justeret ${RATES_UPDATED} · lib/rates.ts`
                  : `Rates not verified · last adjusted ${RATES_UPDATED} · lib/rates.ts`}
              </p>
            )}
          </Tile>
        </Container>
      </Section>

      <Section tint>
        <Container wide>
          <SectionHead
            title={l === "da" ? "Et konkret eksempel." : "A worked example."}
            className="mb-14"
          />
          <PriceCompare locale={l} />
        </Container>
      </Section>

      <Section>
        <Container narrow>
          <SectionHead title={savings.faqTitle[l]} className="mb-12" />
          <Accordion items={savings.faq[l]} />
        </Container>
      </Section>

      <Section tint tight>
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="u-display max-w-[16ch] text-[clamp(1.9rem,4.4vw,3rem)]">
              {l === "da" ? "Klar til at skifte regning ud?" : "Ready to swap the bill?"}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <LinkButton href={href(l, "signup")} variant="primary" size="lg">
                {ui.startTrial[l]}
              </LinkButton>
              <TextLink href={href(l, "contact")}>{ui.talkToSales[l]}</TextLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
