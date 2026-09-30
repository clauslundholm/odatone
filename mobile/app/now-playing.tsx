import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "../src/audio/PlayerProvider";
import { Cover } from "../src/components/Cover";
import { TrackRow } from "../src/components/TrackRow";
import { Txt } from "../src/components/Txt";
import { Waveform } from "../src/components/Waveform";
import { genreLabel } from "../src/data/catalog";
import { useI18n } from "../src/i18n/i18n";
import { clock } from "../src/lib/format";
import { useTheme } from "../src/theme/theme";
import { RADIUS, SPACE } from "../src/theme/tokens";

export default function NowPlaying() {
  const { c } = useTheme();
  const { t, l } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    player, track, queue, source, playing, shuffle, repeat,
    toggle, next, previous, seekTo, toggleShuffle, cycleRepeat, playTrack,
  } = usePlayer();
  const status = useAudioPlayerStatus(player);

  if (!track) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Txt variant="title">{t("player.empty")}</Txt>
        <Txt variant="body" tone="ink2">{t("player.emptyBody")}</Txt>
      </View>
    );
  }

  const duration = status.duration || track.duration;
  const progress = duration > 0 ? status.currentTime / duration : 0;
  const art = Math.min(width - SPACE.lg * 2, 320);
  const upNext = queue.slice(queue.findIndex((q) => q.id === track.id) + 1);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingBottom: insets.bottom + SPACE.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg }}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="chevron-down" size={26} color={c.ink2} />
          </Pressable>
          <Txt variant="label" tone="ink3" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {source ? `${t("player.from")} ${source}` : t("player.nowPlaying")}
          </Txt>
          <View style={{ width: 26 }} />
        </View>

        <View style={{ alignItems: "center", paddingTop: SPACE.lg }}>
          <Cover id={track.id} peaks={track.peaks} size={art} radius={RADIUS.xl} bars={17} />
        </View>

        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, gap: 4 }}>
          <Txt variant="title" numberOfLines={2}>{l(track.title)}</Txt>
          <Txt variant="body" tone="ink2">{track.artist}</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Meta text={l(genreLabel(track.genre))} />
            <Meta text={`${track.bpm} ${t("common.bpm")}`} />
            <Meta text={track.vox ? t("common.vocals") : t("common.instrumental")} />
          </View>
        </View>

        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
          <Waveform
            peaks={track.peaks}
            progress={progress}
            onSeek={(f) => seekTo(f * duration)}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Txt variant="label" tone="ink3">{clock(status.currentTime)}</Txt>
            <Txt variant="label" tone="ink3">-{clock(Math.max(0, duration - status.currentTime))}</Txt>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: SPACE.xl,
            paddingTop: SPACE.lg,
          }}
        >
          <Pressable accessibilityRole="button" hitSlop={10} onPress={toggleShuffle}>
            <Ionicons name="shuffle" size={22} color={shuffle ? c.accent : c.ink3} />
          </Pressable>

          <Pressable accessibilityRole="button" hitSlop={10} onPress={previous}>
            <Ionicons name="play-skip-back" size={28} color={c.ink} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause" : "Play"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              toggle();
            }}
            style={({ pressed }) => ({
              width: 72,
              height: 72,
              borderRadius: RADIUS.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.accent,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name={playing ? "pause" : "play"} size={30} color={c.accentInk} style={{ marginLeft: playing ? 0 : 3 }} />
          </Pressable>

          <Pressable accessibilityRole="button" hitSlop={10} onPress={next}>
            <Ionicons name="play-skip-forward" size={28} color={c.ink} />
          </Pressable>

          <Pressable accessibilityRole="button" hitSlop={10} onPress={cycleRepeat}>
            <Ionicons
              name={repeat === "one" ? "repeat-outline" : "repeat"}
              size={22}
              color={repeat === "off" ? c.ink3 : c.accent}
            />
          </Pressable>
        </View>

        <Txt variant="label" tone="ink3" style={{ textAlign: "center", paddingTop: SPACE.sm }}>
          {repeat === "one" ? t("player.repeatOne") : repeat === "all" ? t("player.repeatAll") : t("player.repeatOff")}
        </Txt>

        {upNext.length > 0 && (
          <>
            <Txt variant="section" style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.xl, paddingBottom: SPACE.xs }}>
              {t("player.upNext")}
            </Txt>
            {upNext.map((item) => (
              <TrackRow key={item.id} track={item} onPress={() => playTrack(item)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Meta({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: RADIUS.pill,
        backgroundColor: c.surface2,
      }}
    >
      <Txt variant="label" tone="ink2">{text}</Txt>
    </View>
  );
}
