import { Container, Section, SectionHead, Tile } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import Reveal from "@/components/ui/Reveal";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { about } from "@/lib/content/about";
import { ui } from "@/lib/content/common";
import { SITE, PROOF } from "@/lib/site";
import { href, type Locale } from "@/lib/i18n";
import { num } from "@/lib/format";

export default function AboutPage({ locale: l }: { locale: Locale }) {
  const figures: [string, string][] = [
    [`${num(PROOF.tracks, l)}+`, l === "da" ? "numre" : "tracks"],
    [`${num(PROOF.customers, l)}+`, l === "da" ? "kunder" : "customers"],
    ["8", l === "da" ? "genrer" : "genres"],
    ["0", l === "da" ? "licenser oveni" : "licences on top"],
  ];

  return (
    <>
      <PageHero label={about.eyebrow[l]} title={about.title[l]} lede={about.lede[l]} size="lg" />

      <Section tight className="pt-0">
        <Container wide>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {figures.map(([v, k], i) => (
              <Reveal key={k} delay={i * 70}>
                <Tile className="h-full">
                  <dt className="sr-only">{k}</dt>
                  <dd>
                    <span className="u-num u-gradient block text-[clamp(2.2rem,4vw,3rem)]">{v}</span>
                    <span className="mt-4 block text-[0.9375rem] text-ink-2">{k}</span>
                  </dd>
                </Tile>
              </Reveal>
            ))}
          </dl>
        </Container>
      </Section>

      <Section tint>
        <Container narrow>
          <SectionHead title={about.storyHeading[l]} className="mb-12" />
          <div className="flex flex-col gap-6">
            {about.story[l].map((para, i) => (
              <p
                key={i}
                className={
                  i === 0
                    ? "text-[clamp(1.125rem,1.8vw,1.375rem)] leading-relaxed text-ink"
                    : "text-[1.0625rem] leading-relaxed text-ink-2"
                }
              >
                {para}
              </p>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <SectionHead title={about.peopleHeading[l]} className="mb-14" />
          <ul className="grid gap-5 md:grid-cols-2">
            {about.people.map((p) => (
              <li key={p.name}>
                <Tile className="h-full">
                  <p className="u-label mb-5 text-accent">{p.role[l]}</p>
                  <h3 className="u-display text-[clamp(1.5rem,3vw,2.1rem)]">{p.name}</h3>
                  <p className="mt-5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-2">
                    {p.bio[l]}
                  </p>
                </Tile>
              </li>
            ))}
          </ul>
          <p className="u-label mx-auto mt-6 max-w-[70ch] text-center text-[0.6875rem]">
            {about.peopleNote[l]}
          </p>
        </Container>
      </Section>

      <Section tint>
        <Container wide>
          <SectionHead title={about.valuesHeading[l]} className="mb-14" />
          <ul className="grid gap-5 md:grid-cols-3">
            {about.values[l].map(([title, body]) => (
              <li key={title}>
                <Tile flat className="h-full">
                  <h3 className="u-title mb-3 text-lg">{title}</h3>
                  <p className="text-[0.9375rem] leading-relaxed text-ink-2">{body}</p>
                </Tile>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tight>
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="u-display text-[clamp(1.9rem,4.4vw,3rem)]">
              {l === "da" ? "Sig hej." : "Say hello."}
            </h2>
            <a href={`mailto:${SITE.email}`} className="u-link text-[1.0625rem]">
              {SITE.email}
            </a>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
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
