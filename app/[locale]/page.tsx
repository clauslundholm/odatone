import { notFound } from "next/navigation";

import { LOCALES, href, isLocale, type Locale } from "@/lib/i18n";
import { home as homeDefaults } from "@/lib/content/home";
import { savings as savingsDefaults } from "@/lib/content/savings";
import { pricing as pricingDefaults } from "@/lib/content/pricing";
import { ui as uiDefaults } from "@/lib/content/common";
import { serverCopy } from "@/lib/copy-server";

import { Container, Section, SectionHead, Label, Tile } from "@/components/ui/Section";
import { Aurora } from "@/components/ui/PageHero";
import { LinkButton, TextLink } from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import MoodCard from "@/components/player/MoodCard";
import MoodGrid from "@/components/player/MoodGrid";
import Calculator from "@/components/marketing/Calculator";
import PriceCompare from "@/components/marketing/PriceCompare";
import HeroSavings from "@/components/marketing/HeroSavings";
import PricingTable from "@/components/marketing/PricingTable";
import Accordion from "@/components/marketing/Accordion";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const l: Locale = raw;
  const home = await serverCopy(homeDefaults, l);
  const savings = await serverCopy(savingsDefaults, l);
  const pricing = await serverCopy(pricingDefaults, l);
  const ui = await serverCopy(uiDefaults, l);

  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="relative overflow-hidden">
        <Aurora />
        <Container className="relative z-[2]">
          <div className="flex flex-col items-center gap-7 pb-14 pt-32 text-center sm:pt-44 lg:pb-20">
            <p className="u-label u-rise text-accent">{home.hero.eyebrow[l]}</p>
            <h1 className="u-display max-w-[15ch] text-[clamp(2.75rem,7.2vw,5.5rem)]">
              <span className="block u-rise" style={{ animationDelay: "60ms" }}>
                {home.hero.line1[l]}
              </span>
              <span className="block u-rise" style={{ animationDelay: "140ms" }}>
                {home.hero.line2[l]}
              </span>
            </h1>
            <p className="u-lede u-rise max-w-[52ch]" style={{ animationDelay: "220ms" }}>
              {home.hero.lede[l]}
            </p>
            <div
              className="u-rise flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
              style={{ animationDelay: "300ms" }}
            >
              <LinkButton href={href(l, "signup")} variant="primary" size="lg">
                {ui.startTrial[l]}
              </LinkButton>
              <TextLink href={href(l, "savings")}>{ui.seeSavings[l]}</TextLink>
            </div>
            <div
              className="u-rise mt-8 w-full border-t border-line pt-10"
              style={{ animationDelay: "380ms" }}
            >
              <HeroSavings locale={l} />
            </div>
          </div>
        </Container>

        <Container wide className="relative z-[2] pb-20 lg:pb-28">
          <Reveal>
            <MoodCard />
          </Reveal>
        </Container>
      </section>

      {/* ------------------------- the player moment ------------------------ */}
      <Section dark>
        <Container wide>
          <SectionHead
            title={home.player.title[l].replace(/\n/g, " ")}
            lede={home.player.lede[l]}
            actions={<TextLink href={href(l, "player")}>{home.player.cta[l]}</TextLink>}
            className="mb-14"
            size="lg"
          />
          <Reveal>
            <MoodGrid />
          </Reveal>
        </Container>
      </Section>

      {/* --------------------------- what you save -------------------------- */}
      <Section tint>
        <Container wide>
          <SectionHead
            label={savings.eyebrow[l]}
            title={home.strip.heading[l]}
            lede={home.strip.lede[l]}
            className="mb-14"
          />
          <Reveal>
            <PriceCompare locale={l} />
          </Reveal>
        </Container>
      </Section>

      <Section id="calculator">
        <Container wide>
          <SectionHead
            title={savings.title[l].replace(/\n/g, " ")}
            lede={savings.lede[l]}
            actions={<TextLink href={href(l, "savings")}>{savings.ctaSecondary[l]}</TextLink>}
            className="mb-14"
          />
          <Reveal>
            <Calculator locale={l} />
          </Reveal>
        </Container>
      </Section>

      {/* ------------------------------ tiles ------------------------------- */}
      <Section tint tight>
        <Container wide>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {home.hero.tiles[l].map(([value, label], i) => (
              <Reveal as="li" key={label} delay={i * 70}>
                <Tile className="flex h-full flex-col justify-between gap-8">
                  <p className="u-num u-gradient text-[clamp(2.2rem,4vw,3rem)]">{value}</p>
                  <p className="text-[0.9375rem] leading-snug text-ink-2">{label}</p>
                </Tile>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ------------------------------ legal ------------------------------- */}
      <Section>
        <Container wide>
          <SectionHead
            label={home.legal.eyebrow[l]}
            title={home.legal.title[l].replace(/\n/g, " ")}
            lede={home.legal.lede[l]}
            className="mb-14"
          />
          <Reveal>
            <div className="u-card overflow-hidden">
              <div className="oda-scroll min-w-0 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      {home.legal.table.head[l].map((h, i) => (
                        <th
                          key={i}
                          scope="col"
                          className={`px-7 py-5 text-[0.8125rem] font-semibold ${
                            i === 2 ? "text-accent" : "text-ink-3"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {home.legal.table.rows[l].map((row) => (
                      <tr key={row[0]} className="border-b border-line last:border-0">
                        <th scope="row" className="px-7 py-5 text-[0.9375rem] font-medium text-ink">
                          {row[0]}
                        </th>
                        <td className="px-7 py-5 text-[0.9375rem] text-ink-3">{row[1]}</td>
                        <td className="px-7 py-5 text-[0.9375rem] text-ink">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ----------------------------- artists ------------------------------ */}
      <Section dark>
        <Container>
          <div className="flex flex-col items-center gap-8 text-center">
            <Label accent>{home.artists.eyebrow[l]}</Label>
            <p className="u-num u-gradient text-[clamp(6rem,18vw,14rem)] leading-[0.85]">2</p>
            <h2 className="u-display max-w-[18ch] text-[clamp(2rem,4.6vw,3.5rem)]">
              {home.artists.title[l].replace(/\n/g, " ")}
            </h2>
            <p className="u-lede max-w-[56ch]">{home.artists.lede[l]}</p>
            <TextLink href={href(l, "artists")}>{home.artists.cta[l]}</TextLink>
          </div>
        </Container>
      </Section>

      {/* ------------------------------ proof ------------------------------- */}
      <Section tint>
        <Container>
          <figure className="flex flex-col items-center gap-9 text-center">
            <blockquote className="u-display max-w-[22ch] text-[clamp(1.7rem,4vw,3rem)]">
              “{home.proof.quote[l]}”
            </blockquote>
            <figcaption className="u-label">{home.proof.quoteBy[l]}</figcaption>
          </figure>

          <div className="mt-20 flex flex-col items-center gap-7">
            <Label>{home.proof.logosLead[l]}</Label>
            <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
              {home.proof.logos.map((name) => (
                <li key={name} className="text-[1.0625rem] font-medium text-ink-3">
                  {name}
                </li>
              ))}
            </ul>
            <p className="u-label max-w-[60ch] text-center text-[0.6875rem]">
              {home.proof.logosNote[l]}
            </p>
          </div>

          <dl className="mt-20 grid gap-5 md:grid-cols-3">
            {home.proof.behaviour[l].map(([value, label], i) => (
              <Reveal key={label} delay={i * 70}>
                <Tile flat className="h-full">
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="u-num block text-[clamp(2.2rem,4vw,3rem)] text-ink">
                      {value}
                    </span>
                    <span className="mt-4 block text-[0.9375rem] leading-snug text-ink-2">
                      {label}
                    </span>
                  </dd>
                </Tile>
              </Reveal>
            ))}
          </dl>
          <p className="u-label mt-5 text-center text-[0.6875rem]">{home.proof.behaviourNote[l]}</p>
        </Container>
      </Section>

      {/* ----------------------------- pricing ------------------------------ */}
      <Section>
        <Container wide>
          <SectionHead
            label={pricing.eyebrow[l]}
            title={pricing.title[l].replace(/\n/g, " ")}
            lede={pricing.lede[l]}
            className="mb-14"
          />
          <PricingTable locale={l} />
        </Container>
      </Section>

      {/* ------------------------------- faq -------------------------------- */}
      <Section tint>
        <Container narrow>
          <SectionHead title={home.faq.title[l].replace(/\n/g, " ")} className="mb-12" />
          <Accordion items={home.faq.items[l]} />
        </Container>
      </Section>

      {/* ---------------------------- final cta ----------------------------- */}
      <Section className="relative overflow-hidden">
        <Aurora />
        <Container className="relative z-[2]">
          <div className="flex flex-col items-center gap-7 text-center">
            <h2 className="u-display max-w-[14ch] text-[clamp(2.4rem,6vw,4.5rem)]">
              {home.finalCta.title[l].replace(/\n/g, " ")}
            </h2>
            <p className="u-lede max-w-[46ch]">{home.finalCta.lede[l]}</p>
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
