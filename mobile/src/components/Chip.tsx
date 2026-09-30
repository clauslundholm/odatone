import * as Haptics from "expo-haptics";
import { Pressable, type ViewStyle } from "react-native";

import { useTheme } from "../theme/theme";
import { RADIUS } from "../theme/tokens";
import { Txt } from "./Txt";

export function Chip({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: RADIUS.pill,
          backgroundColor: active ? c.accent : c.surface,
          borderWidth: 1,
          borderColor: active ? c.accent : c.line,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Txt variant="label" tone={active ? "onAccent" : "ink2"}>
        {label}
      </Txt>
    </Pressable>
  );
}
