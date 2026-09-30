import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayerStatus } from "expo-audio";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "../audio/PlayerProvider";
import { useI18n } from "../i18n/i18n";
import { useTheme } from "../theme/theme";
import { RADIUS, SPACE } from "../theme/tokens";
import { Cover, Mark } from "./Cover";
import { Txt } from "./Txt";
import { ProgressRail } from "./Waveform";

/**
 * The dock, shrunk to a phone. It is present on every tab — including
 * before the first play, where it shows an invitation rather than an
 * empty bar, exactly like the website.
 */
export function MiniPlayer() {
  const { c, scheme } = useTheme();
  const { t, l } = useI18n();
  const router = useRouter();
  const { player, track, playing, toggle, next } = usePlayer();
  const status = useAudioPlayerStatus(player);

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <BlurView
      intensity={scheme === "dark" ? 40 : 60}
      tint={scheme === "dark" ? "dark" : "light"}
      style={{
        marginHorizontal: SPACE.md,
        borderRadius: RADIUS.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.scrim,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => (track ? router.push("/now-playing") : toggle())}
        style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {track ? (
            <Cover id={track.id} peaks={track.peaks} size={40} bars={6} />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.surface2,
              }}
            >
              <Mark size={16} />
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            {track ? (
              <>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {l(track.title)}
                </Txt>
                <Txt variant="small" tone="ink3" numberOfLines={1}>
                  {track.artist}
                </Txt>
              </>
            ) : (
              <Txt variant="bodyStrong" numberOfLines={1}>
                {t("player.invite")}
              </Txt>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause" : "Play"}
            hitSlop={10}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              toggle();
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.accent,
            }}
          >
            <Ionicons name={playing ? "pause" : "play"} size={17} color={c.accentInk} style={{ marginLeft: playing ? 0 : 2 }} />
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel="Next" hitSlop={10} onPress={next}>
            <Ionicons name="play-skip-forward" size={19} color={track ? c.ink2 : c.ink3} />
          </Pressable>
        </View>

        {track ? <ProgressRail progress={progress} /> : null}
      </Pressable>
    </BlurView>
  );
}

/**
 * The same bar, for screens that sit outside the tab navigator (a
 * playlist opened from anywhere). Without it, walking into a list would
 * hide what is currently playing.
 */
export function FloatingMiniPlayer() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 12) }}>
      <MiniPlayer />
    </View>
  );
}
