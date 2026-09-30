import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { MOODS, PLAYLISTS, tracksFor, tracksInMood, type Playlist } from "../data/catalog";
import { useI18n } from "../i18n/i18n";
import { synthPeaks, trackCount } from "../lib/format";
import { useTheme } from "../theme/theme";
import { RADIUS, SPACE } from "../theme/tokens";
import { Cover } from "./Cover";
import { Txt } from "./Txt";

/** A mood, laid out like a curated list card: a full-width cover with the
 *  text under it. Tapping it opens the list, not playback — people want to
 *  see what they are about to put in the room. */
export function MoodTile({ mood, width = 200 }: { mood: (typeof MOODS)[number]; width?: number }) {
  const { l, locale } = useI18n();
  const router = useRouter();
  const count = tracksInMood(mood.id).length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/playlist/mood-${mood.id}`)}
      style={({ pressed }) => ({ width, gap: 10, opacity: pressed ? 0.75 : 1 })}
    >
      <Cover id={`mood-${mood.id}`} size={width} radius={RADIUS.xl} bars={15} peaks={synthPeaks(`mood-${mood.id}`)} />
      <View>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {l(mood.label)}
        </Txt>
        <Txt variant="small" tone="ink3" numberOfLines={2} style={{ marginTop: 2 }}>
          {l(mood.blurb)}
        </Txt>
        <Txt variant="label" tone="ink3" style={{ marginTop: 6 }}>
          {trackCount(count, locale)}
        </Txt>
      </View>
    </Pressable>
  );
}

/** A curated list, as a wide card. */
export function PlaylistCard({ playlist, width = 200 }: { playlist: Playlist; width?: number }) {
  const { l, locale } = useI18n();
  const router = useRouter();
  const count = tracksFor(playlist.rule).length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/playlist/${playlist.id}`)}
      style={({ pressed }) => ({ width, gap: 10, opacity: pressed ? 0.75 : 1 })}
    >
      <Cover id={playlist.id} size={width} radius={RADIUS.xl} bars={15} peaks={synthPeaks(playlist.id)} />
      <View>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {l(playlist.title)}
        </Txt>
        <Txt variant="small" tone="ink3" numberOfLines={2} style={{ marginTop: 2 }}>
          {l(playlist.blurb)}
        </Txt>
        <Txt variant="label" tone="ink3" style={{ marginTop: 6 }}>
          {trackCount(count, locale)}
        </Txt>
      </View>
    </Pressable>
  );
}

/** The full-width row used on the Playlists tab. */
export function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const { c } = useTheme();
  const { l, locale } = useI18n();
  const router = useRouter();
  const count = tracksFor(playlist.rule).length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/playlist/${playlist.id}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Cover id={playlist.id} size={56} radius={RADIUS.md} bars={7} peaks={synthPeaks(playlist.id, 7)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {l(playlist.title)}
        </Txt>
        <Txt variant="small" tone="ink3" numberOfLines={1} style={{ marginTop: 2 }}>
          {l(playlist.blurb)}
        </Txt>
      </View>
      <Txt variant="label" tone="ink3">
        {trackCount(count, locale)}
      </Txt>
      <Ionicons name="chevron-forward" size={16} color={c.ink3} />
    </Pressable>
  );
}

export const ALL_PLAYLISTS = PLAYLISTS;
