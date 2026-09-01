import { Container, Section, SectionHead, Tile } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import PricingTable from "@/components/marketing/PricingTable";
import Accordion from "@/components/marketing/Accordion";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { CheckIcon } from "@/components/player/Icons";
import { pricing } from "@/lib/content/pricing";
import { home } from "@/lib/content/home";
import { ui } from "@/lib/content/common";
import { href, type Locale } from "@/lib/i18n";

export default function PricingPage({ locale: l }: { locale: Locale }) {
  return (
    <>
      <PageHero
        label={pricing.eyebrow[l]}
        title={pricing.title[l]}
        lede={pricing.lede[l]}
        size="lg"
      />

      <Section tight className="pt-0">
        <Container wide>
          <PricingTable locale={l} />
        </Container>
      </Section>

      <Section tint>
        <Container wide>
          <SectionHead title={pricing.includedHeading[l]} className="mb-12" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.included[l].map((f) => (
              <li key={f} className="u-card-flat flex items-start gap-3 p-5">
                <CheckIcon size={14} className="mt-1 shrink-0 text-accent" />
                <span className="text-[0.9375rem] leading-snug text-ink-2">{f}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <SectionHead title={pricing.compareHeading[l]} className="mb-12" />
          <Tile flat className="p-0">
            <div className="oda-scroll min-w-0 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {pricing.compare.head[l].map((h, i) => (
                      <th
                        key={i}
                        scope="col"
                        className={`px-7 py-5 text-[0.8125rem] font-semibold ${
                          i === 0 ? "text-ink-3" : "text-ink"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pricing.compare.rows[l].map((row) => (
                    <tr key={row[0]} className="border-b border-line last:border-0">
                      <th scope="row" className="px-7 py-5 text-[0.9375rem] font-normal text-ink-2">
                        {row[0]}
                      </th>
                      {row.slice(1).map((cell, i) => (
                        <td key={i} className="px-7 py-5 text-[0.9375rem] text-ink">
                          {cell === "—" ? <span className="text-ink-3">—</span> : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tile>
        </Container>
      </Section>

      <Section tint>
        <Container narrow>
          <SectionHead title={home.faq.title[l].replace(/\n/g, " ")} className="mb-12" />
          <Accordion items={home.faq.items[l]} />
        </Container>
      </Section>

      <Section tight>
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="u-display max-w-[18ch] text-[clamp(1.9rem,4.4vw,3rem)]">
              {l === "da" ? "Er du en kæde? Så laver vi en pris." : "Running a chain? We'll make a price."}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <LinkButton href={href(l, "contact")} variant="primary" size="lg">
                {ui.talkToSales[l]}
              </LinkButton>
              <TextLink href={href(l, "savings")}>{ui.seeSavings[l]}</TextLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
