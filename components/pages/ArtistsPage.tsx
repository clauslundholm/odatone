import { Container, Section, SectionHead, Tile, Label } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import Reveal from "@/components/ui/Reveal";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { artists } from "@/lib/content/artists";
import { SITE } from "@/lib/site";
import { TRACKS, GENRES } from "@/lib/tracks";
import { href, type Locale } from "@/lib/i18n";
import { num } from "@/lib/format";

export default function ArtistsPage({ locale: l }: { locale: Locale }) {
  const roster = [...new Set(TRACKS.map((t) => t.artist))].map((name) => {
    const own = TRACKS.filter((t) => t.artist === name);
    return { name, count: own.length, genres: [...new Set(own.map((t) => t.genre))] };
  });

  return (
    <>
      <PageHero
        label={artists.eyebrow[l]}
        title={artists.title[l]}
        lede={artists.lede[l]}
        size="lg"
      />

      <Section dark tight>
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="u-num u-gradient text-[clamp(5rem,16vw,12rem)] leading-[0.85]">2</p>
            <p className="u-lede max-w-[42ch]">
              {l === "da"
                ? "dage i studiet betaler mere end en million streams på en almindelig tjeneste."
                : "days in the studio pay more than a million streams on an ordinary service."}
            </p>
          </div>
        </Container>
      </Section>

      <Section>
        <Container wide>
          <SectionHead title={artists.dealHeading[l]} className="mb-14" />
          <ul className="grid gap-5 md:grid-cols-2">
            {artists.deal[l].map(([title, body], i) => (
              <Reveal as="li" key={title} delay={i * 70}>
                <Tile className="h-full">
                  <h3 className="u-title mb-4 text-xl">{title}</h3>
                  <p className="max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-2">{body}</p>
                </Tile>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tint>
        <Container wide>
          <SectionHead title={artists.rosterHeading[l]} className="mb-12" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((a) => (
              <li key={a.name} className="u-card-flat p-6">
                <p className="u-title text-lg">{a.name}</p>
                <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                  {a.genres.map((g) => GENRES.find((x) => x.id === g)?.label[l] ?? g).join(" · ")}
                </p>
                <p className="mt-4 text-[0.8125rem] text-accent">
                  {num(a.count, l)}{" "}
                  {l === "da"
                    ? a.count === 1
                      ? "nummer"
                      : "numre"
                    : a.count === 1
                      ? "track"
                      : "tracks"}
                </p>
              </li>
            ))}
          </ul>
          <p className="u-label mx-auto mt-6 max-w-[70ch] text-center text-[0.6875rem]">
            {artists.rosterNote[l]}
          </p>
        </Container>
      </Section>

      <Section tight>
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <Label accent>{artists.applyTitle[l]}</Label>
            <h2 className="u-display max-w-[16ch] text-[clamp(1.9rem,4.4vw,3rem)]">
              {artists.applyTitle[l]}
            </h2>
            <p className="u-lede max-w-[52ch]">{artists.applyBody[l]}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <LinkButton href={`mailto:${SITE.email}`} variant="primary" size="lg">
                {artists.applyCta[l]}
              </LinkButton>
              <TextLink href={href(l, "player")}>
                {l === "da" ? "Hør biblioteket" : "Hear the library"}
              </TextLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
