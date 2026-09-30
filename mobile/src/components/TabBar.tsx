import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../i18n/i18n";
import type { StringKey } from "../i18n/strings";
import { useTheme } from "../theme/theme";
import { SPACE } from "../theme/tokens";
import { MiniPlayer } from "./MiniPlayer";
import { Txt } from "./Txt";

/**
 * A hand-rolled tab bar rather than the stock one, because the mini
 * player has to sit directly above it and move with it, and because the
 * stock bar does not look like Odatone.
 *
 * Only the parts of the navigator's props that are actually used are
 * typed here — the full navigation types are not part of expo-router's
 * public surface.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
  };
};

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: StringKey }> = {
  index: { on: "home", off: "home-outline", label: "tab.home" },
  playlists: { on: "albums", off: "albums-outline", label: "tab.playlists" },
  search: { on: "search", off: "search-outline", label: "tab.search" },
  account: { on: "person-circle", off: "person-circle-outline", label: "tab.account" },
};

export function TabBar({ state, navigation }: TabBarProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <MiniPlayer />
      <View
        style={{
          flexDirection: "row",
          paddingTop: SPACE.sm,
          paddingBottom: Math.max(insets.bottom, SPACE.sm),
          marginTop: SPACE.sm,
          borderTopWidth: 1,
          borderTopColor: c.line,
          backgroundColor: c.surface,
        }}
      >
        {state.routes.map((route, i) => {
          const meta = ICONS[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (focused || event.defaultPrevented) return;
                Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name);
              }}
              style={{ flex: 1, alignItems: "center", gap: 3 }}
            >
              <Ionicons name={focused ? meta.on : meta.off} size={22} color={focused ? c.accent : c.ink3} />
              <Txt variant="label" tone={focused ? "accent" : "ink3"} style={{ fontWeight: focused ? "600" : "500" }}>
                {t(meta.label)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
