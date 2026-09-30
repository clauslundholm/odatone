import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayerStatus } from "expo-audio";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { usePlayer } from "../../src/audio/PlayerProvider";
import { MoodTile, PlaylistCard } from "../../src/components/Cards";
import { Cover, Mark } from "../../src/components/Cover";
import { BOTTOM_INSET, Screen, ScreenTitle, SectionHead } from "../../src/components/Screen";
import { TrackRow } from "../../src/components/TrackRow";
import { Txt } from "../../src/components/Txt";
import { FRESH, MOODS, PLAYLISTS } from "../../src/data/catalog";
import { TRACKS } from "../../src/data/tracks";
import { useI18n } from "../../src/i18n/i18n";
import { clock } from "../../src/lib/format";
import { useTheme } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";

export default function PlayerTab() {
  const { t, l } = useI18n();
  const { track, playTrack } = usePlayer();

  const hour = new Date().getHours();
  const greeting = hour < 11 ? t("home.morning") : hour < 17 ? t("home.afternoon") : t("home.evening");

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: BOTTOM_INSET }} showsVerticalScrollIndicator={false}>
        <ScreenTitle title={greeting} sub={t("home.sub")} />

        {track ? <NowPlayingPanel /> : <Invitation />}

        <SectionHead title={t("home.moods")} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, gap: 16 }}
        >
          {MOODS.map((m) => (
            <MoodTile key={m.id} mood={m} />
          ))}
        </ScrollView>

        <SectionHead title={t("home.lists")} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, gap: 16 }}
        >
          {PLAYLISTS.slice(0, 5).map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </ScrollView>

        <SectionHead title={t("home.fresh")} />
        {FRESH.map((item) => (
          <TrackRow key={item.id} track={item} onPress={() => playTrack(item, TRACKS, l({ da: "Nyt i biblioteket", en: "New in the library" }))} />
        ))}
      </ScrollView>
    </Screen>
  );
}

/** What the tab shows once something is playing: a large, quiet panel
 *  that opens the full player. */
function NowPlayingPanel() {
  const { c } = useTheme();
  const { t, l } = useI18n();
  const router = useRouter();
  const { player, track, playing, toggle, source } = usePlayer();
  const status = useAudioPlayerStatus(player);
  if (!track) return null;

  return (
    <Pressable
      onPress={() => router.push("/now-playing")}
      style={({ pressed }) => ({
        marginHorizontal: SPACE.lg,
        padding: SPACE.md,
        borderRadius: RADIUS.xl,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Cover id={track.id} peaks={track.peaks} size={84} radius={RADIUS.md} bars={9} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt variant="label" tone="ink3">
          {source ? `${t("player.from")} ${source}` : t("player.nowPlaying")}
        </Txt>
        <Txt variant="section" numberOfLines={1}>
          {l(track.title)}
        </Txt>
        <Txt variant="small" tone="ink2" numberOfLines={1}>
          {track.artist}
        </Txt>
        <Txt variant="label" tone="ink3">
          {clock(status.currentTime)} / {clock(status.duration || track.duration)}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={toggle}
        style={{
          width: 48,
          height: 48,
          borderRadius: RADIUS.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.accent,
        }}
      >
        <Ionicons name={playing ? "pause" : "play"} size={21} color={c.accentInk} style={{ marginLeft: playing ? 0 : 2 }} />
      </Pressable>
    </Pressable>
  );
}

/** Before the first play. The website shows an invitation here rather
 *  than an empty bar; so does the app. */
function Invitation() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { playList } = usePlayer();

  return (
    <View
      style={{
        marginHorizontal: SPACE.lg,
        padding: SPACE.lg,
        borderRadius: RADIUS.xl,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        gap: 12,
      }}
    >
      <Mark size={22} />
      <Txt variant="title">{t("player.empty")}</Txt>
      <Txt variant="body" tone="ink2">
        {t("player.emptyBody")}
      </Txt>
      <Pressable
        accessibilityRole="button"
        onPress={() => playList(TRACKS, "Odatone", { shuffle: true })}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          marginTop: 4,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: RADIUS.pill,
          backgroundColor: c.accent,
          opacity: pressed ? 0.85 : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        })}
      >
        <Ionicons name="play" size={16} color={c.accentInk} />
        <Txt variant="bodyStrong" tone="onAccent">
          {t("player.invite")}
        </Txt>
      </Pressable>
    </View>
  );
}
