import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "../../src/audio/PlayerProvider";
import { Cover } from "../../src/components/Cover";
import { FloatingMiniPlayer } from "../../src/components/MiniPlayer";
import { BOTTOM_INSET, Screen } from "../../src/components/Screen";
import { TrackRow } from "../../src/components/TrackRow";
import { Txt } from "../../src/components/Txt";
import { moodById, playlistById, runTime, tracksFor, tracksInMood } from "../../src/data/catalog";
import type { Track } from "../../src/data/tracks";
import { useI18n } from "../../src/i18n/i18n";
import { synthPeaks, totalMinutes, trackCount } from "../../src/lib/format";
import { useTheme } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";
import type { L10n, Mood } from "../../src/types";

/** One screen serves both kinds of list: `mood-calm` and `opening`. */
function resolve(id: string): { title: L10n; blurb: L10n; tracks: Track[] } | null {
  if (id.startsWith("mood-")) {
    const mood = id.slice(5) as Mood;
    const meta = moodById(mood);
    if (!meta) return null;
    return { title: meta.label, blurb: meta.blurb, tracks: tracksInMood(mood) };
  }
  const list = playlistById(id);
  if (!list) return null;
  return { title: list.title, blurb: list.blurb, tracks: tracksFor(list.rule) };
}

export default function PlaylistScreen() {
  const { c } = useTheme();
  const { t, l, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playTrack, playList } = usePlayer();

  const data = resolve(String(id ?? ""));

  if (!data) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Txt variant="title">404</Txt>
          <Pressable onPress={() => router.back()}>
            <Txt variant="body" tone="accent">←</Txt>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const label = l(data.title);
  const minutes = totalMinutes(runTime(data.tracks));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: BOTTOM_INSET }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: insets.top + SPACE.sm, paddingHorizontal: SPACE.lg }}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={c.ink2} />
          </Pressable>
        </View>

        <View style={{ alignItems: "center", paddingTop: SPACE.md }}>
          <Cover id={String(id)} size={200} radius={RADIUS.xl} bars={15} peaks={synthPeaks(String(id))} />
        </View>

        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, gap: 6 }}>
          <Txt variant="display">{label}</Txt>
          <Txt variant="body" tone="ink2">{l(data.blurb)}</Txt>
          <Txt variant="label" tone="ink3">
            {trackCount(data.tracks.length, locale)} · {minutes} {t("common.min")}
          </Txt>
        </View>

        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}>
          <Action
            icon="play"
            label={t("playlists.play")}
            primary
            onPress={() => playList(data.tracks, label)}
          />
          <Action
            icon="shuffle"
            label={t("playlists.shuffle")}
            onPress={() => playList(data.tracks, label, { shuffle: true })}
          />
        </View>

        <View style={{ height: SPACE.md }} />
        {data.tracks.map((item) => (
          <TrackRow key={item.id} track={item} onPress={() => playTrack(item, data.tracks, label)} />
        ))}
      </ScrollView>
      <FloatingMiniPlayer />
    </Screen>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 13,
        borderRadius: RADIUS.pill,
        backgroundColor: primary ? c.accent : c.surface,
        borderWidth: 1,
        borderColor: primary ? c.accent : c.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color={primary ? c.accentInk : c.ink} />
      <Txt variant="bodyStrong" tone={primary ? "onAccent" : "ink"}>{label}</Txt>
    </Pressable>
  );
}
