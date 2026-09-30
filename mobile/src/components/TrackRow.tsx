import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";

import { usePlayer } from "../audio/PlayerProvider";
import type { Track } from "../data/tracks";
import { useI18n } from "../i18n/i18n";
import { clock } from "../lib/format";
import { useTheme } from "../theme/theme";
import { SPACE } from "../theme/tokens";
import { Cover } from "./Cover";
import { Txt } from "./Txt";

export function TrackRow({
  track,
  onPress,
  showArtwork = true,
  trailing,
}: {
  track: Track;
  onPress: () => void;
  showArtwork?: boolean;
  trailing?: "duration" | "none";
}) {
  const { c } = useTheme();
  const { l } = useI18n();
  const { track: current, playing } = usePlayer();
  const isCurrent = current?.id === track.id;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {showArtwork ? <Cover id={track.id} peaks={track.peaks} size={48} bars={7} /> : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" tone={isCurrent ? "accent" : "ink"} numberOfLines={1}>
          {l(track.title)}
        </Txt>
        <Txt variant="small" tone="ink3" numberOfLines={1} style={{ marginTop: 2 }}>
          {track.artist}
        </Txt>
      </View>

      {isCurrent && playing ? (
        <Ionicons name="volume-medium" size={16} color={c.accent} />
      ) : trailing === "none" ? null : (
        <Txt variant="small" tone="ink3">
          {clock(track.duration)}
        </Txt>
      )}
    </Pressable>
  );
}
