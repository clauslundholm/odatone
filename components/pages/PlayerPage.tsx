import { Container, Section, SectionHead, Tile } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import LibraryBrowser from "@/components/player/LibraryBrowser";
import { LinkButton, TextLink } from "@/components/ui/Button";
import { player as playerDefaults } from "@/lib/content/player";
import { ui as uiDefaults } from "@/lib/content/common";
import { GENRES, MOODS, TRACKS, countByGenre } from "@/lib/tracks";
import { href, type Locale } from "@/lib/i18n";
import { num } from "@/lib/format";

export default function PlayerPage({ locale: l }: { locale: Locale }) {
  const player = playerDefaults;
  const ui = uiDefaults;
  const counts = countByGenre();

  return (
    <>
      <PageHero
        label={player.eyebrow[l]}
        title={player.title[l]}
        lede={player.lede[l]}
        size="lg"
      />

      <Section tight className="pt-0">
        <Container wide>
          <LibraryBrowser />
        </Container>
      </Section>

      <Section tint>
        <Container wide>
          <SectionHead
            title={l === "da" ? "Otte genrer, fem stemninger." : "Eight genres, five moods."}
            lede={
              l === "da"
                ? `${num(TRACKS.length, l)} numre i demobiblioteket. Over 4.000 i det rigtige.`
                : `${num(TRACKS.length, l)} tracks in the demo library. Over 4,000 in the real one.`
            }
            className="mb-14"
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <Tile flat>
              <h3 className="u-title mb-6 text-xl">{player.genre[l]}</h3>
              <ul className="flex flex-col">
                {GENRES.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 last:border-0"
                  >
                    <span className="text-[0.9375rem] text-ink">{g.label[l]}</span>
                    <span className="u-tabular text-[0.8125rem] text-ink-3">
                      {num(counts[g.id], l)}
                    </span>
                  </li>
                ))}
              </ul>
            </Tile>
            <Tile flat>
              <h3 className="u-title mb-6 text-xl">{player.mood[l]}</h3>
              <ul className="flex flex-col">
                {MOODS.map((m) => (
                  <li key={m.id} className="border-b border-line py-3.5 last:border-0">
                    <p className="text-[0.9375rem] text-ink">{m.label[l]}</p>
                    <p className="mt-0.5 text-[0.8125rem] text-ink-3">{m.blurb[l]}</p>
                  </li>
                ))}
              </ul>
            </Tile>
          </div>
        </Container>
      </Section>

      <Section tight>
        <Container>
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="u-display max-w-[16ch] text-[clamp(1.9rem,4.4vw,3rem)]">
              {l === "da" ? "Vil du have det i lokalet?" : "Want it in the room?"}
            </h2>
            <p className="u-lede max-w-[44ch]">
              {l === "da"
                ? "14 dage gratis, ingen binding, fem minutter til musik i højttalerne."
                : "14 days free, no commitment, five minutes to music in the speakers."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <LinkButton href={href(l, "signup")} variant="primary" size="lg">
                {ui.startTrial[l]}
              </LinkButton>
              <TextLink href={href(l, "pricing")}>{ui.seePricing[l]}</TextLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
